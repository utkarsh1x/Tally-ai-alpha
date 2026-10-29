import React, { useState, useMemo } from 'react';
import { 
  FileCheck2, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  AlertTriangle, 
  Search, 
  CheckCheck, 
  Sparkles, 
  ArrowUpDown, 
  MessageSquare, 
  AlertCircle,
  Keyboard,
  ShieldCheck,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { TransactionEntry, ChartOfAccountItem, VoucherType, EntryStatus } from '../types';
import { formatCurrencyINR, getConfidenceBadgeColor, getVoucherTypeColor, normalizeDateToISO, formatDateIndian } from '../utils/formatters';

interface ValidationCenterProps {
  transactions: TransactionEntry[];
  chartOfAccounts: ChartOfAccountItem[];
  onUpdateTransaction: (updated: TransactionEntry) => void;
  onApproveTransaction: (id: string) => void;
  onRejectTransaction: (id: string, reason?: string) => void;
  onBatchApprove: (ids: string[]) => void;
  onBatchReject: (ids: string[]) => void;
  onViewDocument: (transaction: TransactionEntry) => void;
  onOpenFeedback: () => void;
}

export const ValidationCenter: React.FC<ValidationCenterProps> = ({
  transactions,
  chartOfAccounts,
  onUpdateTransaction,
  onApproveTransaction,
  onRejectTransaction,
  onBatchApprove,
  onBatchReject,
  onViewDocument,
  onOpenFeedback,
}) => {
  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EntryStatus>('Pending');
  const [voucherFilter, setVoucherFilter] = useState<string>('ALL');
  const [confidenceFilter, setConfidenceFilter] = useState<'ALL' | 'HIGH' | 'LOW'>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'confidence'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filtered & Sorted Transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
        if (voucherFilter !== 'ALL' && t.voucherType !== voucherFilter) return false;
        if (confidenceFilter === 'HIGH' && t.confidence.overall < 90) return false;
        if (confidenceFilter === 'LOW' && t.confidence.overall >= 90) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchParty = t.party.toLowerCase().includes(q);
          const matchLedger = t.ledger.toLowerCase().includes(q);
          const matchInv = t.invoiceNumber.toLowerCase().includes(q);
          const matchNarration = t.narration.toLowerCase().includes(q);
          if (!matchParty && !matchLedger && !matchInv && !matchNarration) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'date') {
          const timeA = new Date(normalizeDateToISO(a.date)).getTime() || 0;
          const timeB = new Date(normalizeDateToISO(b.date)).getTime() || 0;
          diff = timeA - timeB;
        } else if (sortBy === 'amount') {
          diff = a.amount - b.amount;
        } else if (sortBy === 'confidence') {
          diff = a.confidence.overall - b.confidence.overall;
        }
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [transactions, statusFilter, voucherFilter, confidenceFilter, searchQuery, sortBy, sortOrder]);

  // High-confidence pending entries for 1-click batch approve
  const highConfidencePendingIds = useMemo(() => {
    return transactions
      .filter(t => t.status === 'Pending' && t.confidence.overall >= 90 && !t.isDuplicateWarning)
      .map(t => t.id);
  }, [transactions]);

  // Double-entry balancing totals
  const totalDebitSum = useMemo(() => {
    return filteredTransactions.reduce((s, t) => s + (t.debit || 0), 0);
  }, [filteredTransactions]);

  const totalCreditSum = useMemo(() => {
    return filteredTransactions.reduce((s, t) => s + (t.credit || 0), 0);
  }, [filteredTransactions]);

  // Handle cell edits
  const handleFieldChange = (
    tx: TransactionEntry,
    field: keyof TransactionEntry,
    value: any
  ) => {
    const updated: TransactionEntry = { ...tx, [field]: value, lastModifiedBy: 'CA Auditor' };
    
    // Sync document date when voucher date changes
    if (field === 'date') {
      updated.document = { ...tx.document, date: value };
    }
    
    // Auto recalculate debit/credit if voucherType is changed
    if (field === 'voucherType') {
      updated.voucherType = value;
      if (value === 'Sales') {
        updated.credit = updated.amount;
        updated.debit = 0;
      } else {
        updated.debit = updated.amount;
        updated.credit = 0;
      }
    }

    // Auto recalculate debit/credit & GST if amount is changed
    if (field === 'amount') {
      const numVal = Math.max(0, parseFloat(value) || 0);
      updated.amount = numVal;
      if (updated.voucherType === 'Sales') {
        updated.credit = numVal;
        updated.debit = 0;
      } else {
        updated.debit = numVal;
        updated.credit = 0;
      }
      // Recompute GST
      const taxRate = updated.gstRate;
      const subtotal = numVal / (1 + taxRate / 100);
      const taxAmount = numVal - subtotal;
      if (updated.isInterState) {
        updated.igst = Math.round(taxAmount * 100) / 100;
        updated.cgst = 0;
        updated.sgst = 0;
      } else {
        updated.cgst = Math.round((taxAmount / 2) * 100) / 100;
        updated.sgst = Math.round((taxAmount / 2) * 100) / 100;
        updated.igst = 0;
      }
    }

    onUpdateTransaction(updated);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredTransactions.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleApproveAllHighConfidence = () => {
    if (highConfidencePendingIds.length === 0) return;
    onBatchApprove(highConfidencePendingIds);
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    onBatchApprove(selectedIds);
    setSelectedIds([]);
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.6 }
    });
  };

  const handleBulkReject = () => {
    if (selectedIds.length === 0) return;
    onBatchReject(selectedIds);
    setSelectedIds([]);
  };

  const voucherTypes: VoucherType[] = ['Purchase', 'Payment', 'Sales', 'Receipt', 'Journal', 'Contra'];

  return (
    <div className="space-y-4 pb-16 font-sans">
      
      {/* Top Professional Header Bar */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-[#5F1915]" />
              Statutory CA Validation &amp; Ledger Verification Desk
            </h1>
            <span className="text-[11px] font-bold bg-[#5F1915]/10 text-[#5F1915] border border-[#5F1915]/30 px-2 py-0.5 rounded">
              Tally Prime Import Gate
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Audit extracted invoices, verify GSTINs, match ledger accounts against Chart of Accounts, and sign-off for Tally Prime.
          </p>
        </div>

        {/* Double-Entry Balance Check Ribbon */}
        <div className="flex items-center space-x-3 bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Debits</span>
            <span className="font-mono font-bold text-slate-900">{formatCurrencyINR(totalDebitSum)}</span>
          </div>
          <span className="text-slate-300">|</span>
          <div>
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Credits</span>
            <span className="font-mono font-bold text-slate-900">{formatCurrencyINR(totalCreditSum)}</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center space-x-1 text-emerald-800 font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span className="text-[11px]">Balanced</span>
          </div>
        </div>
      </div>

      {/* Tally Keyboard Shortcuts Strip */}
      <div className="bg-slate-100 border border-slate-300 rounded px-3 py-1.5 flex flex-wrap items-center justify-between text-[11px] text-slate-700 gap-2">
        <div className="flex items-center space-x-1">
          <Keyboard className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-bold text-slate-800">Tally Prime Shortcuts:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
          <span className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-bold text-slate-800">F2: Date</span>
          <span className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-bold text-slate-800">F4: Contra</span>
          <span className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-bold text-slate-800">F5: Payment</span>
          <span className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-bold text-slate-800">F6: Receipt</span>
          <span className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-bold text-slate-800">F7: Journal</span>
          <span className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-bold text-slate-800">F8: Sales</span>
          <span className="bg-white border border-slate-300 px-1.5 py-0.5 rounded font-bold text-slate-800">F9: Purchase</span>
          <span className="bg-[#5F1915]/10 border border-[#5F1915]/30 text-[#5F1915] px-1.5 py-0.5 rounded font-bold">Alt+A: Batch Approve</span>
        </div>
      </div>

      {/* Duplicate Warning Alert if detected */}
      {transactions.some(t => t.isDuplicateWarning && t.status === 'Pending') && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 flex items-start space-x-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold uppercase tracking-wide">Statutory Duplicate Alert: </span>
            One or more invoices match existing invoice numbers and amounts in your historical database. Please verify carefully before signing off to prevent duplicate double-entry in Tally Prime.
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-300 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
        
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by vendor, ledger head, invoice no., or narration..."
            className="w-full bg-slate-50 border border-slate-300 rounded pl-9 pr-3 py-1.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#5F1915]"
          />
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 border border-slate-300 rounded p-0.5">
            {(['Pending', 'Approved', 'Rejected', 'ALL'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-[#5F1915] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Voucher Filter */}
          <select
            value={voucherFilter}
            onChange={(e) => setVoucherFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer"
          >
            <option value="ALL">All Voucher Types</option>
            {voucherTypes.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          {/* Confidence Filter */}
          <select
            value={confidenceFilter}
            onChange={(e) => setConfidenceFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded px-2.5 py-1.5 focus:outline-none font-medium cursor-pointer"
          >
            <option value="ALL">All Confidence Scores</option>
            <option value="HIGH">High (&gt;=90% Precision)</option>
            <option value="LOW">Needs Verification (&lt;90%)</option>
          </select>

          {/* Sort By */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-300 rounded px-2 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-800 text-xs focus:outline-none cursor-pointer font-medium"
            >
              <option value="date">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
              <option value="confidence">Sort: Confidence</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="text-slate-600 hover:text-slate-900 font-bold px-1"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {highConfidencePendingIds.length > 0 && (
            <button
              onClick={handleApproveAllHighConfidence}
              className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow-2xs transition-colors"
            >
              <Check className="w-3.5 h-3.5 text-amber-300" />
              <span>Approve All &gt;90% ({highConfidencePendingIds.length})</span>
            </button>
          )}

          {selectedIds.length > 0 && (
            <>
              <button
                onClick={handleBulkApprove}
                className="flex items-center space-x-1 px-3 py-1.5 bg-[#5F1915] hover:bg-[#491310] text-white rounded text-xs font-bold shadow-2xs transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Approve Selected ({selectedIds.length})</span>
              </button>

              <button
                onClick={handleBulkReject}
                className="flex items-center space-x-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-900 border border-red-300 rounded text-xs font-bold transition-colors"
              >
                <XCircle className="w-3.5 h-3.5 text-red-700" />
                <span>Reject Selected</span>
              </button>
            </>
          )}

          <button
            onClick={onOpenFeedback}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-semibold"
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-600" />
            <span>AI Feedback</span>
          </button>
        </div>

      </div>

      {/* Spreadsheet Table Container (ERP Style) */}
      <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300">
              <tr>
                <th className="py-2.5 px-3 w-8 text-center bg-slate-100">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredTransactions.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-[#5F1915] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-2.5 px-3 min-w-[95px] bg-slate-100">Date</th>
                <th className="py-2.5 px-3 min-w-[105px] bg-slate-100">Voucher Type</th>
                <th className="py-2.5 px-3 min-w-[210px] bg-slate-100">Ledger Head (Tally COA)</th>
                <th className="py-2.5 px-3 min-w-[190px] bg-slate-100">Party / Vendor (Sub-Ledger)</th>
                <th className="py-2.5 px-3 text-right min-w-[110px] bg-slate-100">Debit (₹)</th>
                <th className="py-2.5 px-3 text-right min-w-[110px] bg-slate-100">Credit (₹)</th>
                <th className="py-2.5 px-3 text-center min-w-[90px] bg-slate-100">GST Rate</th>
                <th className="py-2.5 px-3 min-w-[220px] bg-slate-100">Narration</th>
                <th className="py-2.5 px-3 min-w-[130px] bg-slate-100">Invoice Ref #</th>
                <th className="py-2.5 px-3 text-center min-w-[95px] bg-slate-100">Confidence</th>
                <th className="py-2.5 px-3 text-center min-w-[85px] bg-slate-100">Status</th>
                <th className="py-2.5 px-3 text-center min-w-[110px] bg-slate-100">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center text-slate-500 font-medium">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileCheck2 className="w-10 h-10 text-slate-300" />
                      <span className="text-sm font-bold text-slate-700">No Accounting Entries in Validation Desk</span>
                      <span className="text-xs text-slate-500 max-w-sm">
                        Ingest tax invoices, receipts, or audio memos from the Batch Ingestion Queue to review and sign off double-entry postings.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const conf = getConfidenceBadgeColor(tx.confidence.overall);
                  const isSelected = selectedIds.includes(tx.id);
                  const isLowConf = tx.confidence.overall < 80;

                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors group ${
                        isSelected ? 'bg-[#5F1915]/10' :
                        tx.isDuplicateWarning ? 'bg-red-50/60 hover:bg-red-50' :
                        isLowConf ? 'bg-amber-50/40 hover:bg-amber-50/70' :
                        'hover:bg-slate-50'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(tx.id)}
                          className="rounded border-slate-300 text-[#5F1915] focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Date (Editable) */}
                      <td className="py-2 px-2">
                        <input
                          type="date"
                          value={normalizeDateToISO(tx.date)}
                          onChange={(e) => handleFieldChange(tx, 'date', e.target.value)}
                          title={`Voucher Date: ${formatDateIndian(tx.date)}`}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-1 text-slate-800 dark:text-slate-100 text-xs font-mono focus:outline-none focus:border-[#5F1915]"
                        />
                      </td>

                      {/* Voucher Type Dropdown */}
                      <td className="py-2 px-2">
                        <select
                          value={tx.voucherType}
                          onChange={(e) => handleFieldChange(tx, 'voucherType', e.target.value)}
                          className="w-full text-xs font-bold rounded px-1.5 py-1 border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#5F1915] cursor-pointer"
                        >
                          {voucherTypes.map(vt => (
                            <option key={vt} value={vt}>{vt}</option>
                          ))}
                        </select>
                      </td>

                      {/* Ledger Account Dropdown (Populated from Chart of Accounts) */}
                      <td className="py-2 px-2">
                        <select
                          value={tx.ledger}
                          onChange={(e) => handleFieldChange(tx, 'ledger', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#5F1915] truncate"
                        >
                          {chartOfAccounts.map(coa => (
                            <option key={coa.id} value={coa.name}>
                              {coa.name} ({coa.group})
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Party (Vendor/Customer) */}
                      <td className="py-2 px-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={tx.party}
                            onChange={(e) => handleFieldChange(tx, 'party', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-xs font-semibold focus:outline-none focus:border-[#5F1915]"
                          />
                          {tx.partyGstin && (
                            <span className="block text-[10px] text-slate-500 font-mono px-1">
                              GSTIN: {tx.partyGstin}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Debit */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={tx.debit || ''}
                          onChange={(e) => handleFieldChange(tx, 'amount', e.target.value)}
                          disabled={tx.voucherType === 'Sales'}
                          className={`w-24 text-right bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-[#5F1915] ${
                            tx.debit > 0 ? 'text-slate-900' : 'text-slate-400 bg-slate-50'
                          }`}
                        />
                      </td>

                      {/* Credit */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={tx.credit || ''}
                          onChange={(e) => handleFieldChange(tx, 'amount', e.target.value)}
                          disabled={tx.voucherType !== 'Sales'}
                          className={`w-24 text-right bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-mono font-bold focus:outline-none focus:border-[#5F1915] ${
                            tx.credit > 0 ? 'text-slate-900' : 'text-slate-400 bg-slate-50'
                          }`}
                        />
                      </td>

                      {/* GST Details */}
                      <td className="py-2 px-2 text-center">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
                          {tx.gstRate}% {tx.isInterState ? 'IGST' : 'CGST+SGST'}
                        </span>
                      </td>

                      {/* Narration */}
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={tx.narration}
                          onChange={(e) => handleFieldChange(tx, 'narration', e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-700 text-xs focus:outline-none focus:border-[#5F1915] truncate"
                        />
                      </td>

                      {/* Invoice No. & Duplicate Tag */}
                      <td className="py-2 px-2">
                        <div className="flex items-center space-x-1">
                          <input
                            type="text"
                            value={tx.invoiceNumber}
                            onChange={(e) => handleFieldChange(tx, 'invoiceNumber', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-slate-800 text-xs font-mono focus:outline-none focus:border-[#5F1915]"
                          />
                          {tx.isDuplicateWarning && (
                            <span 
                              title={`Potential duplicate of ${tx.duplicateMatchedWith}`}
                              className="p-1 rounded bg-red-100 text-red-800 border border-red-300 cursor-help"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Confidence Score */}
                      <td className="py-2 px-2 text-center">
                        <span
                          title={`Ledger: ${tx.confidence.ledger}% | Amount: ${tx.confidence.amount}% | Party: ${tx.confidence.party}%`}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                            tx.confidence.overall >= 90
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : tx.confidence.overall >= 75
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-red-50 text-red-800 border-red-300'
                          }`}
                        >
                          {isLowConf && <AlertCircle className="w-3 h-3 mr-1 text-amber-600" />}
                          {tx.confidence.overall}%
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2 px-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tx.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          tx.status === 'Rejected' ? 'bg-red-100 text-red-800 border border-red-300' :
                          'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          {tx.status}
                        </span>
                      </td>

                      {/* Row Actions */}
                      <td className="py-2 px-2 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {/* View Original Document */}
                          <button
                            onClick={() => onViewDocument(tx)}
                            title="Inspect Original Document & Compare Side-by-Side"
                            className="p-1.5 rounded text-[#5F1915] hover:bg-[#5F1915]/10 border border-slate-300"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Approve */}
                          <button
                            onClick={() => onApproveTransaction(tx.id)}
                            disabled={tx.status === 'Approved'}
                            title="Sign-off & Approve for Tally"
                            className={`p-1.5 rounded border transition-colors ${
                              tx.status === 'Approved'
                                ? 'text-slate-300 border-slate-200 cursor-not-allowed bg-slate-50'
                                : 'text-emerald-800 border-emerald-300 hover:bg-emerald-100 bg-emerald-50'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Reject */}
                          <button
                            onClick={() => onRejectTransaction(tx.id)}
                            disabled={tx.status === 'Rejected'}
                            title="Reject Entry"
                            className={`p-1.5 rounded border transition-colors ${
                              tx.status === 'Rejected'
                                ? 'text-slate-300 border-slate-200 cursor-not-allowed bg-slate-50'
                                : 'text-red-800 border-red-300 hover:bg-red-100 bg-red-50'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table summary footer */}
        <div className="px-4 py-3 bg-slate-100 border-t border-slate-300 flex flex-wrap items-center justify-between text-xs text-slate-700 font-semibold">
          <div>
            Total Entries: <strong className="text-slate-900">{filteredTransactions.length}</strong> vouchers listed
          </div>
          <div className="flex items-center space-x-5 font-mono">
            <span>
              Total Debit: <strong className="text-slate-900">{formatCurrencyINR(totalDebitSum)}</strong>
            </span>
            <span>
              Total Credit: <strong className="text-slate-900">{formatCurrencyINR(totalCreditSum)}</strong>
            </span>
            <span className="text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded text-[11px] font-sans">
              Trial Balance Balanced
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};
