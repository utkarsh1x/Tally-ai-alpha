/**
 * ==============================================================================
 * TallyAI Local Gateway Bridge (Node.js) - Hardened Security Edition
 * 
 * Purpose:
 * Runs locally on the user's workstation strictly bound to 127.0.0.1:9001.
 * Acts as a hardened, CORS-restricted HTTP proxy between authorized TallyAI apps
 * (local dev or official Render deployment) and TallyPrime (running on localhost:9000).
 * 
 * Security Controls:
 * 1. Binds strictly to 127.0.0.1 (never 0.0.0.0).
 * 2. Strict Origin allowlist (only local dev and *.onrender.com).
 * 3. Host header validation against DNS rebinding.
 * 4. Locked Tally target host (localhost/127.0.0.1 only, unless explicit override).
 * 5. Request-size limit (5MB) and early malformed JSON/XML rejection.
 * 6. Auth/Token validation support for all /api/tally/* endpoints.
 * 7. Verified success condition: never returns success:true if 0 vouchers created/altered.
 * ==============================================================================
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.BRIDGE_PORT || process.env.PORT, 10) || 9001;
const BIND_HOST = '127.0.0.1'; // STRICT: Loopback only. Do not bind to 0.0.0.0.
const DEFAULT_TALLY_HOST = process.env.TALLY_HOST || 'http://127.0.0.1';
const DEFAULT_TALLY_PORT = parseInt(process.env.TALLY_PORT, 10) || 9000;
export const DEFAULT_BRIDGE_TOKEN = 'tallyai_local_bridge_sec_v1';

export function getEffectiveBridgeToken() {
  return (
    process.env.VITE_TALLY_BRIDGE_TOKEN ||
    process.env.BRIDGE_TOKEN || 
    process.env.TALLY_BRIDGE_TOKEN || 
    DEFAULT_BRIDGE_TOKEN
  ).trim();
}
const MAX_REQUEST_SIZE = 5 * 1024 * 1024; // 5 MB max payload limit
const ALLOW_REMOTE_TALLY = process.env.ALLOW_REMOTE_TALLY === 'true';
const HISTORY_FILE = path.join(__dirname, 'sync-history.json');

// Ensure history file exists
if (!fs.existsSync(HISTORY_FILE)) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Bridge] Could not initialize sync-history.json:', err.message);
  }
}

function readHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      return JSON.parse(data || '[]');
    }
  } catch (err) {
    console.warn('[Bridge] Error reading history file:', err.message);
  }
  return [];
}

function saveHistory(record) {
  try {
    const list = readHistory();
    list.unshift(record); // newest first
    // keep latest 100 entries
    const trimmed = list.slice(0, 100);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Bridge] Error saving history file:', err.message);
  }
}

/**
 * Strict Origin Allowlist:
 * Allows only TallyAI local dev/preview environments and Render domains.
 */
const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i,
  /^https:\/\/([a-zA-Z0-9-]+\.)*onrender\.com$/i
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  const trimmed = origin.trim();

  for (const pattern of ALLOWED_ORIGIN_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  if (process.env.ALLOWED_ORIGINS) {
    const customList = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim().toLowerCase());
    if (customList.includes(trimmed.toLowerCase())) return true;
  }

  return false;
}

/**
 * Validates Host header to defend against DNS rebinding attacks.
 */
function isHostValid(hostHeader) {
  if (!hostHeader) return false;
  const host = hostHeader.trim().toLowerCase();
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
}

/**
 * Applies strict CORS headers if origin is allowlisted.
 * Returns true if allowed, false if rejected.
 */
function applyCors(req, res) {
  const origin = req.headers.origin;

  if (origin) {
    if (isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept, X-Bridge-Token, X-Tally-Token');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
      res.setHeader('Vary', 'Origin');
      return true;
    } else {
      // Disallowed Origin
      return false;
    }
  }

  // Non-browser or direct loopback request (no Origin header)
  return true;
}

/**
 * Validates and locks down target Tally host to prevent SSRF.
 * Strictly requires localhost or 127.0.0.1 unless ALLOW_REMOTE_TALLY=true.
 */
function resolveAndLockTallyTarget(inputHost, inputPort) {
  let rawHost = String(inputHost || DEFAULT_TALLY_HOST).trim();
  if (!rawHost.startsWith('http://') && !rawHost.startsWith('https://')) {
    rawHost = `http://${rawHost}`;
  }

  let parsed;
  try {
    parsed = new URL(rawHost);
  } catch {
    throw new Error(`Invalid Tally host URL format: ${inputHost}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';

  if (!isLoopback && !ALLOW_REMOTE_TALLY) {
    throw new Error(`Security restriction: Bridge is locked to localhost/127.0.0.1. Target '${hostname}' is disallowed.`);
  }

  const port = parseInt(inputPort || parsed.port || DEFAULT_TALLY_PORT, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid Tally port number: ${inputPort}`);
  }

  const protocol = parsed.protocol || 'http:';
  return {
    url: `${protocol}//${hostname}:${port}`,
    hostname,
    port
  };
}

/**
 * Auth & Token Validation for Protected Endpoints.
 * Checks Bearer header, X-Bridge-Token, query parameter, or JSON body.
 */
function extractAuthToken(req, parsedUrl, body) {
  const authHeader = req.headers['authorization'] || '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
  const headerToken = req.headers['x-bridge-token'] || req.headers['x-tally-token'] || bearer;
  const queryToken = parsedUrl.searchParams.get('token');
  const bodyToken = body && typeof body === 'object' ? (body.token || body.bridgeToken) : null;
  return headerToken || queryToken || bodyToken || '';
}

function isAuthorized(req, parsedUrl, body) {
  const requiredToken = getEffectiveBridgeToken();
  if (requiredToken) {
    const provided = extractAuthToken(req, parsedUrl, body);
    return Boolean(provided && provided === requiredToken);
  }
  return true;
}

/**
 * Parses Tally Prime's raw XML response into structured metrics.
 * Never reports success if 0 vouchers were created or altered.
 */
export function parseTallyResponse(rawXml) {
  const text = String(rawXml || '');
  
  const extractInt = (tag) => {
    const match = text.match(new RegExp(`<${tag}>\\s*(\\d+)\\s*<\\/${tag}>`, 'i'));
    return match ? parseInt(match[1], 10) : 0;
  };

  const created = extractInt('CREATED');
  const altered = extractInt('ALTERED');
  const deleted = extractInt('DELETED');
  const combined = extractInt('COMBINED');
  const errors = extractInt('ERRORS');
  const cancelled = extractInt('CANCELLED');

  // Extract all error messages (<LINEERROR>...</LINEERROR> or <ERROR>...</ERROR>)
  const errorDetails = [];
  const lineErrorRegex = /<LINEERROR>([\s\S]*?)<\/LINEERROR>/gi;
  let match;
  while ((match = lineErrorRegex.exec(text)) !== null) {
    const errText = match[1].replace(/<[^>]+>/g, '').trim();
    if (errText && !errorDetails.includes(errText)) {
      errorDetails.push(errText);
    }
  }

  const genericErrorRegex = /<ERROR>([\s\S]*?)<\/ERROR>/gi;
  while ((match = genericErrorRegex.exec(text)) !== null) {
    const errText = match[1].replace(/<[^>]+>/g, '').trim();
    if (errText && !errorDetails.includes(errText)) {
      errorDetails.push(errText);
    }
  }

  // Determine overall status
  let status = 'FAILED';
  let message = '';

  if (errors === 0 && (created > 0 || altered > 0)) {
    status = 'SUCCESS';
    message = `Successfully posted to TallyPrime! Created: ${created}, Altered: ${altered}.`;
  } else if (errors > 0 && (created > 0 || altered > 0)) {
    status = 'PARTIAL';
    message = `Partially synced to TallyPrime: ${created} created, ${altered} altered, ${errors} error(s).`;
  } else if (errors > 0) {
    status = 'FAILED';
    message = `TallyPrime rejected import with ${errors} error(s): ${errorDetails[0] || 'See error log.'}`;
  } else {
    // Both created and altered are 0, and errors is 0 (e.g. unrecognized or empty envelope)
    status = 'FAILED';
    message = errorDetails[0] || 'TallyPrime created 0 vouchers. Verify the active company name and ledger mappings.';
  }

  // Strict verified success flag
  const isRealSuccess = (status === 'SUCCESS' || status === 'PARTIAL') && (created > 0 || altered > 0);

  return {
    success: isRealSuccess,
    status,
    created,
    altered,
    deleted,
    combined,
    errors,
    cancelled,
    errorDetails,
    message,
    rawXml: text
  };
}

/**
 * Posts an XML payload directly to Tally Prime HTTP listener.
 */
function sendXmlToTally(targetUrl, xmlPayload, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return reject(new Error(`Invalid Tally URL format: ${targetUrl}`));
    }

    // Secondary security verification on hostname
    const hostname = parsedUrl.hostname.toLowerCase();
    const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
    if (!isLoopback && !ALLOW_REMOTE_TALLY) {
      return reject(new Error(`Security restriction: Outbound connection to '${hostname}' is prohibited.`));
    }

    const postData = Buffer.from(xmlPayload, 'utf-8');

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || DEFAULT_TALLY_PORT,
      path: parsedUrl.pathname || '/',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'Content-Length': postData.length,
        'Accept': 'text/xml, application/xml, */*'
      },
      timeout: timeoutMs
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf-8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: body
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Connection to TallyPrime timed out after ${timeoutMs / 1000}s at ${targetUrl}`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Tests TallyPrime connectivity and verifies whether the requested company is accessible.
 * 
 * Protocol Requirements:
 * - Uses TallyPrime's documented XML Export Collection request:
 *     <TALLYREQUEST>Export</TALLYREQUEST>
 *     <TYPE>COLLECTION</TYPE>
 *     <ID>List of Ledgers</ID>
 *     <SVCURRENTCOMPANY>exact configured company name</SVCURRENTCOMPANY>
 * - Also queries active companies (<ID>List of Companies</ID>) to establish loaded companies.
 * - Parses and inspects:
 *     - HTTP status
 *     - XML validity
 *     - Tally STATUS tag (e.g. <STATUS>1</STATUS> vs <STATUS>0</STATUS>)
 *     - <LINEERROR>, <ERROR>, <ERRORMSG>
 *     - Collection payload (<LEDGER> items in the requested company)
 * - Returns accurate, distinct boolean indicators:
 *     - bridgeOnline: boolean
 *     - tallyReachable: boolean
 *     - connected: boolean (only true when Tally is reachable and company is verified)
 *     - companyVerified: boolean
 *     - requestedCompany: string
 *     - activeCompany: string (only if genuinely verified from Tally response)
 *     - loadedCompanies: string[]
 * - NEVER uses requested company as a fallback active company.
 * - NEVER reports connected: true solely because Tally returned HTTP 200.
 */
async function testTallyConnection(tallyHost, tallyPort, targetCompany = '') {
  let target;
  const requestedCompany = String(targetCompany || '').trim();

  try {
    target = resolveAndLockTallyTarget(tallyHost, tallyPort);
  } catch (err) {
    return {
      bridgeOnline: true,
      tallyReachable: false,
      connected: false,
      companyVerified: false,
      requestedCompany,
      activeCompany: '',
      loadedCompanies: [],
      tallyRunning: false,
      tallyUrl: `${tallyHost}:${tallyPort}`,
      error: err.message,
      code: 'SECURITY_ERROR',
      troubleshooting: ['Use localhost or 127.0.0.1 as the TallyPrime host.']
    };
  }

  const tallyUrl = `${target.url}/`;

  // Step 1: Query currently loaded active companies from TallyPrime
  const companiesQueryXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>COLLECTION</TYPE>
    <ID>List of Companies</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

  let compRawRes;
  try {
    compRawRes = await sendXmlToTally(tallyUrl, companiesQueryXml, 6000);
  } catch (err) {
    const isConnRefused = err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED');
    const isTimeout = err.message.includes('timed out');

    return {
      bridgeOnline: true,
      tallyReachable: false,
      connected: false,
      companyVerified: false,
      requestedCompany,
      activeCompany: '',
      loadedCompanies: [],
      tallyRunning: false,
      tallyUrl: target.url,
      tallyHost: target.hostname,
      tallyPort: target.port,
      error: isConnRefused 
        ? `Cannot connect to TallyPrime at ${target.url} (Connection refused). Is TallyPrime open with port ${target.port} enabled?` 
        : isTimeout
        ? `Connection to TallyPrime at ${target.url} timed out.`
        : `TallyPrime connection error: ${err.message}`,
      code: err.code || 'UNKNOWN',
      troubleshooting: [
        '1. Open TallyPrime on this computer.',
        '2. In TallyPrime, press F1 (Help) > Settings > Connectivity.',
        '3. Set "Client/Server configuration" to "Both".',
        `4. Verify Port is set to ${target.port}.`,
        '5. Restart TallyPrime if you just changed connectivity settings.',
        '6. Ensure the company is open in TallyPrime.'
      ]
    };
  }

  // Tally responded! Check HTTP status and XML body
  const compBody = String(compRawRes.data || '').trim();
  if (!compBody) {
    return {
      bridgeOnline: true,
      tallyReachable: true,
      connected: false,
      companyVerified: false,
      requestedCompany,
      activeCompany: '',
      loadedCompanies: [],
      tallyRunning: true,
      tallyUrl: target.url,
      httpStatus: compRawRes.statusCode,
      error: 'TallyPrime returned an empty response.',
      message: 'TallyPrime reachable, company not verified.'
    };
  }

  // Extract any errors from the companies response
  const compErrors = [];
  const lineErrRegex = /<(?:LINEERROR|ERROR|ERRORMSG)>([\s\S]*?)<\/(?:LINEERROR|ERROR|ERRORMSG)>/gi;
  let m;
  while ((m = lineErrRegex.exec(compBody)) !== null) {
    const cleanErr = m[1].replace(/<[^>]+>/g, '').trim();
    if (cleanErr && !compErrors.includes(cleanErr)) {
      compErrors.push(cleanErr);
    }
  }

  // Extract company names
  const loadedCompanies = [];
  const companyBlockRegex = /<COMPANY[^>]*>([\s\S]*?)<\/COMPANY>/gi;
  let cMatch;
  while ((cMatch = companyBlockRegex.exec(compBody)) !== null) {
    const block = cMatch[1];
    const nameMatch = block.match(/<NAME[^>]*>([\s\S]*?)<\/NAME>/i);
    if (nameMatch) {
      const name = nameMatch[1].replace(/<[^>]+>/g, '').trim();
      if (name && !loadedCompanies.includes(name) && !name.startsWith('$$')) {
        loadedCompanies.push(name);
      }
    }
  }

  // Fallback: check COMPANY NAME attribute if present
  const compAttrRegex = /<COMPANY\s+[^>]*NAME="([^"]+)"/gi;
  while ((cMatch = compAttrRegex.exec(compBody)) !== null) {
    const attrName = cMatch[1].trim();
    if (attrName && !loadedCompanies.includes(attrName) && !attrName.startsWith('$$')) {
      loadedCompanies.push(attrName);
    }
  }

  // Check if Tally has STATUS 0
  const statusMatch = compBody.match(/<STATUS>\s*(\d+)\s*<\/STATUS>/i);
  const statusVal = statusMatch ? parseInt(statusMatch[1], 10) : null;
  if (statusVal === 0 || compErrors.length > 0) {
    return {
      bridgeOnline: true,
      tallyReachable: true,
      connected: false,
      companyVerified: false,
      requestedCompany,
      activeCompany: '',
      loadedCompanies,
      tallyRunning: true,
      tallyUrl: target.url,
      httpStatus: compRawRes.statusCode,
      error: compErrors[0] || 'TallyPrime returned STATUS 0 error during inspection.',
      message: 'TallyPrime reachable, company not verified.'
    };
  }

  // Step 2: Validate the requested company against TallyPrime
  // Note: loadedCompanies, requestedCompany, verifiedCompany, and activeCompany must NEVER be treated as interchangeable.
  // - loadedCompanies: all company books currently loaded in TallyPrime session.
  // - requestedCompany: the company target configured in TallyAI settings.
  // - verifiedCompany: the company confirmed to exist in loadedCompanies AND accessible.
  // - activeCompany: the company actively selected in TallyPrime session.
  let companyVerified = false;
  let verifiedCompany = '';
  let activeCompany = '';
  let ledgersCount = 0;
  let verificationError = '';

  if (requestedCompany) {
    // Check if the requested company is in loadedCompanies (exact or case-insensitive)
    const matchedLoadedCompany = loadedCompanies.find(c => c.toLowerCase() === requestedCompany.toLowerCase());

    const ledgerVerifyXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>COLLECTION</TYPE>
    <ID>List of Ledgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <SVCURRENTCOMPANY>${(matchedLoadedCompany || requestedCompany).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</SVCURRENTCOMPANY>
      </STATICVARIABLES>
      <FETCHLIST>
        <FETCH>NAME</FETCH>
      </FETCHLIST>
    </DESC>
  </BODY>
</ENVELOPE>`;

    try {
      const ledgerRes = await sendXmlToTally(tallyUrl, ledgerVerifyXml, 6000);
      const ledgerBody = String(ledgerRes.data || '').trim();

      // Check errors in ledger response
      const ledgerErrors = [];
      while ((m = lineErrRegex.exec(ledgerBody)) !== null) {
        const cleanErr = m[1].replace(/<[^>]+>/g, '').trim();
        if (cleanErr && !ledgerErrors.includes(cleanErr)) {
          ledgerErrors.push(cleanErr);
        }
      }

      const ledgerStatusMatch = ledgerBody.match(/<STATUS>\s*(\d+)\s*<\/STATUS>/i);
      const ledgerStatus = ledgerStatusMatch ? parseInt(ledgerStatusMatch[1], 10) : 1;

      // Count ledgers returned
      const ledgerMatches = ledgerBody.match(/<LEDGER\s+[^>]*NAME=/gi);
      ledgersCount = ledgerMatches ? ledgerMatches.length : 0;

      // Genuine verification requires:
      // 1. Tally returned STATUS 1 (not 0)
      // 2. No LINEERROR/ERRORMSG
      // 3. The requested company is in loadedCompanies
      // 4. Tally successfully returned ledger collection for this company (ledgersCount > 0)
      if (ledgerStatus !== 0 && ledgerErrors.length === 0 && matchedLoadedCompany && ledgersCount > 0) {
        companyVerified = true;
        verifiedCompany = matchedLoadedCompany;
        // activeCompany is only established when this verified company is confirmed active
        activeCompany = matchedLoadedCompany;
      } else {
        companyVerified = false;
        verifiedCompany = '';
        activeCompany = '';
        
        if (ledgerErrors.length > 0) {
          verificationError = ledgerErrors[0];
        } else if (!matchedLoadedCompany) {
          verificationError = loadedCompanies.length > 0
            ? `Requested company '${requestedCompany}' does not match loaded companies in TallyPrime: [${loadedCompanies.join(', ')}].`
            : `Requested company '${requestedCompany}' is not open in TallyPrime.`;
        } else if (ledgersCount === 0) {
          verificationError = `Company '${matchedLoadedCompany}' returned 0 ledgers from TallyPrime. Company may not be selected or active.`;
        } else {
          verificationError = `Company '${requestedCompany}' could not be verified in TallyPrime.`;
        }
      }
    } catch (verErr) {
      companyVerified = false;
      verifiedCompany = '';
      activeCompany = '';
      verificationError = `Failed verifying company '${requestedCompany}': ${verErr.message}`;
    }
  } else {
    // When no company was requested:
    // Never assume the first loaded company is active if multiple companies are loaded!
    companyVerified = false;
    verifiedCompany = '';
    activeCompany = '';
    if (loadedCompanies.length > 0) {
      verificationError = `No target company configured in TallyAI settings. Loaded companies in Tally: [${loadedCompanies.join(', ')}].`;
    } else {
      verificationError = 'No companies are currently open in TallyPrime.';
    }
  }

  const isConnected = companyVerified;
  const statusMessage = isConnected
    ? `TallyPrime connection verified. Active company: '${activeCompany}' (${ledgersCount} ledgers indexed).`
    : (loadedCompanies.length > 0
      ? `TallyPrime reachable, company not verified. Loaded companies in Tally: [${loadedCompanies.join(', ')}].`
      : 'TallyPrime reachable, company not verified.');

  return {
    bridgeOnline: true,
    tallyReachable: true,
    connected: isConnected,
    companyVerified,
    requestedCompany,
    verifiedCompany,
    activeCompany,
    loadedCompanies,
    ledgersCount,
    tallyRunning: true,
    tallyUrl: target.url,
    tallyHost: target.hostname,
    tallyPort: target.port,
    httpStatus: compRawRes.statusCode,
    error: isConnected ? undefined : (verificationError || (compErrors[0] || undefined)),
    message: statusMessage
  };
}
    tallyRunning: true,
    tallyUrl: target.url,
    tallyHost: target.hostname,
    tallyPort: target.port,
    httpStatus: compRawRes.statusCode,
    error: isConnected ? undefined : (verificationError || (compErrors[0] || undefined)),
    message: statusMessage
  };
}

/**
 * Safely parses JSON request body with a strict size limit.
 */
function parseJsonBody(req, maxSize = MAX_REQUEST_SIZE) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytesReceived = 0;

    req.on('data', chunk => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxSize) {
        req.destroy();
        const err = new Error(`Payload too large. Exceeds limit of ${Math.round(maxSize / (1024 * 1024))}MB`);
        err.statusCode = 413;
        reject(err);
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (e) {
        const err = new Error('Malformed JSON payload: ' + e.message);
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on('error', err => reject(err));
  });
}

// ==========================================
// Main HTTP Server
// ==========================================
const server = http.createServer(async (req, res) => {
  // 1. Validate Host Header (DNS Rebinding Guard)
  if (!isHostValid(req.headers.host)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden: Invalid Host header' }));
    return;
  }

  // 2. Strict Origin Allowlist Check & CORS Headers
  const corsAllowed = applyCors(req, res);
  if (!corsAllowed) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden: Origin is not permitted by TallyAI Bridge allowlist' }));
    return;
  }

  // Preflight OPTIONS handler
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${BIND_HOST}:${PORT}`);
  const pathname = parsedUrl.pathname;

  // 3. Health Check (Public diagnostics)
  if ((pathname === '/health' || pathname === '/api/health' || pathname === '/') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'TallyAI Local Gateway Bridge (Hardened)',
      version: '1.1.0',
      boundHost: BIND_HOST,
      port: PORT,
      defaultTallyUrl: `${DEFAULT_TALLY_HOST}:${DEFAULT_TALLY_PORT}`,
      authEnforced: Boolean(getEffectiveBridgeToken()),
      timestamp: new Date().toISOString()
    }, null, 2));
    return;
  }

  // Check if endpoint is a protected API endpoint
  const isProtectedEndpoint = 
    pathname === '/api/tally/test' ||
    pathname === '/api/tally/push' ||
    pathname === '/api/tally/history' ||
    pathname === '/api/tally/history/clear';

  let body = {};
  if (req.method === 'POST') {
    try {
      body = await parseJsonBody(req);
    } catch (bodyErr) {
      const code = bodyErr.statusCode || 400;
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: bodyErr.message || 'Invalid request payload'
      }));
      return;
    }
  }

  // 4. Token / Auth Validation
  if (isProtectedEndpoint && !isAuthorized(req, parsedUrl, body)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Unauthorized: Invalid or missing bridge authentication token',
      code: 'UNAUTHORIZED'
    }));
    return;
  }

  // 5. Test Connection Endpoint
  if (pathname === '/api/tally/test' && (req.method === 'POST' || req.method === 'GET')) {
    const host = body.tallyHost || parsedUrl.searchParams.get('host') || DEFAULT_TALLY_HOST;
    const port = parseInt(body.tallyPort || parsedUrl.searchParams.get('port'), 10) || DEFAULT_TALLY_PORT;
    const company = body.companyName || parsedUrl.searchParams.get('company') || '';

    const result = await testTallyConnection(host, port, company);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result, null, 2));
    return;
  }

  // 6. One-Click Push to Tally Endpoint
  if (pathname === '/api/tally/push' && req.method === 'POST') {
    try {
      const xml = body.xml;
      const tallyHost = body.tallyHost || DEFAULT_TALLY_HOST;
      const tallyPort = parseInt(body.tallyPort, 10) || DEFAULT_TALLY_PORT;
      const companyName = body.companyName || '';
      const batchId = body.batchId || `SYNC-${Date.now()}`;
      const voucherNumbers = body.voucherNumbers || [];

      // Early rejection of missing or malformed XML
      if (!xml || typeof xml !== 'string' || !xml.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          status: 'FAILED',
          message: 'Missing or empty XML payload in request body.'
        }));
        return;
      }

      const trimmedXml = xml.trim();
      if (!trimmedXml.includes('<ENVELOPE>') || !trimmedXml.includes('</ENVELOPE>')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          status: 'FAILED',
          message: 'Malformed XML payload: Missing root <ENVELOPE> tags required by TallyPrime.'
        }));
        return;
      }

      // Resolve and enforce loopback target
      const target = resolveAndLockTallyTarget(tallyHost, tallyPort);
      const targetUrl = `${target.url}/`;

      console.log(`[Bridge] Pushing XML batch (${(trimmedXml.length / 1024).toFixed(1)} KB) to TallyPrime at ${targetUrl}...`);

      const tallyRawRes = await sendXmlToTally(targetUrl, trimmedXml, 30000);
      const parsed = parseTallyResponse(tallyRawRes.data);

      const record = {
        id: `rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        batchId,
        companyName,
        targetEndpoint: targetUrl,
        totalVouchers: voucherNumbers.length || (parsed.created + parsed.errors),
        created: parsed.created,
        altered: parsed.altered,
        deleted: parsed.deleted,
        combined: parsed.combined,
        errors: parsed.errors,
        cancelled: parsed.cancelled,
        status: parsed.status,
        errorDetails: parsed.errorDetails,
        voucherNumbers,
        rawResponse: parsed.rawXml
      };

      // Save to persistent file history
      saveHistory(record);

      // Strict success verification: success is only true if vouchers were created or altered
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: parsed.success,
        status: parsed.status,
        created: parsed.created,
        altered: parsed.altered,
        deleted: parsed.deleted,
        combined: parsed.combined,
        errors: parsed.errors,
        cancelled: parsed.cancelled,
        errorDetails: parsed.errorDetails,
        message: parsed.message,
        rawXml: parsed.rawXml,
        batchId,
        timestamp: record.timestamp,
        record
      }, null, 2));
    } catch (err) {
      console.error('[Bridge] Push error:', err.message);
      const isConnRefused = err.code === 'ECONNREFUSED' || err.message.includes('ECONNREFUSED');
      
      const errorResponse = {
        success: false,
        status: 'FAILED',
        created: 0,
        altered: 0,
        errors: 1,
        errorDetails: [err.message],
        message: isConnRefused 
          ? `Could not reach TallyPrime at port ${DEFAULT_TALLY_PORT}. Make sure TallyPrime is running with Connectivity enabled.`
          : `Tally Gateway transmission failed: ${err.message}`,
        rawXml: ''
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(errorResponse, null, 2));
    }
    return;
  }

  // 7. Get Sync History Endpoint
  if (pathname === '/api/tally/history' && req.method === 'GET') {
    const history = readHistory();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: history.length, history }, null, 2));
    return;
  }

  // 8. Clear Sync History Endpoint
  if (pathname === '/api/tally/history/clear' && (req.method === 'POST' || req.method === 'DELETE')) {
    try {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Sync history cleared' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 404 Fallback
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found on TallyAI Bridge', path: pathname }));
});

// Start Server strictly on 127.0.0.1
export function startBridge(port = PORT) {
  return server.listen(port, BIND_HOST, () => {
    console.log(`=======================================================`);
    console.log(`🔌 TallyAI Local Gateway Bridge is ACTIVE`);
    console.log(`👉 Bound Strictly to:  http://${BIND_HOST}:${port}`);
    console.log(`👉 Target TallyPrime:   ${DEFAULT_TALLY_HOST}:${DEFAULT_TALLY_PORT}`);
    console.log(`👉 Health Check:        http://${BIND_HOST}:${port}/health`);
    console.log(`👉 Origin Allowlist:    localhost, 127.0.0.1, *.onrender.com`);
    console.log(`👉 DNS Rebinding Guard: Enabled (Host header validation)`);
    console.log(`👉 Target Host Lock:    ${ALLOW_REMOTE_TALLY ? 'Remote Allowed (Override)' : 'Locked to Loopback (localhost/127.0.0.1)'}`);
    console.log(`👉 Token Auth:          ${getEffectiveBridgeToken() ? 'Enforced' : 'Unset (Optional)'}`);
    console.log(`=======================================================`);
  });
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  startBridge();
}

export { server };
