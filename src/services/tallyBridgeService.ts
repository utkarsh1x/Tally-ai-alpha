import { OrganizationSettings, TransactionEntry, TallySyncRecord } from '../types';
import { parseTallyXmlResponse, computeBatchSignature } from '../utils/tallyResponseParser';

const SYNC_HISTORY_STORAGE_KEY = 'tally_sync_history';
export const DEFAULT_BRIDGE_TOKEN = 'tallyai_local_bridge_sec_v1';

/**
 * Resolves the authentication token for the TallyAI Bridge.
 * Priority:
 * 1. User/Org Settings override (if explicitly saved)
 * 2. Vite environment variables (VITE_TALLY_BRIDGE_TOKEN / VITE_BRIDGE_TOKEN)
 * 3. Default secure fallback ('tallyai_local_bridge_sec_v1')
 */
export function getBridgeToken(settings?: OrganizationSettings): string {
  if (settings?.tallyBridgeToken && settings.tallyBridgeToken.trim()) {
    return settings.tallyBridgeToken.trim();
  }
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envToken = import.meta.env.VITE_TALLY_BRIDGE_TOKEN || import.meta.env.VITE_BRIDGE_TOKEN;
    if (envToken && typeof envToken === 'string' && envToken.trim()) {
      return envToken.trim();
    }
  }
  return DEFAULT_BRIDGE_TOKEN;
}

/**
 * Returns the effective Bridge URL.
 */
export function getBridgeBaseUrl(settings?: OrganizationSettings): string {
  const configured = settings?.tallyBridgeUrl?.trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return 'http://localhost:9001';
}

/**
 * Attempts fetch to primary URL with automatic fallback to 127.0.0.1 and local proxy.
 * Injects Bridge authentication token headers (x-bridge-token & Authorization).
 */
async function fetchWithBridgeFallback(
  path: string, 
  options: RequestInit, 
  settings?: OrganizationSettings
): Promise<{ response: Response; effectiveUrl: string }> {
  const primary = getBridgeBaseUrl(settings);
  const token = getBridgeToken(settings);

  // Set up headers with bridge token
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    if (!headers.has('x-bridge-token')) {
      headers.set('x-bridge-token', token);
    }
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const enrichedOptions: RequestInit = {
    ...options,
    headers
  };

  const candidateUrls = [
    `${primary}${path}`,
    primary.includes('localhost') ? `${primary.replace('localhost', '127.0.0.1')}${path}` : null,
    primary.includes('127.0.0.1') ? `${primary.replace('127.0.0.1', 'localhost')}${path}` : null
  ].filter(Boolean) as string[];

  let lastError: any = null;

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, enrichedOptions);
      if (res.ok || res.status === 400 || res.status === 401 || res.status === 403 || res.status === 500) {
        return { response: res, effectiveUrl: url };
      }
    } catch (err: any) {
      lastError = err;
      // try next candidate
    }
  }

  throw lastError || new Error(`Could not communicate with TallyAI Bridge at ${primary}`);
}

export interface TallyTestResult {
  connected: boolean;
  bridgeOnline: boolean;
  tallyReachable: boolean;
  companyVerified: boolean;
  requestedCompany: string;
  verifiedCompany?: string;
  activeCompany?: string;
  loadedCompanies?: string[];
  ledgersCount?: number;
  tallyRunning: boolean; // backwards-compatible alias for tallyReachable
  error?: string;
  troubleshooting?: string[];
  message: string;
}

/**
 * Tests connection to TallyPrime via the local bridge.
 */
export async function testTallyConnectionViaBridge(settings: OrganizationSettings): Promise<TallyTestResult> {
  const requestedCompany = settings.tallyCompanyName || '';
  const payload = {
    tallyHost: settings.tallyHost || 'http://localhost',
    tallyPort: settings.tallyPort || 9000,
    companyName: requestedCompany
  };

  try {
    const { response } = await fetchWithBridgeFallback('/api/tally/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, settings);

    const data = await response.json();

    if (response.status === 401) {
      return {
        connected: false,
        bridgeOnline: true,
        tallyReachable: false,
        companyVerified: false,
        requestedCompany,
        activeCompany: '',
        tallyRunning: false,
        error: data.error || 'Unauthorized: Invalid or missing bridge authentication token.',
        troubleshooting: [
          '1. Verify your Bridge Token in Master Settings or your .env file.',
          '2. Ensure VITE_TALLY_BRIDGE_TOKEN matches the token configured on the Bridge.',
          '3. By default, both use the secure key tallyai_local_bridge_sec_v1.'
        ],
        message: data.error || 'Bridge Authentication Failed (401 Unauthorized).'
      };
    }

    const bridgeOnline = Boolean(data.bridgeOnline !== false);
    const tallyReachable = Boolean(data.tallyReachable || data.tallyRunning);
    const companyVerified = Boolean(data.companyVerified);
    const connected = Boolean(data.connected);
    const activeCompany = (data.activeCompany && typeof data.activeCompany === 'string') ? data.activeCompany.trim() : '';
    const loadedCompanies = Array.isArray(data.loadedCompanies) ? data.loadedCompanies : (Array.isArray(data.companies) ? data.companies : []);

    return {
      connected,
      bridgeOnline,
      tallyReachable,
      companyVerified,
      requestedCompany: data.requestedCompany || requestedCompany,
      verifiedCompany: data.verifiedCompany || '',
      activeCompany,
      loadedCompanies,
      ledgersCount: data.ledgersCount,
      tallyRunning: tallyReachable,
      error: data.error,
      troubleshooting: data.troubleshooting,
      message: data.message || (connected 
        ? `Connected to TallyPrime. Active Company: '${activeCompany}'` 
        : (tallyReachable ? 'TallyPrime reachable, company not verified.' : 'TallyPrime is offline.'))
    };
  } catch (err: any) {
    const primaryUrl = getBridgeBaseUrl(settings);
    return {
      connected: false,
      bridgeOnline: false,
      tallyReachable: false,
      companyVerified: false,
      requestedCompany,
      activeCompany: '',
      loadedCompanies: [],
      tallyRunning: false,
      error: `Could not reach TallyAI Bridge at ${primaryUrl}.`,
      troubleshooting: [
        '1. Ensure the local TallyAI Bridge is running on your computer.',
        '2. Open your project terminal and run: npm run bridge',
        '   (or double-click "start-bridge.bat" on Windows).',
        '3. Verify the bridge output displays "TallyAI Local Gateway Bridge is ACTIVE on port 9001".',
        '4. If using Render, the bridge allows your browser to securely communicate with local TallyPrime.'
      ],
      message: `TallyAI Bridge is not running at ${primaryUrl}. Please run "npm run bridge" on your machine.`
    };
  }
}

/**
 * Pushes XML vouchers to TallyPrime via the local bridge.
 */
export async function pushToTallyViaBridge(
  xml: string, 
  entries: TransactionEntry[], 
  settings: OrganizationSettings, 
  batchId = `SYNC-${Date.now()}`
): Promise<TallySyncRecord> {
  const batchSignature = computeBatchSignature(entries);
  const voucherNumbers = entries.map(e => e.invoiceNumber || e.referenceNumber || e.id);
  const targetEndpoint = `${settings.tallyHost || 'http://localhost'}:${settings.tallyPort || 9000}`;

  const payload = {
    xml,
    tallyHost: settings.tallyHost || 'http://localhost',
    tallyPort: settings.tallyPort || 9000,
    companyName: settings.tallyCompanyName || '',
    batchId,
    voucherNumbers,
    voucherCount: entries.length
  };

  try {
    const { response } = await fetchWithBridgeFallback('/api/tally/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, settings);

    const result = await response.json();

    if (response.status === 401) {
      const record: TallySyncRecord = {
        id: `err-${Date.now()}`,
        timestamp: new Date().toISOString(),
        batchId,
        batchSignature,
        companyName: settings.tallyCompanyName || 'Active Company',
        targetEndpoint,
        totalVouchers: entries.length,
        created: 0,
        altered: 0,
        errors: entries.length,
        status: 'FAILED',
        errorDetails: [
          result.error || 'Unauthorized: Invalid or missing bridge authentication token (401).',
          'Make sure VITE_TALLY_BRIDGE_TOKEN matches the token configured on the Bridge.'
        ],
        voucherNumbers,
        rawResponse: '',
        message: result.error || 'Bridge authentication failed (401 Unauthorized).'
      };
      saveSyncRecord(record);
      return record;
    }

    // If server provided a formatted record, use it, or construct from parsed XML
    const parsed = result.created !== undefined 
      ? result 
      : parseTallyXmlResponse(result.rawXml || '');

    // Strict verified success: real success requires vouchers actually created or altered
    const isSuccess = (parsed.created > 0 || parsed.altered > 0);
    const computedStatus = isSuccess 
      ? (parsed.errors > 0 ? 'PARTIAL' : 'SUCCESS')
      : 'FAILED';

    const record: TallySyncRecord = {
      id: result.record?.id || `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      batchId,
      batchSignature,
      companyName: settings.tallyCompanyName || 'Active Company',
      targetEndpoint,
      totalVouchers: entries.length,
      created: parsed.created || 0,
      altered: parsed.altered || 0,
      deleted: parsed.deleted || 0,
      combined: parsed.combined || 0,
      errors: parsed.errors || 0,
      cancelled: parsed.cancelled || 0,
      status: parsed.status || computedStatus,
      errorDetails: parsed.errorDetails || [],
      voucherNumbers,
      rawResponse: parsed.rawXml || result.rawXml || '',
      message: parsed.message || result.message
    };

    // Save to persistent localStorage history
    saveSyncRecord(record);

    return record;
  } catch (err: any) {
    const record: TallySyncRecord = {
      id: `err-${Date.now()}`,
      timestamp: new Date().toISOString(),
      batchId,
      batchSignature,
      companyName: settings.tallyCompanyName || 'Active Company',
      targetEndpoint,
      totalVouchers: entries.length,
      created: 0,
      altered: 0,
      errors: entries.length,
      status: 'FAILED',
      errorDetails: [
        err.message || 'Bridge network error',
        'Make sure "npm run bridge" is running on port 9001.'
      ],
      voucherNumbers,
      rawResponse: '',
      message: `Failed to communicate with TallyAI Bridge: ${err.message}`
    };

    saveSyncRecord(record);
    return record;
  }
}

/**
 * Loads sync history from localStorage
 */
export function loadSyncHistory(): TallySyncRecord[] {
  try {
    const raw = localStorage.getItem(SYNC_HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves a sync record to localStorage (keeps last 50)
 */
export function saveSyncRecord(record: TallySyncRecord): void {
  try {
    const history = loadSyncHistory();
    history.unshift(record);
    const trimmed = history.slice(0, 50);
    localStorage.setItem(SYNC_HISTORY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Could not save sync history to localStorage:', err);
  }
}

/**
 * Clears sync history from localStorage
 */
export function clearSyncHistory(): void {
  try {
    localStorage.removeItem(SYNC_HISTORY_STORAGE_KEY);
  } catch (err) {
    console.warn('Could not clear sync history:', err);
  }
}

/**
 * Fetches sync history from the local bridge persistent store
 */
export async function fetchBridgeHistory(settings?: OrganizationSettings): Promise<{
  success: boolean;
  count: number;
  history: TallySyncRecord[];
}> {
  try {
    const { response } = await fetchWithBridgeFallback('/api/tally/history', {
      method: 'GET'
    }, settings);

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        count: data.count || data.history?.length || 0,
        history: data.history || []
      };
    }
    return { success: false, count: 0, history: [] };
  } catch {
    const local = loadSyncHistory();
    return { success: true, count: local.length, history: local };
  }
}

/**
 * Clears sync history from both the local bridge persistent store and browser localStorage
 */
export async function clearBridgeHistory(settings?: OrganizationSettings): Promise<{
  success: boolean;
  message: string;
}> {
  clearSyncHistory();
  try {
    const { response } = await fetchWithBridgeFallback('/api/tally/history/clear', {
      method: 'POST'
    }, settings);

    if (response.ok) {
      const data = await response.json();
      return { success: true, message: data.message || 'Sync history cleared' };
    }
    return { success: true, message: 'Local sync history cleared' };
  } catch {
    return { success: true, message: 'Local sync history cleared' };
  }
}

/**
 * Checks if the current batch has already been synced successfully in the past
 */
export function checkDuplicateBatch(entries: TransactionEntry[]): {
  isDuplicate: boolean;
  lastRecord?: TallySyncRecord;
} {
  if (entries.length === 0) return { isDuplicate: false };

  const currentSignature = computeBatchSignature(entries);
  const history = loadSyncHistory();

  const match = history.find(h => h.batchSignature === currentSignature && (h.status === 'SUCCESS' || h.created > 0));
  if (match) {
    return { isDuplicate: true, lastRecord: match };
  }

  return { isDuplicate: false };
}
