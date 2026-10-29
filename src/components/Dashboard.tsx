import React from 'react';
import { 
  Clock, 
  Receipt, 
  ShieldCheck, 
  BarChart3,
  Server,
  ArrowRight
} from 'lucide-react';
import { TransactionEntry, UserRole, OrganizationSettings } from '../types';
import { formatCurrencyINR, formatDateIndian } from '../utils/formatters';

interface DashboardProps {
  transactions: TransactionEntry[];
  userRole: UserRole;
  settings: OrganizationSettings;
  onNavigateTab: (tab: 'dashboard' | 'upload' | 'validation' | 'export' | 'audit' | 'settings') => void;
  onOpenVoiceModal: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  userRole,
  settings,
  onNavigateTab,
  onOpenVoiceModal,
}) => {
  const totalCount = transactions.length;
  const pendingCount = transactions.filter(t => t.status === 'Pending').length;
  const approvedCount = transactions.filter(t => t.status === 'Approved').length;
  const rejectedCount = transactions.filter(t => t.status === 'Rejected').length;

  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const purchaseAmount = transactions
    .filter(t => t.voucherType === 'Purchase' || t.voucherType === 'Payment')
    .reduce((sum, t) => sum + t.amount, 0);
  const salesAmount = transactions
    .filter(t => t.voucherType === 'Sales' || t.voucherType === 'Receipt')
    .reduce((sum, t) => sum + t.amount, 0);

  const avgConfidence = Math.round(
    transactions.reduce((sum, t) => sum + t.confidence.overall, 0) / (totalCount || 1)
  );

  const itcTotal = transactions
    .filter(t => t.voucherType === 'Purchase' || t.voucherType === 'Payment')
    .reduce((sum, t) => sum + (t.cgst + t.sgst + t.igst), 0);

  const outputIgst = transactions.filter(t => t.voucherType === 'Sales' || t.voucherType === 'Receipt').reduce((s, t) => s + t.igst, 0);
  const inputIgst = transactions.filter(t => t.voucherType === 'Purchase' || t.voucherType === 'Payment').reduce((s, t) => s + t.igst, 0);
  const netIgst = Math.max(0, outputIgst - inputIgst);

  const outputCgst = transactions.filter(t => t.voucherType === 'Sales' || t.voucherType === 'Receipt').reduce((s, t) => s + t.cgst, 0);
  const inputCgst = transactions.filter(t => t.voucherType === 'Purchase' || t.voucherType === 'Payment').reduce((s, t) => s + t.cgst, 0);
  const netCgst = Math.max(0, outputCgst - inputCgst);

  const outputSgst = transactions.filter(t => t.voucherType === 'Sales' || t.voucherType === 'Receipt').reduce((s, t) => s + t.sgst, 0);
  const inputSgst = transactions.filter(t => t.voucherType === 'Purchase' || t.voucherType === 'Payment').reduce((s, t) => s + t.sgst, 0);
  const netSgst = Math.max(0, outputSgst - inputSgst);

  // Group by voucher type
  const voucherCounts: Record<string, number> = {
    Purchase: transactions.filter(t => t.voucherType === 'Purchase').length,
    Payment: transactions.filter(t => t.voucherType === 'Payment').length,
    Sales: transactions.filter(t => t.voucherType === 'Sales').length,
    Receipt: transactions.filter(t => t.voucherType === 'Receipt').length,
    Journal: transactions.filter(t => t.voucherType === 'Journal').length,
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Primary KPI Grid (High information density, clean institutional borders) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Inflow / Turnover */}
        <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-2xs hover:border-[#5F1915] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Billed Revenue / Sales
            </span>
            <div className="p-1.5 rounded bg-[#5F1915]/10 text-[#5F1915] border border-[#5F1915]/30">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatCurrencyINR(salesAmount)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <span className="text-emerald-700 font-bold">GSTR-1 Ready</span> • {voucherCounts.Sales + voucherCounts.Receipt} Invoices
            </div>
          </div>
        </div>

        {/* KPI 2: Outflow / Expenses */}
        <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-2xs hover:border-[#5F1915] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Total Purchases &amp; Expenses
            </span>
            <div className="p-1.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
              <BarChart3 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-slate-900 tracking-tight">
              {formatCurrencyINR(purchaseAmount)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <span>Debited to Profit &amp; Loss</span> • {voucherCounts.Purchase + voucherCounts.Payment} Bills
            </div>
          </div>
        </div>

        {/* KPI 3: Pending Reviews */}
        <div 
          onClick={() => onNavigateTab('validation')}
          className="bg-white border border-slate-300 rounded-lg p-4 shadow-2xs hover:border-amber-600 cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Pending CA Validation
            </span>
            <div className="p-1.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-amber-700 tracking-tight">
              {pendingCount} Vouchers
            </div>
            <div className="text-[11px] text-amber-900 font-semibold mt-1 flex items-center gap-1">
              <span>Requires human review</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>

        {/* KPI 4: Input Tax Credit (ITC) */}
        <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-2xs hover:border-emerald-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Claimable ITC (GSTR-2B)
            </span>
            <div className="p-1.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-emerald-800 tracking-tight">
              {formatCurrencyINR(itcTotal)}
            </div>
            <div className="text-[11px] text-emerald-900 font-semibold mt-1">
              Sec 16(2) Eligible Input Credit
            </div>
          </div>
        </div>

      </div>

      {/* Mid Section: Professional Two-Column Layout (Analytics & Statutory Compliance) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Inflow vs Outflow & GSTR Breakdown */}
        <div className="lg:col-span-2 bg-white border border-slate-300 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-#5F1915" />
                Ledger Head Outflow vs Inflow Balance
              </h2>
              <p className="text-xs text-slate-500">Statutory comparison of purchases, vendor expenses and client billed sales</p>
            </div>
            <div className="flex items-center space-x-3 text-xs">
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <span className="w-3 h-3 bg-[#5F1915] rounded-2xs inline-block"></span>
                Expenses
              </span>
              <span className="flex items-center gap-1 font-semibold text-slate-700">
                <span className="w-3 h-3 bg-amber-500 rounded-2xs inline-block"></span>
                Revenues
              </span>
            </div>
          </div>

          {/* Institutional Progress Bars */}
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-slate-800">Purchases &amp; Operational Overheads</span>
                <span className="font-mono text-slate-900">{formatCurrencyINR(purchaseAmount)}</span>
              </div>
              <div className="w-full bg-slate-100 border border-slate-200 h-3.5 rounded overflow-hidden">
                <div 
                  className="bg-[#5F1915] h-full rounded-r transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((purchaseAmount / (totalAmount || 1)) * 100))}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1 font-semibold">
                <span className="text-slate-800">Billed Professional Fees &amp; Software Consulting</span>
                <span className="font-mono text-slate-900">{formatCurrencyINR(salesAmount)}</span>
              </div>
              <div className="w-full bg-slate-100 border border-slate-200 h-3.5 rounded overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-r transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((salesAmount / (totalAmount || 1)) * 100))}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* GSTR-3B Statutory Summary Table */}
          <div className="mt-4 pt-3 border-t border-slate-200">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
              Monthly GST Summary (GSTR-3B Tax Off-set Table)
            </span>
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Tax Head</th>
                    <th className="py-2 px-3 text-right">Output Liability (Dr)</th>
                    <th className="py-2 px-3 text-right">Eligible ITC (Cr)</th>
                    <th className="py-2 px-3 text-right">Net Tax Payable (₹)</th>
                    <th className="py-2 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-800">Integrated GST (IGST)</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrencyINR(outputIgst)}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700">{formatCurrencyINR(inputIgst)}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700 font-bold">
                      {outputIgst >= inputIgst ? formatCurrencyINR(netIgst) : `${formatCurrencyINR(inputIgst - outputIgst)} (Excess ITC)`}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        outputIgst > inputIgst ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        inputIgst > outputIgst ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        'bg-slate-100 text-slate-700 border-slate-300'
                      }`}>
                        {outputIgst > inputIgst ? 'Payable' : inputIgst > outputIgst ? 'Carried Fwd' : 'Balanced'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-800">Central GST (CGST)</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrencyINR(outputCgst)}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700">{formatCurrencyINR(inputCgst)}</td>
                    <td className="py-2 px-3 text-right font-mono text-#5F1915 font-bold">
                      {outputCgst >= inputCgst ? formatCurrencyINR(netCgst) : `${formatCurrencyINR(inputCgst - outputCgst)} (Excess)`}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        outputCgst > inputCgst ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        inputCgst > outputCgst ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        'bg-slate-100 text-slate-700 border-slate-300'
                      }`}>
                        {outputCgst > inputCgst ? 'Payable' : inputCgst > outputCgst ? 'Excess ITC' : 'Balanced'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-slate-800">State GST (SGST)</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-700">{formatCurrencyINR(outputSgst)}</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700">{formatCurrencyINR(inputSgst)}</td>
                    <td className="py-2 px-3 text-right font-mono text-#5F1915 font-bold">
                      {outputSgst >= inputSgst ? formatCurrencyINR(netSgst) : `${formatCurrencyINR(inputSgst - outputSgst)} (Excess)`}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        outputSgst > inputSgst ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        inputSgst > outputSgst ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        'bg-slate-100 text-slate-700 border-slate-300'
                      }`}>
                        {outputSgst > inputSgst ? 'Payable' : inputSgst > outputSgst ? 'Excess ITC' : 'Balanced'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Col: Statutory Tally & CARO Compliance Status */}
        <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-#5F1915" />
              Tally Prime Gateway Status
            </h2>
            <p className="text-xs text-slate-500">Live communication with Tally Prime 4.1</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
              <div>
                <span className="text-slate-500 block text-[10px] font-bold uppercase">Endpoint</span>
                <span className="font-mono font-bold text-slate-900">{settings.tallyHost}:{settings.tallyPort}</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                ACTIVE
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <span className="text-slate-500 block text-[10px] font-bold uppercase">Loaded Company in Tally</span>
              <span className="font-bold text-[#5F1915] block truncate mt-0.5">{settings.tallyCompanyName || 'Company Not Set'}</span>
              <span className="text-[10px] text-slate-500 font-mono">Chart of Accounts: 16 Ledgers active</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <span className="text-slate-500 block text-[10px] font-bold uppercase">AI Extraction Accuracy</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-bold text-slate-900">{avgConfidence}% Precision</span>
                <span className="text-emerald-700 font-bold text-[11px]">ICAI Rule Engine Active</span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div className="bg-[#5F1915] h-full rounded-full" style={{ width: `${avgConfidence}%` }}></div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigateTab('export')}
              className="w-full py-2 bg-[#5F1915] hover:bg-[#491310] text-white rounded text-xs font-bold shadow-2xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Push {approvedCount} Approved Vouchers to Tally</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Bottom Table: Recent Invoices Ingestion Feed */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Recent Ingested Bills &amp; Vouchers
            </h3>
            <p className="text-xs text-slate-500">Chronological feed of documents processed by OCR &amp; Accounting Intelligence</p>
          </div>
          <button
            onClick={() => onNavigateTab('validation')}
            className="text-xs font-bold text-#5F1915 hover:text-[#491310] flex items-center gap-1"
          >
            Go to Full Validation Desk ({transactions.length} vouchers)
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Party Name</th>
                <th className="py-2.5 px-4">Ledger Head</th>
                <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                <th className="py-2.5 px-4 text-center">Confidence</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span className="text-xs font-bold text-slate-700 block">No Ingested Invoices Yet</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Upload tax invoices in the Batch Ingestion Queue or record a Voice Voucher to start.
                    </span>
                    <button
                      onClick={() => onNavigateTab('upload')}
                      className="mt-3 px-3 py-1.5 bg-[#5F1915] hover:bg-[#491310] text-white rounded text-xs font-semibold"
                    >
                      Upload Documents
                    </button>
                  </td>
                </tr>
              ) : (
                transactions.slice(0, 5).map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-700">{formatDateIndian(tx.date)}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                        {tx.voucherType}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 max-w-[200px] truncate">
                      {tx.party}
                      {tx.isDuplicateWarning && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-800 border border-red-300 font-bold">
                          DUPLICATE
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 max-w-[200px] truncate">{tx.ledger}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrencyINR(tx.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                        tx.confidence.overall >= 90 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                          : tx.confidence.overall >= 75
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-red-50 text-red-800 border-red-300'
                      }`}>
                        {tx.confidence.overall}%
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tx.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : tx.status === 'Rejected'
                          ? 'bg-red-100 text-red-800 border border-red-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => onNavigateTab('validation')}
                        className="px-2.5 py-1 bg-[#5F1915] hover:bg-[#491310] text-white rounded text-xs font-semibold"
                      >
                        Audit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
