import React from 'react';
import { 
  X, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  Building,
  CheckCircle2
} from 'lucide-react';
import { TransactionEntry } from '../types';
import { formatCurrencyINR, formatDateIndian } from '../utils/formatters';

interface DocumentPreviewModalProps {
  transaction: TransactionEntry | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  transaction,
  onClose,
  onApprove,
  onReject,
}) => {
  if (!transaction) return null;

  const doc = transaction.document;
  const subtotal = transaction.amount - (transaction.cgst + transaction.sgst + transaction.igst);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-white border border-slate-300 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-900">
        
        {/* Institutional Header */}
        <div className="px-6 py-3.5 bg-[#5F1915] text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 text-white rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold font-serif">{doc.name}</h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/20 text-white">
                  {doc.fileSize}
                </span>
                {transaction.isDuplicateWarning && (
                  <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-rose-500 text-white flex items-center gap-1 shadow-sm">
                    <AlertTriangle className="w-3 h-3" />
                    Duplicate Detected
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200 mt-0.5">
                Uploaded {doc.uploadDate} • Compare original physical invoice against AI-extracted Tally Prime ledger postings
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body: Split View (Left: Original Rendered Invoice, Right: Extracted Accounting Fields) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-300">
          
          {/* Left Column: Simulated High-Resolution Tax Invoice Document */}
          <div className="p-6 bg-slate-100 overflow-y-auto">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-700 font-serif">
                Original Scanned Document (High-Res OCR)
              </span>
              <span className="flex items-center gap-1 text-emerald-700 text-[11px] font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                <CheckCircle className="w-3.5 h-3.5" />
                OCR Text Cleansed
              </span>
            </div>

            {/* Rendered Invoice Paper Container */}
            <div className="invoice-paper bg-white text-slate-900 rounded-lg p-6 shadow-sm text-xs font-sans border border-slate-300 space-y-4 relative">
              {/* Highlight bounding box overlay badge */}
              <div className="absolute top-3 right-3 text-[10px] bg-[#5F1915] text-white font-mono px-2 py-0.5 rounded font-bold shadow-sm">
                OCR Matched: 100%
              </div>

              {/* Invoice Header */}
              <div className="border-b border-slate-300 pb-3 flex justify-between items-start">
                <div>
                  <h4 className="text-base font-extrabold text-slate-900 font-serif">{doc.vendorName}</h4>
                  <p className="text-[11px] text-slate-600 max-w-xs">{doc.address || 'Corporate Tech Park, Mumbai / Bangalore'}</p>
                  <p className="text-[11px] font-mono mt-1 text-slate-700">
                    <strong>GSTIN:</strong> {doc.gstin || '27AAACB2894G1ZG'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-widest bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                    TAX INVOICE
                  </span>
                  <p className="text-xs font-mono font-bold mt-1 text-slate-900">{doc.invoiceNo}</p>
                  <p className="text-[11px] text-slate-600 font-medium">Date: {doc.date}</p>
                </div>
              </div>

              {/* Billed To */}
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Billed To (Entity):</span>
                <p className="font-bold text-slate-900 mt-0.5">Primary Enterprise</p>
                <p className="text-[11px] text-slate-600">Client Accounting Books &amp; Records</p>
              </div>

              {/* Itemized Table */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[#5F1915] text-white font-bold">
                    <tr>
                      <th className="py-1.5 px-2">Description</th>
                      <th className="py-1.5 px-2">HSN/SAC</th>
                      <th className="py-1.5 px-2 text-center">Qty</th>
                      <th className="py-1.5 px-2 text-right">Rate</th>
                      <th className="py-1.5 px-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {doc.lineItems.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-2 font-medium text-slate-900">{item.description}</td>
                        <td className="py-2 px-2 font-mono text-slate-600">{item.hsnCode}</td>
                        <td className="py-2 px-2 text-center font-bold">{item.qty}</td>
                        <td className="py-2 px-2 text-right font-mono">₹{item.unitPrice.toLocaleString('en-IN')}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">₹{item.amount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Calculation Summary */}
              <div className="space-y-1.5 pt-2 text-right text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Value:</span>
                  <span className="font-mono font-bold text-slate-800">₹{doc.subtotal.toLocaleString('en-IN')}</span>
                </div>
                {transaction.isInterState ? (
                  <div className="flex justify-between text-slate-600">
                    <span>Integrated GST (IGST {transaction.gstRate}%):</span>
                    <span className="font-mono font-bold text-slate-800">₹{transaction.igst.toLocaleString('en-IN')}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600">
                      <span>Central GST (CGST {(transaction.gstRate / 2).toFixed(1)}%):</span>
                      <span className="font-mono font-bold text-slate-800">₹{transaction.cgst.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>State GST (SGST {(transaction.gstRate / 2).toFixed(1)}%):</span>
                      <span className="font-mono font-bold text-slate-800">₹{transaction.sgst.toLocaleString('en-IN')}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-extrabold text-sm text-slate-900 border-t border-slate-300 pt-2">
                  <span>Invoice Total (INR):</span>
                  <span className="font-mono text-[#5F1915]">₹{doc.totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-500 italic pt-2 border-t border-slate-200">
                Verified digitally through TallyAI Multimodal Vision Engine under Section 31 of CGST Act.
              </div>
            </div>
          </div>

          {/* Right Column: AI Extraction & Accounting Prediction Details */}
          <div className="p-6 bg-white overflow-y-auto space-y-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-serif">
                Accounting Intelligence Engine
              </span>
              <h4 className="text-base font-extrabold text-slate-900 mt-0.5 font-serif">
                Predicted Tally Prime Voucher Posting
              </h4>
            </div>

            {/* Confidence breakdown card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Overall AI Extraction Confidence</span>
                <span className="text-sm font-extrabold text-emerald-700">{transaction.confidence.overall}%</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full"
                  style={{ width: `${transaction.confidence.overall}%` }}
                ></div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1 text-slate-600 font-medium">
                <div>Ledger Predict: <strong className="text-slate-900">{transaction.confidence.ledger}%</strong></div>
                <div>Amount Parse: <strong className="text-slate-900">{transaction.confidence.amount}%</strong></div>
                <div>Vendor Match: <strong className="text-slate-900">{transaction.confidence.party}%</strong></div>
                <div>Voucher Type: <strong className="text-slate-900">{transaction.confidence.voucherType}%</strong></div>
              </div>
            </div>

            {/* Extracted Fields Breakdown */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-300">
                  <span className="text-slate-500 font-bold block text-[11px]">Voucher Type</span>
                  <span className="font-extrabold text-[#5F1915] text-sm">{transaction.voucherType}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-300">
                  <span className="text-slate-500 font-bold block text-[11px]">Invoice Date</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{formatDateIndian(transaction.date)}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-300">
                <span className="text-slate-500 font-bold block text-[11px]">Mapped Tally Ledger</span>
                <span className="font-bold text-[#5F1915] text-sm">{transaction.ledger}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-300">
                <span className="text-slate-500 font-bold block text-[11px]">Party / Supplier</span>
                <span className="font-bold text-slate-900 text-sm">{transaction.party}</span>
                <span className="block text-[11px] font-mono text-slate-600 mt-0.5">GSTIN: {transaction.partyGstin}</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-300">
                <span className="text-slate-500 font-bold block text-[11px]">Narration (Tally Entry Description)</span>
                <p className="text-slate-800 font-medium mt-0.5">{transaction.narration}</p>
              </div>

              {/* Tally Double-Entry Preview */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-300 space-y-2.5">
                <span className="text-[11px] font-bold text-[#5F1915] uppercase tracking-wider block font-serif">
                  Tally Prime Double-Entry Trial Balance Impact
                </span>
                <div className="flex justify-between text-slate-700 text-xs font-medium">
                  <span>Dr: {transaction.ledger}</span>
                  <span className="font-mono font-bold text-emerald-800">{formatCurrencyINR(subtotal)}</span>
                </div>
                {transaction.isInterState ? (
                  <div className="flex justify-between text-slate-700 text-xs font-medium">
                    <span>Dr: Input IGST {transaction.gstRate}%</span>
                    <span className="font-mono font-bold text-emerald-800">{formatCurrencyINR(transaction.igst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-700 text-xs font-medium">
                      <span>Dr: Input CGST {(transaction.gstRate / 2).toFixed(1)}%</span>
                      <span className="font-mono font-bold text-emerald-800">{formatCurrencyINR(transaction.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-slate-700 text-xs font-medium">
                      <span>Dr: Input SGST {(transaction.gstRate / 2).toFixed(1)}%</span>
                      <span className="font-mono font-bold text-emerald-800">{formatCurrencyINR(transaction.sgst)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-slate-900 border-t border-slate-300 pt-2 font-bold text-xs">
                  <span>Cr: {transaction.party}</span>
                  <span className="font-mono font-extrabold text-[#5F1915]">{formatCurrencyINR(transaction.amount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-300 flex items-center justify-between">
          <div className="text-xs text-slate-600 font-medium">
            Statutory Status: <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-300">{transaction.status}</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                onReject(transaction.id);
                onClose();
              }}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-lg text-xs font-bold transition-colors"
            >
              Reject / Discard Voucher
            </button>
            <button
              onClick={() => {
                onApprove(transaction.id);
                onClose();
              }}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve for Tally XML Export
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
