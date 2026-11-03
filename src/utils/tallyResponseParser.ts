/**
 * TallyPrime XML Response Parser and Verification Utility
 */

export interface TallyParsedResult {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  created: number;
  altered: number;
  deleted: number;
  combined: number;
  errors: number;
  cancelled: number;
  errorDetails: string[];
  message: string;
  rawXml: string;
}

/**
 * Parses raw XML returned by TallyPrime upon voucher import.
 * Handles standard Tally <RESPONSE> schemas and extracts exact error lines.
 */
export function parseTallyXmlResponse(rawXml: string): TallyParsedResult {
  const text = String(rawXml || '');

  const extractInt = (tag: string): number => {
    const match = text.match(new RegExp(`<${tag}>\\s*(\\d+)\\s*<\\/${tag}>`, 'i'));
    return match ? parseInt(match[1], 10) : 0;
  };

  const created = extractInt('CREATED');
  const altered = extractInt('ALTERED');
  const deleted = extractInt('DELETED');
  const combined = extractInt('COMBINED');
  const errors = extractInt('ERRORS');
  const cancelled = extractInt('CANCELLED');

  const errorDetails: string[] = [];
  
  // Extract <LINEERROR>...</LINEERROR>
  const lineErrorRegex = /<LINEERROR>([\s\S]*?)<\/LINEERROR>/gi;
  let match: RegExpExecArray | null;
  while ((match = lineErrorRegex.exec(text)) !== null) {
    const errText = match[1].replace(/<[^>]+>/g, '').trim();
    if (errText && !errorDetails.includes(errText)) {
      errorDetails.push(errText);
    }
  }

  // Extract <ERROR>...</ERROR>
  const genericErrorRegex = /<ERROR>([\s\S]*?)<\/ERROR>/gi;
  while ((match = genericErrorRegex.exec(text)) !== null) {
    const errText = match[1].replace(/<[^>]+>/g, '').trim();
    if (errText && !errorDetails.includes(errText)) {
      errorDetails.push(errText);
    }
  }

  // Extract <DESCRIPTION>...</DESCRIPTION> if error-like
  const descRegex = /<DESCRIPTION>([\s\S]*?)<\/DESCRIPTION>/gi;
  while ((match = descRegex.exec(text)) !== null) {
    const descText = match[1].replace(/<[^>]+>/g, '').trim();
    if (descText && (descText.toLowerCase().includes('error') || descText.toLowerCase().includes('fail')) && !errorDetails.includes(descText)) {
      errorDetails.push(descText);
    }
  }

  // Determine overall status
  let status: 'SUCCESS' | 'PARTIAL' | 'FAILED' = 'FAILED';
  let message = '';

  if (errors === 0 && (created > 0 || altered > 0)) {
    status = 'SUCCESS';
    message = `Successfully synced with TallyPrime! ${created} voucher(s) created${altered > 0 ? `, ${altered} altered` : ''}.`;
  } else if (errors > 0 && (created > 0 || altered > 0)) {
    status = 'PARTIAL';
    message = `Partially synced: ${created} voucher(s) created, but ${errors} failed.`;
  } else if (errors > 0) {
    status = 'FAILED';
    message = `TallyPrime rejected import (${errors} error${errors > 1 ? 's' : ''}): ${errorDetails[0] || 'See error log.'}`;
  } else if (created === 0 && altered === 0 && errors === 0) {
    if (text.includes('<RESPONSE>') && text.includes('</RESPONSE>')) {
      status = 'FAILED';
      message = 'TallyPrime returned 0 created/altered vouchers. Please verify company name matches the active Tally company.';
    } else if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
      status = 'FAILED';
      message = errorDetails[0] || 'TallyPrime returned an error response.';
    } else {
      status = 'SUCCESS';
      message = 'TallyPrime acknowledged request.';
    }
  }

  return {
    status,
    created,
    altered,
    deleted,
    combined,
    errors,
    cancelled,
    errorDetails,
    message,
    rawXml: text
  };
}

/**
 * Generates a deterministic signature for a batch of transactions to detect duplicate pushes.
 */
export function computeBatchSignature(transactions: Array<{ id: string; invoiceNumber?: string; referenceNumber?: string; date: string; amount: number; voucherType: string }>): string {
  return transactions
    .map(t => `${t.invoiceNumber || t.referenceNumber || t.id}_${t.date}_${t.amount.toFixed(2)}_${t.voucherType}`)
    .sort()
    .join('|');
}
