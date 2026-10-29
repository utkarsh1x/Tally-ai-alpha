import { ChartOfAccountItem, OrganizationSettings, TransactionEntry, AuditLog } from '../types';

export const initialSettings: OrganizationSettings = {
  companyName: '',
  tradeName: '',
  gstin: '',
  pan: '',
  state: 'Maharashtra',
  stateCode: '27',
  fiscalYear: '2026-2027',
  currency: 'INR',
  tallyHost: 'http://localhost',
  tallyPort: 9000,
  tallyCompanyName: '',
  autoSyncEnabled: false,
  confidenceThreshold: 85,
  geminiApiKey: '',
};

export const initialChartOfAccounts: ChartOfAccountItem[] = [
  { id: 'coa-1', name: 'Computer & Hardware Equipment A/c', group: 'Fixed Assets', balance: 0, balanceType: 'Dr' },
  { id: 'coa-2', name: 'Software & Cloud Subscriptions', group: 'Indirect Expenses', balance: 0, balanceType: 'Dr' },
  { id: 'coa-3', name: 'Office Rent & Workspace Expense', group: 'Indirect Expenses', balance: 0, balanceType: 'Dr' },
  { id: 'coa-4', name: 'Staff Welfare & Refreshment', group: 'Indirect Expenses', balance: 0, balanceType: 'Dr' },
  { id: 'coa-5', name: 'Freight & Local Transport Charges', group: 'Direct Expenses', balance: 0, balanceType: 'Dr' },
  { id: 'coa-6', name: 'Internet & Telecom Expenses', group: 'Indirect Expenses', balance: 0, balanceType: 'Dr' },
  { id: 'coa-7', name: 'Legal & Professional Consulting Fees', group: 'Indirect Expenses', balance: 0, balanceType: 'Dr' },
  { id: 'coa-8', name: 'Software Consulting & Service Revenue', group: 'Sales Accounts', balance: 0, balanceType: 'Cr' },
  { id: 'coa-9', name: 'Input CGST', group: 'Duties & Taxes', balance: 0, balanceType: 'Dr' },
  { id: 'coa-10', name: 'Input SGST', group: 'Duties & Taxes', balance: 0, balanceType: 'Dr' },
  { id: 'coa-11', name: 'Input IGST', group: 'Duties & Taxes', balance: 0, balanceType: 'Dr' },
  { id: 'coa-12', name: 'Output CGST', group: 'Duties & Taxes', balance: 0, balanceType: 'Cr' },
  { id: 'coa-13', name: 'Output SGST', group: 'Duties & Taxes', balance: 0, balanceType: 'Cr' },
  { id: 'coa-14', name: 'Output IGST', group: 'Duties & Taxes', balance: 0, balanceType: 'Cr' },
  { id: 'coa-15', name: 'Bank Current A/c', group: 'Bank Accounts', balance: 0, balanceType: 'Dr' },
  { id: 'coa-16', name: 'Petty Cash A/c', group: 'Cash-in-Hand', balance: 0, balanceType: 'Dr' },
];

export const initialTransactions: TransactionEntry[] = [];

export const initialAuditLogs: AuditLog[] = [];
