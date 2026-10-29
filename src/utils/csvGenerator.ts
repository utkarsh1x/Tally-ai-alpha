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

  const rows = entries.map((e) => [
    e.date,
    e.invoiceNumber,
    e.voucherType,
    e.ledger,
    e.party,
    e.partyGstin,
    e.debit ? e.debit.toFixed(2) : '0.00',
    e.credit ? e.credit.toFixed(2) : '0.00',
    e.amount.toFixed(2),
    e.gstRate,
    e.cgst.toFixed(2),
    e.sgst.toFixed(2),
    e.igst.toFixed(2),
    e.narration,
    e.invoiceNumber,
    e.referenceNumber,
    `${e.confidence.overall}%`,
    e.status,
    e.lastModifiedBy || 'AI Ingestion'
  ]);

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
