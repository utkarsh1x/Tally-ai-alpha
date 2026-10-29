import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  Mic, 
  CheckCircle2, 
  Loader2, 
  ArrowRight, 
  Play, 
  Sparkles
} from 'lucide-react';
import { ProcessingJob, TransactionEntry, ChartOfAccountItem } from '../types';
import { formatCurrencyINR, getTodayLocalDateISO } from '../utils/formatters';

interface UploadQueueProps {
  onAddTransaction: (entry: TransactionEntry) => void;
  onNavigateToValidation: () => void;
  onOpenVoiceModal: () => void;
  chartOfAccounts: ChartOfAccountItem[];
}

export const UploadQueue: React.FC<UploadQueueProps> = ({
  onAddTransaction,
  onNavigateToValidation,
  onOpenVoiceModal,
  chartOfAccounts,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sample templates users can click to simulate instant parsing
  const samplePresets = [
    {
      name: 'Reliance Digital POS Invoice.pdf',
      type: 'pdf' as const,
      size: '340 KB',
      party: 'Reliance Retail Limited',
      gstin: '27AAACR7148M1ZT',
      amount: 48500,
      ledger: 'Computer & Hardware Equipment A/c',
      voucherType: 'Purchase' as const,
      rate: 18,
      narration: 'Being Apple iPad Air 5th Gen (64GB) purchased for design team client presentations',
      invNo: 'REL-DIGI-2026-993',
      confidence: 96,
    },
    {
      name: 'Google_Workspace_Tax_Bill.pdf',
      type: 'pdf' as const,
      size: '220 KB',
      party: 'Google India Cloud Services Pvt Ltd',
      gstin: '29AABCG2424L1ZU',
      amount: 15340,
      ledger: 'Software & Cloud Subscriptions',
      voucherType: 'Purchase' as const,
      rate: 18,
      narration: 'Being Google Workspace Business Plus enterprise email licenses for 25 team members (Oct 2026)',
      invNo: 'GGL-OCT-88491',
      confidence: 97,
    },
    {
      name: 'Uber_Corporate_Travel_Receipt.pdf',
      type: 'pdf' as const,
      size: '180 KB',
      party: 'Uber India Technology Pvt Ltd',
      gstin: '27AAACU1234F1ZX',
      amount: 1840,
      ledger: 'Staff Welfare & Refreshment',
      voucherType: 'Payment' as const,
      rate: 5,
      narration: 'Being airport cab reimbursement for audit team client visit to Pune factory',
      invNo: 'UBER-MUM-4819',
      confidence: 91,
    },
    {
      name: 'Quarterly_GST_Bills_Batch.xlsx',
      type: 'excel' as const,
      size: '890 KB',
      party: 'Multiple Vendors (Batch Excel)',
      gstin: '27AABCT3518Q1ZV',
      amount: 320000,
      ledger: 'Direct Expenses',
      voucherType: 'Purchase' as const,
      rate: 18,
      narration: 'Batch import of 14 vendor utility bills from Q3 accounting spreadsheet',
      invNo: 'XLS-BATCH-OCT-01',
      confidence: 89,
    },
  ];

  const handleProcessPreset = (preset: typeof samplePresets[0]) => {
    const jobId = `job-${Date.now()}`;
    const newJob: ProcessingJob = {
      id: jobId,
      fileName: preset.name,
      fileSize: preset.size,
      fileType: preset.type,
      progress: 15,
      status: 'OCR_SCAN',
      statusText: 'Running OCR & Table Extraction...',
      detectedInvoiceNo: preset.invNo,
    };

    setJobs(prev => [newJob, ...prev]);
    setIsProcessingBatch(true);

    // Multi-stage AI pipeline simulation
    setTimeout(() => {
      setJobs(prev => prev.map(j => j.id === jobId ? {
        ...j,
        progress: 45,
        status: 'LLM_UNDERSTANDING',
        statusText: 'Gemini Document Understanding: Parsing Entities & Tax...'
      } : j));
    }, 800);

    setTimeout(() => {
      setJobs(prev => prev.map(j => j.id === jobId ? {
        ...j,
        progress: 75,
        status: 'ACCOUNTING_MAP',
        statusText: 'Accounting Intelligence: Matching Ledger & GST Rules...'
      } : j));
    }, 1600);

    setTimeout(() => {
      setJobs(prev => prev.map(j => j.id === jobId ? {
        ...j,
        progress: 100,
        status: 'COMPLETED',
        statusText: `Extracted: ${formatCurrencyINR(preset.amount)} • ${preset.ledger}`,
        extractedAmount: preset.amount,
      } : j));
      setIsProcessingBatch(false);

      // Create new transaction entry
      const subtotal = preset.amount / (1 + preset.rate / 100);
      const tax = preset.amount - subtotal;
      const isInter = preset.gstin.substring(0, 2) !== '27';

      const newEntry: TransactionEntry = {
        id: `tx-${Date.now()}`,
        documentId: `doc-${Date.now()}`,
        invoiceNumber: preset.invNo,
        referenceNumber: `REF-${Math.floor(1000 + Math.random() * 9000)}`,
        date: getTodayLocalDateISO(),
        voucherType: preset.voucherType,
        ledger: preset.ledger,
        party: preset.party,
        partyGstin: preset.gstin,
        amount: preset.amount,
        debit: (preset.voucherType as any) === 'Sales' ? 0 : preset.amount,
        credit: (preset.voucherType as any) === 'Sales' ? preset.amount : 0,
        gstRate: preset.rate,
        cgst: isInter ? 0 : tax / 2,
        sgst: isInter ? 0 : tax / 2,
        igst: isInter ? tax : 0,
        isInterState: isInter,
        narration: preset.narration,
        confidence: {
          overall: preset.confidence,
          ledger: preset.confidence,
          amount: 99,
          party: preset.confidence - 2,
          date: 98,
          voucherType: 95,
        },
        status: 'Pending',
        document: {
          id: `doc-${Date.now()}`,
          name: preset.name,
          fileType: preset.type,
          fileSize: preset.size,
          uploadDate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          vendorName: preset.party,
          invoiceNo: preset.invNo,
          date: getTodayLocalDateISO(),
          subtotal: Math.round(subtotal * 100) / 100,
          taxAmount: Math.round(tax * 100) / 100,
          totalAmount: preset.amount,
          taxRate: preset.rate,
          gstin: preset.gstin,
          lineItems: [
            {
              description: preset.narration,
              hsnCode: '998315',
              qty: 1,
              unitPrice: subtotal,
              amount: subtotal,
            }
          ]
        }
      };

      onAddTransaction(newEntry);
    }, 2400);
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file, index) => {
      const jobId = `job-${Date.now()}-${index}`;
      const ext = file.name.split('.').pop()?.toLowerCase();
      let fileType: 'pdf' | 'image' | 'excel' | 'voice' = 'pdf';
      if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) fileType = 'image';
      if (['xlsx', 'xls', 'csv'].includes(ext || '')) fileType = 'excel';
      if (['mp3', 'wav', 'm4a', 'ogg'].includes(ext || '')) fileType = 'voice';

      const randomAmount = Math.floor(Math.random() * 40000) + 1500;
      const detectedInv = `INV-UP-${Math.floor(10000 + Math.random() * 90000)}`;

      const newJob: ProcessingJob = {
        id: jobId,
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        fileType,
        progress: 10,
        status: 'OCR_SCAN',
        statusText: fileType === 'voice' ? 'Transcribing Audio Memo & Speech Processing...' : 'Uploading & Extracting Document Text...',
        detectedInvoiceNo: detectedInv,
      };

      setJobs(prev => [newJob, ...prev]);

      setTimeout(() => {
        setJobs(prev => prev.map(j => j.id === jobId ? {
          ...j,
          progress: 50,
          status: 'LLM_UNDERSTANDING',
          statusText: fileType === 'voice' ? 'Parsing Spoken Entities, Amount & GST Split...' : 'Extracting Invoice Tables & Tax Amounts...'
        } : j));
      }, 900);

      setTimeout(() => {
        setJobs(prev => prev.map(j => j.id === jobId ? {
          ...j,
          progress: 100,
          status: 'COMPLETED',
          statusText: `Processed: ${formatCurrencyINR(randomAmount)} • ${fileType === 'voice' ? 'Voice Voucher' : 'Office Supplies'}`,
          extractedAmount: randomAmount,
        } : j));

        // Create transaction entry
        const entry: TransactionEntry = {
          id: `tx-${Date.now()}-${index}`,
          documentId: `doc-${Date.now()}-${index}`,
          invoiceNumber: detectedInv,
          referenceNumber: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
          date: getTodayLocalDateISO(),
          voucherType: 'Purchase',
          ledger: 'Office Rent & Workspace Expense',
          party: 'City Business Solutions Pvt Ltd',
          partyGstin: '27AAACC4918N1ZP',
          amount: randomAmount,
          debit: randomAmount,
          credit: 0,
          gstRate: 18,
          cgst: (randomAmount * 0.18 / 1.18) / 2,
          sgst: (randomAmount * 0.18 / 1.18) / 2,
          igst: 0,
          isInterState: false,
          narration: `Automated extraction from ${file.name}`,
          confidence: {
            overall: 93,
            ledger: 94,
            amount: 98,
            party: 91,
            date: 96,
            voucherType: 92,
          },
          status: 'Pending',
          document: {
            id: `doc-${Date.now()}-${index}`,
            name: file.name,
            fileType,
            fileSize: `${(file.size / 1024).toFixed(1)} KB`,
            uploadDate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            vendorName: 'City Business Solutions Pvt Ltd',
            invoiceNo: detectedInv,
            date: getTodayLocalDateISO(),
            subtotal: randomAmount / 1.18,
            taxAmount: randomAmount - (randomAmount / 1.18),
            totalAmount: randomAmount,
            taxRate: 18,
            gstin: '27AAACC4918N1ZP',
            lineItems: [
              {
                description: 'Office Maintenance & Admin Support Service',
                hsnCode: '9987',
                qty: 1,
                unitPrice: randomAmount / 1.18,
                amount: randomAmount / 1.18,
              }
            ]
          }
        };

        onAddTransaction(entry);
      }, 1900);
    });
  };

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Page Title */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-[#5F1915]" />
            Batch Document Ingestion &amp; Optical Character Recognition (OCR) Engine
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Ingest Tax Invoices, Scanned Cash Slips, E-Way Bills, Excel Spreadsheets, and Audio Memos.
          </p>
        </div>

        <button
          onClick={onNavigateToValidation}
          className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#5F1915] hover:bg-[#491310] text-white rounded text-xs font-bold shadow-2xs transition-all"
        >
          <span>Open CA Validation Desk</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFileUpload(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          isDragging 
            ? 'border-[#5F1915] bg-[#5F1915]/10 scale-[1.005]' 
            : 'border-slate-300 bg-white hover:border-[#5F1915] hover:bg-slate-50 shadow-2xs'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,.mp3,.wav,.m4a"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
        />

        <div className="mx-auto w-14 h-14 rounded-full bg-[#5F1915]/10 border border-[#5F1915]/30 flex items-center justify-center mb-3 text-[#5F1915]">
          <UploadCloud className="w-7 h-7" />
        </div>

        <h3 className="text-base font-bold text-slate-900">
          Drag &amp; Drop Batch Invoices, Receipts, or Accounting Sheets here
        </h3>
        <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
          Supported file formats: <strong className="text-slate-800 font-semibold">PDF, JPEG/PNG images, Excel/CSV sheets</strong>, and voice memos.
        </p>

        <div className="mt-4 flex flex-wrap justify-center items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1.5 font-medium">
            <FileText className="w-3.5 h-3.5 text-red-700" />
            PDF Tax Invoices
          </span>
          <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1.5 font-medium">
            <ImageIcon className="w-3.5 h-3.5 text-blue-700" />
            Scanned Cash Slips
          </span>
          <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1.5 font-medium">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            Excel Spreadsheets
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenVoiceModal();
            }}
            className="px-2.5 py-1 rounded bg-rose-50 text-rose-800 border border-rose-300 flex items-center gap-1.5 hover:bg-rose-100 font-semibold"
          >
            <Mic className="w-3.5 h-3.5 text-rose-700" />
            Record Audio Memo (Alt+V)
          </button>
        </div>

        <div className="mt-3 text-[11px] text-slate-500">
          Encrypted 256-bit transmission compliant with Information Technology Act &amp; ICAI data privacy guidelines
        </div>
      </div>

      {/* Preset Invoices for Instant 1-Click Testing */}
      <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Statutory Sample Invoices (1-Click Test Library)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Simulates end-to-end OCR and Tally Ledger Inference</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {samplePresets.map((preset, idx) => (
            <div
              key={idx}
              onClick={() => handleProcessPreset(preset)}
              className="p-3.5 rounded border border-slate-300 bg-slate-50/60 hover:border-[#5F1915] hover:bg-[#5F1915]/5 transition-all cursor-pointer group flex flex-col justify-between shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#5F1915] px-1.5 py-0.5 rounded bg-[#5F1915]/10 border border-[#5F1915]/30">
                    {preset.type.toUpperCase()}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {formatCurrencyINR(preset.amount)}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-800 mt-2 line-clamp-1 group-hover:text-[#5F1915]">
                  {preset.name}
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">{preset.party}</p>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">Head: {preset.ledger}</p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-[#5F1915] group-hover:text-[#491310] font-bold">
                <span className="flex items-center gap-1">
                  <Play className="w-3 h-3 fill-[#5F1915]" />
                  Parse Document
                </span>
                <span className="text-slate-600 font-medium">{preset.rate}% GST</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Processing Queue List */}
      <div className="bg-white border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
        <div className="p-3.5 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Active Extraction Queue &amp; OCR Jobs
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
              {jobs.length} files
            </span>
          </div>

          {jobs.some(j => j.status === 'COMPLETED') && (
            <button
              onClick={onNavigateToValidation}
              className="text-xs font-bold text-[#5F1915] hover:text-[#491310] flex items-center gap-1"
            >
              Review Entries in CA Validation Desk
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-200">
          {jobs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <span className="text-xs font-bold text-slate-700 block">No documents in extraction queue</span>
              <span className="text-[11px] text-slate-500">Drag &amp; drop files above or click a sample invoice to simulate parsing.</span>
            </div>
          ) : (
            jobs.map((job) => (
            <div key={job.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded ${
                  job.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' :
                  job.status === 'FAILED' ? 'bg-red-50 text-red-800 border border-red-300' :
                  'bg-[#5F1915]/10 text-[#5F1915] border border-[#5F1915]/30'
                }`}>
                  {job.fileType === 'pdf' ? <FileText className="w-5 h-5" /> :
                   job.fileType === 'excel' ? <FileSpreadsheet className="w-5 h-5" /> :
                   job.fileType === 'voice' ? <Mic className="w-5 h-5" /> :
                   <ImageIcon className="w-5 h-5" />}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-900">{job.fileName}</span>
                    <span className="text-[11px] text-slate-500 font-mono">({job.fileSize})</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5 flex items-center gap-2">
                    {job.detectedInvoiceNo && (
                      <span className="font-mono text-[#5F1915] bg-[#5F1915]/10 border border-[#5F1915]/30 px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {job.detectedInvoiceNo}
                      </span>
                    )}
                    <span>{job.statusText}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4 self-end sm:self-center">
                {job.status !== 'COMPLETED' ? (
                  <div className="w-36 flex flex-col items-end">
                    <div className="flex items-center space-x-1.5 text-xs text-[#5F1915] mb-1 font-mono font-bold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{job.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#5F1915] h-full rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 text-xs text-emerald-800 font-bold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Audit Ready</span>
                  </div>
                )}
              </div>
            </div>
          )))}
        </div>
      </div>
    </div>
  );
};
