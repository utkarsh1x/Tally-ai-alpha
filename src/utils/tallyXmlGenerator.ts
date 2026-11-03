import { TransactionEntry } from '../types';
import { formatDateTally } from './formatters';

/**
 * Generates official Tally Prime compliant XML for approved accounting vouchers.
 * Follows Tally's standard Envelope > Body > Data > TallyMessage schema.
 */
export function generateTallyXml(entries: TransactionEntry[], companyName: string): string {
  const sanitize = (str: string) =>
    (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  const vouchersXml = entries
    .map((entry, idx) => {
      const tallyDate = formatDateTally(entry.date);
      const voucherNo = sanitize(entry.invoiceNumber || `AUTO-${idx + 1}`);
      const partyName = sanitize(entry.party);
      const expenseOrIncomeLedger = sanitize(entry.ledger);
      const narration = sanitize(entry.narration || `Voucher generated via TallyAI`);
      const refNo = sanitize(entry.referenceNumber || entry.invoiceNumber || '');
      const isPurchaseOrPayment = entry.voucherType === 'Purchase' || entry.voucherType === 'Payment';
      const isSalesOrReceipt = entry.voucherType === 'Sales' || entry.voucherType === 'Receipt';

      // Defensive numerical resolution
      const amount = Number(entry.amount) || Number((entry as any).totalAmount) || 0;
      const cgst = Number(entry.cgst) || Number((entry as any).cgstAmount) || 0;
      const sgst = Number(entry.sgst) || Number((entry as any).sgstAmount) || 0;
      const igst = Number(entry.igst) || Number((entry as any).igstAmount) || 0;
      const gstRate = Number(entry.gstRate) || Number((entry as any).taxRate) || 0;
      const subtotal = Number(entry.debit) || Number((entry as any).taxableAmount) || (amount - (cgst + sgst + igst)) || 0;
      
      let ledgerEntries = '';

      if (isPurchaseOrPayment) {
        // Purchase / Payment:
        // Debit: Expense/Asset Ledger
        ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${expenseOrIncomeLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <ISPARTYLEDGER>No</ISPARTYLEDGER>
              <AMOUNT>-${subtotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;

        // Debit: GST Taxes
        if (entry.isInterState && igst > 0) {
          ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Input IGST ${gstRate}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${igst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
        } else {
          if (cgst > 0) {
            ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Input CGST ${(gstRate / 2).toFixed(1)}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${cgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
          }
          if (sgst > 0) {
            ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Input SGST ${(gstRate / 2).toFixed(1)}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${sgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
          }
        }

        // Credit: Party (Creditor or Bank)
        ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
      } else if (isSalesOrReceipt) {
        // Sales:
        // Debit: Party (Debtor)
        ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;

        // Credit: Sales Ledger
        ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${expenseOrIncomeLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${subtotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;

        // Credit: Output Taxes
        if (entry.isInterState && igst > 0) {
          ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output IGST ${gstRate}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${igst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
        } else {
          if (cgst > 0) {
            ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output CGST ${(gstRate / 2).toFixed(1)}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${cgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
          }
          if (sgst > 0) {
            ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output SGST ${(gstRate / 2).toFixed(1)}%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${sgst.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
          }
        }
      } else {
        // Journal / Contra
        ledgerEntries += `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${expenseOrIncomeLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
      }

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="${entry.voucherType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
          <DATE>${tallyDate}</DATE>
          <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
          <VOUCHERTYPENAME>${entry.voucherType}</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${voucherNo}</VOUCHERNUMBER>
          <REFERENCE>${refNo}</REFERENCE>
          <PARTYLEDGERNAME>${partyName}</PARTYLEDGERNAME>
          <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
          <NARRATION>${narration}</NARRATION>
          <BASICBUYERNAME>${partyName}</BASICBUYERNAME>
          <PARTYGSTIN>${sanitize(entry.partyGstin || '')}</PARTYGSTIN>${ledgerEntries}
        </VOUCHER>
      </TALLYMESSAGE>`;
    })
    .join('\n');

  const companyBlock = companyName && companyName.trim()
    ? `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <COMPANY>
          <REMOTECMPINFO.LIST>
            <NAME>${sanitize(companyName)}</NAME>
          </REMOTECMPINFO.LIST>
        </COMPANY>
      </TALLYMESSAGE>\n`
    : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <DATA>
${companyBlock}${vouchersXml}
    </DATA>
  </BODY>
</ENVELOPE>`;
}

export function downloadXmlFile(xmlContent: string, fileName = 'tally_import_vouchers.xml') {
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
