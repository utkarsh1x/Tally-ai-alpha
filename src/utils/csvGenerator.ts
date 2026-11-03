import { TransactionEntry } from '../types';

/**
 * Generates CSV file content with standard accounting export columns.
 */
export function generateCsv(entries: TransactionEntry[]): string {
  const headers = [
    'Date',
    'Voucher No.',
    'Voucher Type',
    'Ledger Account',
    'Party (Customer/Vendor)',
    'Party GSTIN',
    'Debit (INR)',
    'Credit (INR)',
    'Total Amount (INR)',
    'GST Rate (%)',
    'CGST (INR)',
    'SGST (INR)',
    'IGST (INR)',
    'Narration',
    'Invoice No.',
    'Reference No.',
    'AI Confidence (%)',
    'Status',
    'Last Modified By'
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = entries.map((e) => {
    const amount = Number(e.amount) || Number((e as any).totalAmount) || 0;
    const debit = Number(e.debit) || Number((e as any).taxableAmount) || 0;
    const credit = Number(e.credit) || 0;
    const cgst = Number(e.cgst) || Number((e as any).cgstAmount) || 0;
    const sgst = Number(e.sgst) || Number((e as any).sgstAmount) || 0;
    const igst = Number(e.igst) || Number((e as any).igstAmount) || 0;
    const gstRate = Number(e.gstRate) || Number((e as any).taxRate) || 0;
    const confidence = e.confidence?.overall ?? (e as any).confidenceScore ?? 95;

    return [
      e.date || '',
      e.invoiceNumber || '',
      e.voucherType || 'Purchase',
      e.ledger || (e as any).debitLedger || 'General Ledger',
      e.party || (e as any).partyName || 'Cash / Party',
      e.partyGstin || '',
      debit ? debit.toFixed(2) : '0.00',
      credit ? credit.toFixed(2) : '0.00',
      amount.toFixed(2),
      gstRate,
      cgst.toFixed(2),
      sgst.toFixed(2),
      igst.toFixed(2),
      e.narration || (e as any).description || 'Voucher generated via TallyAI',
      e.invoiceNumber || '',
      e.referenceNumber || '',
      `${confidence}%`,
      e.status || 'Approved',
      (e as any).lastModifiedBy || 'AI Ingestion'
    ];
  });

  const csvLines = [
    headers.map(escapeCsv).join(','),
    ...rows.map(row => row.map(escapeCsv).join(','))
  ];

  return csvLines.join('\r\n');
}

export function downloadCsvFile(csvContent: string, fileName = 'tally_ai_transactions.csv') {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
