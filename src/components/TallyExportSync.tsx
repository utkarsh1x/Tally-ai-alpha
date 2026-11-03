import React, { useState, useEffect, useMemo } from 'react';
import { 
  DownloadCloud, 
  FileSpreadsheet, 
  FileCode2, 
  Send, 
  AlertTriangle, 
  Terminal, 
  RefreshCw, 
  Copy, 
  Check, 
  Server,
  CheckCircle2,
  XCircle,
  AlertCircle,
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TransactionEntry, OrganizationSettings, TallySyncRecord } from '../types';
import { generateTallyXml, downloadXmlFile } from '../utils/tallyXmlGenerator';
import { generateCsv, downloadCsvFile } from '../utils/csvGenerator';
import { formatCurrencyINR, getTodayLocalDateISO, formatDateIndian } from '../utils/formatters';
import { 
  testTallyConnectionViaBridge, 
  pushToTallyViaBridge, 
  loadSyncHistory, 
  clearSyncHistory, 
  checkDuplicateBatch,
  getBridgeBaseUrl,
  fetchBridgeHistory,
  clearBridgeHistory
} from '../services/tallyBridgeService';

interface TallyExportSyncProps {
  transactions: TransactionEntry[];
  settings: OrganizationSettings;
  onRecordExportLog: (details: string) => void;
  tallyConnected: boolean;
  setTallyConnected: (connected: boolean) => void;
}

export const TallyExportSync: React.FC<TallyExportSyncProps> = ({
  transactions,
  settings,
  onRecordExportLog,
  tallyConnected,
  setTallyConnected,
}) => {
  const [activeTab, setActiveTab] = useState<'xml' | 'sync' | 'csv'>('xml');
  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Bridge & Gateway State
  const bridgeUrl = getBridgeBaseUrl(settings);
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  const [detectedCompany, setDetectedCompany] = useState<string>(settings.tallyCompanyName || '');
  
  // Real Sync Outcome State
  const [lastSyncRecord, setLastSyncRecord] = useState<TallySyncRecord | null>(null);
  const [showRawXml, setShowRawXml] = useState(false);
  const [syncHistory, setSyncHistory] = useState<TallySyncRecord[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<TallySyncRecord | null>(null);

  // Duplicate Batch Protection State
  const [allowDuplicateBatch, setAllowDuplicateBatch] = useState(false);

  // Live Gateway Protocol Console Logs
  const [syncLogs, setSyncLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] TallyAI Direct Integration Console initialized.`,
    `[${new Date().toLocaleTimeString()}] Local Bridge Target: ${bridgeUrl}`,
    `[${new Date().toLocaleTimeString()}] Target TallyPrime Endpoint: ${settings.tallyHost || 'http://localhost'}:${settings.tallyPort || 9000}`,
  ]);

  const approvedTransactions = useMemo(() => {
    return transactions.filter(t => t.status === 'Approved');
  }, [transactions]);

  const pendingTransactions = useMemo(() => {
    return transactions.filter(t => t.status === 'Pending');
  }, [transactions]);

  // Check for duplicate invoices in the approved batch
  const approvedDuplicates = useMemo(() => {
    return approvedTransactions.filter(t => t.isDuplicateWarning);
  }, [approvedTransactions]);

  // Check if this exact approved batch was already synced in past history
  const duplicateBatchCheck = useMemo(() => {
    return checkDuplicateBatch(approvedTransactions);
  }, [approvedTransactions, syncHistory]);

  // Load sync history on mount (tries bridge history, falls back to localStorage)
  useEffect(() => {
    let isMounted = true;
    const initHistory = async () => {
      const local = loadSyncHistory();
      if (local.length > 0 && isMounted) {
        setSyncHistory(local);
      }
      try {
        const remote = await fetchBridgeHistory(settings);
        if (remote.success && remote.history.length > 0 && isMounted) {
          setSyncHistory(remote.history);
        }
      } catch {
        // Bridge may be initializing, local fallback already loaded
      }
    };
    initHistory();
    return () => { isMounted = false; };
  }, [settings]);

  const generatedXml = useMemo(() => {
    return generateTallyXml(approvedTransactions, detectedCompany || settings.tallyCompanyName);
  }, [approvedTransactions, detectedCompany, settings.tallyCompanyName]);

  const generatedCsv = useMemo(() => {
    return generateCsv(approvedTransactions);
  }, [approvedTransactions]);

  const handleCopyXml = () => {
    navigator.clipboard.writeText(generatedXml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadXml = () => {
    downloadXmlFile(generatedXml, `Tally_Vouchers_${(detectedCompany || settings.companyName || 'Export').replace(/\s+/g, '_')}.xml`);
    onRecordExportLog(`Exported ${approvedTransactions.length} approved vouchers to Tally XML file`);
    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  const handleDownloadCsv = () => {
    downloadCsvFile(generatedCsv, `TallyAI_Ledger_Export_${getTodayLocalDateISO()}.csv`);
    onRecordExportLog(`Exported ${approvedTransactions.length} vouchers to CSV/Excel report`);
  };

  /**
   * Real Test Connection via Bridge
   */
  const handleTestConnection = async () => {
    setIsTesting(true);
    const now = new Date().toLocaleTimeString();
    setSyncLogs(prev => [
      ...prev,
      `----------------------------------------`,
      `[${now}] [PING] Contacting TallyAI Bridge at ${bridgeUrl}...`,
    ]);

    try {
      const result = await testTallyConnectionViaBridge(settings);
      const timeStr = new Date().toLocaleTimeString();

      if (result.bridgeOnline) {
        setBridgeOnline(true);
        if (result.connected && result.tallyRunning) {
          setTallyConnected(true);
          if (result.activeCompany) {
            setDetectedCompany(result.activeCompany);
          }
          setSyncLogs(prev => [
            ...prev,
            `[${timeStr}] [BRIDGE ONLINE] Local TallyAI Bridge is active on port 9001.`,
            `[${timeStr}] [TALLY ONLINE] ${result.message}`,
            `[${timeStr}] [ACTIVE COMPANY] '${result.activeCompany || 'Default Company'}'`,
            `[${timeStr}] [READY] Socket ready for one-click XML voucher push!`,
          ]);
        } else {
          setTallyConnected(false);
          setSyncLogs(prev => [
            ...prev,
            `[${timeStr}] [BRIDGE ONLINE] Local TallyAI Bridge is active on port 9001.`,
            `[${timeStr}] [TALLY OFFLINE] ${result.error}`,
            ...(result.troubleshooting ? result.troubleshooting.map(t => `[${timeStr}] [DIAGNOSTIC] ${t}`) : []),
          ]);
        }
      } else {
        setBridgeOnline(false);
        setTallyConnected(false);
        setSyncLogs(prev => [
          ...prev,
          `[${timeStr}] [BRIDGE OFFLINE] ${result.error}`,
          ...(result.troubleshooting ? result.troubleshooting.map(t => `[${timeStr}] [ACTION REQUIRED] ${t}`) : []),
        ]);
      }
    } catch (err: any) {
      const timeStr = new Date().toLocaleTimeString();
      setBridgeOnline(false);
      setTallyConnected(false);
      setSyncLogs(prev => [
        ...prev,
        `[${timeStr}] [ERROR] Gateway communication failure: ${err.message}`,
      ]);
    } finally {
      setIsTesting(false);
    }
  };

  /**
   * Real One-Click Push to TallyPrime via Bridge
   */
  const handleOneClickSync = async () => {
    if (approvedTransactions.length === 0) return;

    // Duplicate Batch Protection Check
    if (duplicateBatchCheck.isDuplicate && !allowDuplicateBatch) {
      const timeStr = new Date().toLocaleTimeString();
      setSyncLogs(prev => [
        ...prev,
        `----------------------------------------`,
        `[${timeStr}] [DUPLICATE BATCH DETECTED] This exact batch of ${approvedTransactions.length} vouchers was already synced to TallyPrime!`,
        `[${timeStr}] [PREVIOUS SYNC] Date: ${formatDateIndian(duplicateBatchCheck.lastRecord?.timestamp)} (Batch ID: ${duplicateBatchCheck.lastRecord?.batchId}).`,
        `[${timeStr}] [PROTECTION] Re-pushing is blocked to prevent duplicate accounting vouchers. To re-push anyway, check "Allow Duplicate Re-Sync" below.`,
      ]);
      return;
    }

    setIsSyncing(true);
    const batchId = `SYNC-${Date.now().toString().slice(-6)}`;
    const timeStr = new Date().toLocaleTimeString();

    setSyncLogs(prev => [
      ...prev,
      `----------------------------------------`,
      `[${timeStr}] [SYNC START] Initiating real voucher push for Batch ${batchId}...`,
      `[${timeStr}] Validating ${approvedTransactions.length} approved vouchers...`,
      `[${timeStr}] Encoding XML Payload (${(generatedXml.length / 1024).toFixed(1)} KB)...`,
      `[${timeStr}] Transmitting to TallyPrime via ${bridgeUrl}...`,
    ]);

    try {
      const record = await pushToTallyViaBridge(generatedXml, approvedTransactions, settings, batchId);
      const resTime = new Date().toLocaleTimeString();

      setLastSyncRecord(record);
      setSyncHistory(loadSyncHistory());

      setSyncLogs(prev => [
        ...prev,
        `[${resTime}] [TALLY RESPONSE RECEIVED]`,
        `[${resTime}] -> Created: ${record.created} voucher(s)`,
        `[${resTime}] -> Altered: ${record.altered} voucher(s)`,
        `[${resTime}] -> Errors: ${record.errors}`,
      ]);

      if (record.errorDetails && record.errorDetails.length > 0) {
        record.errorDetails.forEach(err => {
          setSyncLogs(prev => [
            ...prev,
            `[${resTime}] [TALLY ERROR] ${err}`,
          ]);
        });
      }

      if (record.status === 'SUCCESS') {
        setSyncLogs(prev => [
          ...prev,
          `[${resTime}] [SUCCESS] Successfully created ${record.created} vouchers in TallyPrime!`,
          `----------------------------------------`,
        ]);
        onRecordExportLog(`One-Click Synced ${record.created} vouchers into TallyPrime (${detectedCompany || settings.tallyCompanyName})`);
        confetti({
          particleCount: 110,
          spread: 85,
          origin: { y: 0.6 }
        });
      } else if (record.status === 'PARTIAL') {
        setSyncLogs(prev => [
          ...prev,
          `[${resTime}] [PARTIAL WARNING] ${record.created} vouchers created, but ${record.errors} failed. Check Tally errors above.`,
          `----------------------------------------`,
        ]);
        onRecordExportLog(`Partial Tally Sync: ${record.created} created, ${record.errors} errors`);
      } else {
        setSyncLogs(prev => [
          ...prev,
          `[${resTime}] [SYNC FAILED] TallyPrime rejected the voucher import. ${record.message || ''}`,
          `----------------------------------------`,
        ]);
        onRecordExportLog(`Tally Sync Failed: ${record.errorDetails?.[0] || 'TallyPrime rejected batch'}`);
      }
    } catch (err: any) {
      const errTime = new Date().toLocaleTimeString();
      setSyncLogs(prev => [
        ...prev,
        `[${errTime}] [TRANSMISSION ERROR] ${err.message}`,
        `[${errTime}] Ensure local TallyAI Bridge is running on port 9001 (npm run bridge).`,
        `----------------------------------------`,
      ]);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear your local Tally sync history?')) {
      await clearBridgeHistory(settings);
      setSyncHistory([]);
      setSyncLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Tally sync history cleared.`,
      ]);
    }
  };

  const handleClearLogs = () => {
    setSyncLogs([`[${new Date().toLocaleTimeString()}] Log console cleared.`]);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      
      {/* Title & Stats */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <DownloadCloud className="w-5 h-5 text-[#5F1915]" />
            Tally Prime 4.1 Integration &amp; Multi-Format Export Center
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Real bidirectional socket sync, Alt+O XML generation, and reviewable audit CSV reports.
          </p>
        </div>

        {/* Stats Badges */}
        <div className="flex items-center space-x-2">
          <div className="px-3 py-1.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold">
            {approvedTransactions.length} Approved ({formatCurrencyINR(approvedTransactions.reduce((s, t) => s + t.amount, 0))})
          </div>
          {pendingTransactions.length > 0 && (
            <div className="px-3 py-1.5 rounded bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold">
              {pendingTransactions.length} Pending Audit
            </div>
          )}
        </div>
      </div>

      {/* Duplicate warning alert if approved contains duplicates */}
      {approvedDuplicates.length > 0 && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-300 flex items-start space-x-3 text-xs text-red-900">
          <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <div>
            <strong className="font-bold uppercase">Duplicate Invoices Detected in Approved Batch: </strong>
            {approvedDuplicates.length} entries have identical invoice numbers and amounts. Please double-check to prevent duplicate posting into Tally Prime.
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-300 pb-2">
        <button
          onClick={() => setActiveTab('xml')}
          className={`flex items-center space-x-2 px-4 py-2 rounded text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'xml'
              ? 'bg-[#5F1915] text-white shadow-2xs'
              : 'text-slate-700 hover:text-slate-900 bg-white border border-slate-300'
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          <span>Tally XML Generator (Alt+O Schema)</span>
        </button>

        <button
          onClick={() => setActiveTab('sync')}
          className={`flex items-center space-x-2 px-4 py-2 rounded text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'sync'
              ? 'bg-[#5F1915] text-white shadow-2xs'
              : 'text-slate-700 hover:text-slate-900 bg-white border border-slate-300'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>One-Click Gateway Push (Port 9000)</span>
          {tallyConnected && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('csv')}
          className={`flex items-center space-x-2 px-4 py-2 rounded text-xs font-bold transition-colors cursor-pointer ${
            activeTab === 'csv'
              ? 'bg-[#5F1915] text-white shadow-2xs'
              : 'text-slate-700 hover:text-slate-900 bg-white border border-slate-300'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Excel / CSV Audit Report</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: Tally XML Generator                              */}
      {/* ======================================================== */}
      {activeTab === 'xml' && (
        <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-[#5F1915]" />
                Tally Prime XML Schema Export
              </h3>
              <p className="text-xs text-slate-500">
                Generated XML contains root &lt;ENVELOPE&gt;, &lt;VOUCHER&gt;, and balanced &lt;ALLLEDGERENTRIES.LIST&gt;
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyXml}
                disabled={approvedTransactions.length === 0}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy XML'}</span>
              </button>

              <button
                onClick={handleDownloadXml}
                disabled={approvedTransactions.length === 0}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#5F1915] hover:bg-[#491310] text-white rounded text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <DownloadCloud className="w-4 h-4 text-amber-300" />
                <span>Download Tally XML (.xml)</span>
              </button>
            </div>
          </div>

          {/* XML Code Viewer */}
          <div className="relative rounded bg-slate-900 border border-slate-800 p-4 font-mono text-xs overflow-x-auto max-h-[460px]">
            {approvedTransactions.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                No approved transactions found. Please sign off entries in the CA Validation Desk first to generate Tally XML.
              </div>
            ) : (
              <pre className="text-emerald-300 whitespace-pre">
                {generatedXml}
              </pre>
            )}
          </div>

          {/* Tally Import Instructions */}
          <div className="p-3.5 rounded bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
            <span className="font-bold text-slate-900 block">Standard Procedure to Import in Tally Prime:</span>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open <strong>Tally Prime</strong> and select company: <code className="text-[#5F1915] font-mono font-bold">{detectedCompany || settings.tallyCompanyName || 'Your Active Company'}</code></li>
              <li>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 border border-slate-300 text-slate-800 font-mono font-bold">Alt + O</kbd> (Import menu) &rarr; Choose <strong>Transactions</strong></li>
              <li>Select file path: <code className="text-[#5F1915] font-mono font-bold">Tally_Vouchers_Export.xml</code> and press Enter</li>
              <li>Tally Prime will parse, validate ledgers, and post double-entry vouchers automatically!</li>
            </ol>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: Direct One-Click Sync (Real Gateway Integration)  */}
      {/* ======================================================== */}
      {activeTab === 'sync' && (
        <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs space-y-5">
          
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Server className="w-4 h-4 text-[#5F1915]" />
                Direct Tally Prime Gateway Sync (ODBC / HTTP)
              </h3>
              <p className="text-xs text-slate-500">
                Transmits validated accounting vouchers through the local TallyAI Bridge directly into live TallyPrime books
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleTestConnection}
                disabled={isTesting || isSyncing}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#5F1915] ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testing Ping...' : 'Test Gateway Ping'}</span>
              </button>

              <button
                onClick={handleOneClickSync}
                disabled={isSyncing || isTesting || approvedTransactions.length === 0}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#5F1915] hover:bg-[#491310] text-white rounded text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Transmitting to TallyPrime...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-amber-300" />
                    <span>One-Click Push to Tally</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Duplicate Batch Warning Banner */}
          {duplicateBatchCheck.isDuplicate && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-2">
              <div className="flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold uppercase tracking-wider block">Duplicate Batch Protection Active:</span>
                  <span>
                    This exact batch of {approvedTransactions.length} vouchers was already successfully synced to TallyPrime on{' '}
                    <strong>{duplicateBatchCheck.lastRecord?.timestamp ? formatDateIndian(duplicateBatchCheck.lastRecord.timestamp) : 'earlier'}</strong>{' '}
                    (Batch ID: <code className="font-mono font-bold">{duplicateBatchCheck.lastRecord?.batchId}</code>).
                  </span>
                </div>
              </div>

              <div className="pl-6.5 pt-1">
                <label className="flex items-center space-x-2 font-bold cursor-pointer text-slate-800">
                  <input
                    type="checkbox"
                    checked={allowDuplicateBatch}
                    onChange={(e) => setAllowDuplicateBatch(e.target.checked)}
                    className="rounded text-[#5F1915] focus:ring-0"
                  />
                  <span>Allow Re-Sync (Force re-importing this batch into TallyPrime)</span>
                </label>
              </div>
            </div>
          )}

          {/* Gateway Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            
            {/* Card 1: Local Bridge Status */}
            <div className="p-3.5 rounded bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[10px] font-bold uppercase">Local TallyAI Bridge</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  bridgeOnline === true ? 'bg-emerald-100 text-emerald-800' :
                  bridgeOnline === false ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {bridgeOnline === true ? 'ONLINE' : bridgeOnline === false ? 'OFFLINE' : 'STANDBY'}
                </span>
              </div>
              <span className="font-mono font-bold text-slate-900 text-xs mt-1 block truncate">
                {bridgeUrl}
              </span>
              <span className="text-slate-500 text-[10px] mt-0.5 inline-block">
                CORS &amp; Private Network Access Enabled
              </span>
            </div>

            {/* Card 2: TallyPrime Endpoint & Company */}
            <div className="p-3.5 rounded bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[10px] font-bold uppercase">TallyPrime Host &amp; Company</span>
              <div className="flex items-baseline space-x-1.5 mt-0.5">
                <span className="font-mono font-bold text-slate-900 text-xs">
                  {settings.tallyHost || 'http://localhost'}:{settings.tallyPort || 9000}
                </span>
              </div>
              <span className="font-bold text-[#5F1915] text-[11px] block truncate mt-0.5">
                {detectedCompany || settings.tallyCompanyName || 'Company: Active Tally Session'}
              </span>
            </div>

            {/* Card 3: Live Connection State */}
            <div className="p-3.5 rounded bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[10px] font-bold uppercase">Connection Status</span>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`w-2.5 h-2.5 rounded-full ${tallyConnected ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'}`}></span>
                <span className={`font-bold text-xs ${tallyConnected ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {tallyConnected ? 'CONNECTED TO TALLYPRIME' : 'DISCONNECTED / STANDBY'}
                </span>
              </div>
              <span className="text-slate-500 text-[10px] mt-0.5 inline-block">
                HTTP XML Protocol v4.1
              </span>
            </div>
          </div>

          {/* Real Outcome Display (When a push has executed) */}
          {lastSyncRecord && (
            <div className={`p-4 rounded-lg border text-xs space-y-2 animate-fadeIn ${
              lastSyncRecord.status === 'SUCCESS' ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950' :
              lastSyncRecord.status === 'PARTIAL' ? 'bg-amber-50/70 border-amber-300 text-amber-950' :
              'bg-rose-50/70 border-rose-300 text-rose-950'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  {lastSyncRecord.status === 'SUCCESS' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
                  {lastSyncRecord.status === 'PARTIAL' && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />}
                  {lastSyncRecord.status === 'FAILED' && <XCircle className="w-5 h-5 text-rose-600 shrink-0" />}
                  <div>
                    <span className="font-extrabold uppercase text-xs tracking-wider">
                      TallyPrime Import Result: {lastSyncRecord.status}
                    </span>
                    <p className="text-[11px] font-medium opacity-90 mt-0.5">
                      {lastSyncRecord.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 font-mono text-[11px] font-bold shrink-0">
                  <span className="px-2 py-0.5 rounded bg-white/80 border border-slate-200">
                    Created: <strong className="text-emerald-700">{lastSyncRecord.created}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/80 border border-slate-200">
                    Altered: <strong className="text-blue-700">{lastSyncRecord.altered}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/80 border border-slate-200">
                    Errors: <strong className={lastSyncRecord.errors > 0 ? 'text-rose-700' : 'text-slate-600'}>{lastSyncRecord.errors}</strong>
                  </span>
                </div>
              </div>

              {/* Error messages if any */}
              {lastSyncRecord.errorDetails && lastSyncRecord.errorDetails.length > 0 && (
                <div className="mt-2 p-2.5 rounded bg-white/90 border border-rose-200 text-rose-900 space-y-1">
                  <strong className="text-[10px] uppercase font-bold text-rose-700 block">TallyPrime Error Details:</strong>
                  <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px]">
                    {lastSyncRecord.errorDetails.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Toggle Raw Response */}
              {lastSyncRecord.rawResponse && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRawXml(!showRawXml)}
                    className="text-[11px] font-bold text-slate-700 hover:text-slate-900 underline flex items-center space-x-1 cursor-pointer"
                  >
                    <span>{showRawXml ? 'Hide Raw Tally XML Response' : 'Inspect Raw Tally XML Response'}</span>
                    {showRawXml ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showRawXml && (
                    <div className="mt-2 p-3 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-48">
                      <pre className="whitespace-pre">{lastSyncRecord.rawResponse}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Terminal Console Log */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1 px-1 font-bold">
              <span className="flex items-center gap-1.5 text-slate-800">
                <Terminal className="w-3.5 h-3.5 text-[#5F1915]" />
                Live Tally Gateway Protocol Console
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleClearLogs}
                  className="text-[10px] text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Clear Console
                </button>
                <span className="font-mono text-[10px] text-slate-500">UTF-8 XML Stream</span>
              </div>
            </div>
            <div className="rounded bg-slate-950 border border-slate-800 p-3.5 font-mono text-[11px] text-emerald-400 h-44 overflow-y-auto space-y-1">
              {syncLogs.map((log, i) => (
                <div key={i} className="leading-relaxed">
                  {log}
                </div>
              ))}
            </div>
          </div>

          {/* Persistent Sync History Section */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-[#5F1915]" />
                Persistent Tally Gateway Sync History ({syncHistory.length})
              </span>
              {syncHistory.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="text-[11px] text-slate-500 hover:text-rose-600 flex items-center space-x-1 cursor-pointer font-medium"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear History</span>
                </button>
              )}
            </div>

            {syncHistory.length === 0 ? (
              <div className="p-4 rounded bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                No past sync records found. Pushed batches will be recorded here with full audit traces.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Date / Time</th>
                      <th className="py-2 px-3">Batch ID</th>
                      <th className="py-2 px-3">Target Company</th>
                      <th className="py-2 px-3 text-center">Vouchers</th>
                      <th className="py-2 px-3 text-center">Created</th>
                      <th className="py-2 px-3 text-center">Errors</th>
                      <th className="py-2 px-3 text-center">Status</th>
                      <th className="py-2 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {syncHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                          {formatDateIndian(item.timestamp)} {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-800 text-[11px]">
                          {item.batchId}
                        </td>
                        <td className="py-2 px-3 text-slate-700 truncate max-w-[150px]">
                          {item.companyName}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-slate-800">
                          {item.totalVouchers}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-700">
                          {item.created}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-rose-700">
                          {item.errors}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            item.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            item.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedHistoryItem(item)}
                            className="text-[11px] font-bold text-[#5F1915] hover:underline cursor-pointer"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Troubleshooting Banner */}
          <div className="p-3.5 rounded bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
            <div className="flex items-center space-x-1.5 font-bold text-slate-900">
              <Info className="w-4 h-4 text-[#5F1915]" />
              <span>How the Local TallyAI Bridge Works:</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              To push vouchers from this web app (whether running locally or on Render Cloud) to your local TallyPrime instance:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pl-1 font-medium">
              <li>Keep <strong>TallyPrime</strong> open with port <strong>9000</strong> enabled (<code className="bg-white px-1 border rounded">F1 &gt; Settings &gt; Connectivity &gt; Client/Server configuration: Both</code>).</li>
              <li>Launch the bridge on your computer: run <code className="bg-white px-1.5 py-0.5 border border-slate-300 rounded font-mono font-bold text-[#5F1915]">npm run bridge</code> in your terminal (or double-click <code className="bg-white px-1.5 py-0.5 border border-slate-300 rounded font-mono font-bold text-[#5F1915]">start-bridge.bat</code>).</li>
              <li>Click <strong>Test Gateway Ping</strong> above. Once verified, click <strong>One-Click Push to Tally</strong> to import your vouchers directly!</li>
            </ol>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: Excel / CSV Report                                */}
      {/* ======================================================== */}
      {activeTab === 'csv' && (
        <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-800" />
                Excel &amp; CSV Audit Ledger Export
              </h3>
              <p className="text-xs text-slate-500">
                Summarized tabular export with full date, voucher type, ledger head, GST split, and audit sign-off
              </p>
            </div>

            <button
              onClick={handleDownloadCsv}
              disabled={approvedTransactions.length === 0}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
            >
              <DownloadCloud className="w-4 h-4 text-amber-300" />
              <span>Download Excel/CSV (.csv)</span>
            </button>
          </div>

          <div className="relative rounded bg-slate-900 border border-slate-800 p-4 font-mono text-xs overflow-x-auto max-h-[460px]">
            {approvedTransactions.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                No approved transactions available to preview.
              </div>
            ) : (
              <pre className="text-slate-200 whitespace-pre">
                {generatedCsv}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* History Inspection Modal */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-300 overflow-hidden space-y-4 animate-scaleUp">
            <div className="bg-slate-100 p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <History className="w-4 h-4 text-[#5F1915]" />
                  Tally Sync Audit Detail: {selectedHistoryItem.batchId}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatDateIndian(selectedHistoryItem.timestamp)} at {new Date(selectedHistoryItem.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistoryItem(null)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Status</span>
                  <span className={`font-bold text-xs inline-block mt-0.5 ${
                    selectedHistoryItem.status === 'SUCCESS' ? 'text-emerald-700' :
                    selectedHistoryItem.status === 'PARTIAL' ? 'text-amber-700' : 'text-rose-700'
                  }`}>
                    {selectedHistoryItem.status}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Target Company</span>
                  <span className="font-bold text-slate-900 text-xs block truncate mt-0.5">
                    {selectedHistoryItem.companyName}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 font-mono text-center">
                <div className="p-2 rounded bg-emerald-50 border border-emerald-200">
                  <span className="text-emerald-700 text-[10px] font-bold block">CREATED</span>
                  <span className="text-emerald-900 font-bold text-sm">{selectedHistoryItem.created}</span>
                </div>
                <div className="p-2 rounded bg-blue-50 border border-blue-200">
                  <span className="text-blue-700 text-[10px] font-bold block">ALTERED</span>
                  <span className="text-blue-900 font-bold text-sm">{selectedHistoryItem.altered}</span>
                </div>
                <div className="p-2 rounded bg-rose-50 border border-rose-200">
                  <span className="text-rose-700 text-[10px] font-bold block">ERRORS</span>
                  <span className="text-rose-900 font-bold text-sm">{selectedHistoryItem.errors}</span>
                </div>
              </div>

              {selectedHistoryItem.errorDetails && selectedHistoryItem.errorDetails.length > 0 && (
                <div className="p-3 rounded bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                  <span className="font-bold block text-[10px] uppercase">Reported Tally Errors:</span>
                  <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px]">
                    {selectedHistoryItem.errorDetails.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedHistoryItem.rawResponse && (
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Raw XML Response From Tally:</span>
                  <div className="p-3 rounded bg-slate-950 text-emerald-400 font-mono text-[11px] max-h-48 overflow-y-auto">
                    <pre className="whitespace-pre">{selectedHistoryItem.rawResponse}</pre>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setSelectedHistoryItem(null)}
                className="px-4 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
