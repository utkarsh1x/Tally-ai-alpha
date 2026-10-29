import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  ShieldCheck, 
  UserCheck, 
  FileCheck2, 
  UploadCloud, 
  Edit3, 
  Send, 
  AlertOctagon,
  Clock
} from 'lucide-react';
import { AuditLog } from '../types';
import { getTodayLocalDateISO } from '../utils/formatters';

interface AuditTrailViewProps {
  logs: AuditLog[];
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ logs }) => {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filteredLogs = logs.filter(log => {
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        log.userName.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.targetId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'APPROVE':
      case 'BATCH_APPROVE':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">APPROVE</span>;
      case 'REJECT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">REJECT</span>;
      case 'EDIT_FIELD':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">FIELD EDIT</span>;
      case 'UPLOAD':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">UPLOAD</span>;
      case 'AI_EXTRACT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">AI OCR</span>;
      case 'DIRECT_SYNC':
      case 'EXPORT_TALLY_XML':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">TALLY SYNC</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300">{action}</span>;
    }
  };

  const handleExportAuditCsv = () => {
    const csvContent = [
      ['Timestamp', 'User', 'Role', 'Action', 'Target ID', 'Details'].join(','),
      ...filteredLogs.map(l => [
        `"${l.timestamp}"`,
        `"${l.userName}"`,
        `"${l.userRole}"`,
        `"${l.action}"`,
        `"${l.targetId}"`,
        `"${l.details.replace(/"/g, '""')}"`
      ].join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TallyAI_Audit_Trail_${getTodayLocalDateISO()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      
      {/* Header */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-[#5F1915] dark:text-[#ffb4ab]" />
            Statutory Audit Trail &amp; Version History (Companies Act Sec 143 / CARO 2020)
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Immutable log of all accountant modifications, approvals, AI extractions, and Tally exports.
          </p>
        </div>

        <button
          onClick={handleExportAuditCsv}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#5F1915] hover:bg-[#491310] text-white rounded text-xs font-bold shadow-2xs transition-colors"
        >
          <Download className="w-4 h-4 text-amber-300" />
          <span>Export Audit Log (.csv)</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-300 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by auditor name, voucher reference, details..."
            className="w-full bg-slate-50 border border-slate-300 rounded pl-9 pr-3 py-1.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#5F1915]"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded px-2.5 py-1.5 focus:outline-none font-semibold cursor-pointer"
          >
            <option value="ALL">All Statutory Actions</option>
            <option value="APPROVE">CA Approvals</option>
            <option value="REJECT">Rejections</option>
            <option value="EDIT_FIELD">Field Corrections</option>
            <option value="UPLOAD">Document Ingestions</option>
            <option value="AI_EXTRACT">OCR Extractions</option>
            <option value="DIRECT_SYNC">Tally Gateway Syncs</option>
          </select>
        </div>
      </div>

      {/* Timeline list */}
      <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-2xs">
        <div className="divide-y divide-slate-200">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <span className="text-xs font-bold text-slate-700 block">No Audit Trail Events Recorded Yet</span>
              <span className="text-[11px] text-slate-500">User approvals, field edits, and Tally sync logs will appear here under Section 143 of Companies Act.</span>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start space-x-3.5">
                <div className="p-2 rounded bg-slate-100 border border-slate-300 shrink-0 text-slate-700 mt-0.5">
                  <Clock className="w-4 h-4 text-[#5F1915] dark:text-[#ffb4ab]" />
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-xs">{log.userName}</span>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                        {log.userRole}
                      </span>
                      {getActionBadge(log.action)}
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 font-semibold">{log.timestamp}</span>
                  </div>

                  <p className="text-xs text-slate-800 font-medium">
                    {log.details}
                  </p>

                  <div className="text-[11px] font-mono text-slate-500">
                    Target Entity: <span className="text-[#5F1915] dark:text-[#ffb4ab] font-bold">{log.targetId}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
};
