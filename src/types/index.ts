export type VoucherType = 'Purchase' | 'Sales' | 'Payment' | 'Receipt' | 'Journal' | 'Contra';

export type EntryStatus = 'Pending' | 'Approved' | 'Rejected';

export type UserRole = 'CA' | 'Firm Admin' | 'Senior Accountant' | 'Junior Auditor' | 'SME Owner' | 'Other';

export interface EntryConfidence {
  overall: number;
  ledger: number;
  amount: number;
  party: number;
  date: number;
  voucherType: number;
}

export interface DocumentSource {
  id: string;
  name: string;
  fileType: 'pdf' | 'image' | 'excel' | 'voice';
  fileSize: string;
  uploadDate: string;
  thumbnailUrl?: string;
  vendorName: string;
  invoiceNo: string;
  date: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  taxRate: number;
  gstin: string;
  address?: string;
  lineItems: Array<{
    description: string;
    hsnCode: string;
    qty: number;
    unitPrice: number;
    amount: number;
  }>;
}

export interface TransactionEntry {
  id: string;
  documentId: string;
  invoiceNumber: string;
  referenceNumber: string;
  date: string; // YYYY-MM-DD
  voucherType: VoucherType;
  ledger: string; // Expense/Income or Asset ledger
  party: string; // Debtor / Creditor name
  partyGstin: string;
  amount: number;
  debit: number;
  credit: number;
  gstRate: number; // 0, 5, 12, 18, 28
  cgst: number;
  sgst: number;
  igst: number;
  isInterState: boolean;
  narration: string;
  confidence: EntryConfidence;
  status: EntryStatus;
  document: DocumentSource;
  isDuplicateWarning?: boolean;
  duplicateMatchedWith?: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  rejectionReason?: string;
}

export interface ChartOfAccountItem {
  id: string;
  name: string;
  group: 
    | 'Sundry Creditors'
    | 'Sundry Debtors'
    | 'Direct Expenses'
    | 'Indirect Expenses'
    | 'Bank Accounts'
    | 'Cash-in-Hand'
    | 'Duties & Taxes'
    | 'Sales Accounts'
    | 'Purchase Accounts'
    | 'Fixed Assets'
    | 'Current Liabilities';
  taxRate?: number;
  balance: number;
  balanceType: 'Dr' | 'Cr';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  action: 'UPLOAD' | 'AI_EXTRACT' | 'EDIT_FIELD' | 'APPROVE' | 'REJECT' | 'EXPORT_TALLY_XML' | 'DIRECT_SYNC' | 'BATCH_APPROVE';
  targetId: string;
  details: string;
  previousValue?: string;
  newValue?: string;
}

export interface FeedbackSubmission {
  id: string;
  batchId: string;
  rating: number; // 1-5
  tags: string[];
  comments: string;
  timestamp: string;
  user: string;
}

export interface OrganizationSettings {
  companyName: string;
  tradeName: string;
  gstin: string;
  pan: string;
  state: string;
  stateCode: string;
  fiscalYear: string;
  currency: string;
  tallyHost: string;
  tallyPort: number;
  tallyCompanyName: string;
  autoSyncEnabled: boolean;
  geminiApiKey?: string;
  confidenceThreshold: number; // default 85%
}

export interface ProcessingJob {
  id: string;
  fileName: string;
  fileSize: string;
  fileType: 'pdf' | 'image' | 'excel' | 'voice';
  progress: number;
  status: 'QUEUED' | 'OCR_SCAN' | 'LLM_UNDERSTANDING' | 'ACCOUNTING_MAP' | 'COMPLETED' | 'FAILED';
  statusText: string;
  detectedInvoiceNo?: string;
  extractedAmount?: number;
}
