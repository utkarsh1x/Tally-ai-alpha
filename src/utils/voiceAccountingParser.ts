import type { TransactionEntry, VoucherType } from '../types';
import { getTodayLocalDateISO } from './formatters';

const monthMap: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
};

/**
 * Extracts a spoken date from voice narration, or defaults to local today YYYY-MM-DD.
 */
export function extractDateFromVoiceText(text: string): string {
  const lower = text.toLowerCase();
  const currentYear = new Date().getFullYear();

  if (/\byesterday\b/.test(lower)) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // e.g. "15th october 2026", "24 oct", "1st november"
  const matchDayMonth = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)(?:\s+(\d{4}))?\b/);
  if (matchDayMonth) {
    const day = String(parseInt(matchDayMonth[1], 10)).padStart(2, '0');
    const monthNum = monthMap[matchDayMonth[2]];
    const month = String(monthNum).padStart(2, '0');
    const year = matchDayMonth[3] ? matchDayMonth[3] : String(currentYear);
    return `${year}-${month}-${day}`;
  }

  // e.g. "october 15", "oct 24 2026"
  const matchMonthDay = lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?\b/);
  if (matchMonthDay) {
    const monthNum = monthMap[matchMonthDay[1]];
    const month = String(monthNum).padStart(2, '0');
    const day = String(parseInt(matchMonthDay[2], 10)).padStart(2, '0');
    const year = matchMonthDay[3] ? matchMonthDay[3] : String(currentYear);
    return `${year}-${month}-${day}`;
  }

  return getTodayLocalDateISO();
}

// Map of word numbers to their values
const wordNumberMap: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  sau: 100,
  thousand: 1000,
  hazaar: 1000,
  lakh: 100000,
  lac: 100000,
  crore: 10000000,
  cr: 10000000,
};

/**
 * Extracts a numeric amount from spoken or written text.
 * Handles digits ("15000", "1,50,000", "15k"), currency prefixes/suffixes ("Rs 12000", "4500 rupees"),
 * decimal lakh expressions ("1.5 lakh", "2.5 crore"), and word phrases ("twelve thousand five hundred").
 */
export function extractAmountFromVoiceText(rawText: string): number {
  if (!rawText) return 10000;
  const text = rawText.toLowerCase().replace(/,/g, '');

  // 1. Check for decimal or whole number followed by lakh/crore/thousand/k
  // e.g. "1.5 lakh", "2 lakh", "50k", "2.5 cr", "10 thousand"
  const multiplierMatch = text.match(/(\d+(?:\.\d+)?)\s*(lakhs?|lacs?|crores?|cr|thousands?|k)\b/i);
  if (multiplierMatch) {
    const val = parseFloat(multiplierMatch[1]);
    const unit = multiplierMatch[2].toLowerCase();
    if (unit.startsWith('cr')) return Math.round(val * 10000000);
    if (unit.startsWith('la')) return Math.round(val * 100000);
    if (unit.startsWith('th') || unit === 'k') return Math.round(val * 1000);
  }

  // 2. Check for explicit numbers (e.g. "12500", "rs 4500", "50000 rupees", "₹24000")
  const directNumberMatches = text.match(/(?:rs\.?|rupees?|inr|₹)?\s*(\d{2,10}(?:\.\d{1,2})?)\s*(?:rs\.?|rupees?|inr)?/gi);
  if (directNumberMatches) {
    // Find the largest or most prominent number that isn't a GST percentage (0, 5, 12, 18, 28)
    const numbers = directNumberMatches
      .map(m => {
        const cleaned = m.replace(/[^\d.]/g, '');
        return parseFloat(cleaned);
      })
      .filter(n => !isNaN(n) && n > 0 && n !== 5 && n !== 12 && n !== 18 && n !== 28);

    if (numbers.length > 0) {
      return numbers[0];
    }
  }

  // 3. Check for spoken number words ("twelve thousand five hundred", "one lakh fifty thousand")
  const words = text.split(/[\s-]+/);
  let total = 0;
  let currentGroup = 0;
  let hasNumberWords = false;

  for (const word of words) {
    if (word in wordNumberMap) {
      hasNumberWords = true;
      const val = wordNumberMap[word];
      if (val === 10000000) {
        currentGroup = (currentGroup === 0 ? 1 : currentGroup) * val;
        total += currentGroup;
        currentGroup = 0;
      } else if (val === 100000) {
        currentGroup = (currentGroup === 0 ? 1 : currentGroup) * val;
        total += currentGroup;
        currentGroup = 0;
      } else if (val === 1000) {
        currentGroup = (currentGroup === 0 ? 1 : currentGroup) * val;
        total += currentGroup;
        currentGroup = 0;
      } else if (val === 100) {
        currentGroup = (currentGroup === 0 ? 1 : currentGroup) * val;
      } else {
        currentGroup += val;
      }
    }
  }

  total += currentGroup;
  if (hasNumberWords && total > 0) {
    return total;
  }

  // Fallback default
  return 12500;
}

/**
 * Extracts the voucher type based on voice action keywords.
 */
export function extractVoucherType(text: string): VoucherType {
  const lower = text.toLowerCase();
  if (/\b(received|receipt|collection|collected|mila|aaya|inflow|income|fee received)\b/.test(lower)) {
    return 'Receipt';
  }
  if (/\b(purchase|purchased|bought|procured|khareeda|procurement)\b/.test(lower)) {
    return 'Purchase';
  }
  if (/\b(sale|sales|sold|billed|invoiced|becha)\b/.test(lower)) {
    return 'Sales';
  }
  if (/\b(contra|cash deposit|cash withdrawal|bank transfer|transferred from|transferred to)\b/.test(lower)) {
    return 'Contra';
  }
  if (/\b(journal|adjustment|rectification|depreciation)\b/.test(lower)) {
    return 'Journal';
  }
  return 'Payment';
}

/**
 * Extracts GST rate from text (0, 5, 12, 18, 28).
 */
export function extractGstRate(text: string): number {
  const lower = text.toLowerCase();
  const digitMatch = lower.match(/\b(0|5|12|18|28)\s*(?:%|percent|pratishat)\b/);
  if (digitMatch) {
    return parseInt(digitMatch[1], 10);
  }

  if (/\beighteen percent\b/.test(lower)) return 18;
  if (/\btwelve percent\b/.test(lower)) return 12;
  if (/\bfive percent\b/.test(lower)) return 5;
  if (/\btwenty[- ]eight percent\b/.test(lower)) return 28;
  if (/\b(zero percent|nil rate|exempt|non-gst|cash expense)\b/.test(lower)) return 0;

  // Standard B2B default is 18% unless petty cash/refreshment
  if (/\b(tea|coffee|refreshment|snacks|pantry|petty cash)\b/.test(lower)) return 0;
  return 18;
}

/**
 * Extracts party or vendor name from voice narration.
 */
export function extractPartyName(text: string, voucherType: VoucherType): string {
  // Common named entities in Indian commerce
  const knownParties = [
    { regex: /\b(tata motors(?: limited)?)\b/i, name: 'Tata Motors Limited' },
    { regex: /\b(blue dart(?: express)?(?: ltd)?)\b/i, name: 'Blue Dart Express Ltd' },
    { regex: /\b(navneet(?: stationery)?)\b/i, name: 'Navneet Stationery Mart' },
    { regex: /\b(lenovo(?: india)?)\b/i, name: 'Lenovo India Pvt Ltd' },
    { regex: /\b(dell(?: technologies)?)\b/i, name: 'Dell Technologies India' },
    { regex: /\b(aws|amazon web services)\b/i, name: 'Amazon Web Services India' },
    { regex: /\b(airtel|bharti airtel)\b/i, name: 'Bharti Airtel Limited' },
    { regex: /\b(jio|reliance jio)\b/i, name: 'Reliance Jio Infocomm Ltd' },
    { regex: /\b(infosys)\b/i, name: 'Infosys Limited' },
    { regex: /\b(wipro)\b/i, name: 'Wipro Technologies' },
    { regex: /\b(larsen & toubro|l&t)\b/i, name: 'Larsen & Toubro Ltd' },
    { regex: /\b(nariman properties|landlord|office owner)\b/i, name: 'Nariman Properties LLP' },
    { regex: /\b(reliance digital|reliance retail)\b/i, name: 'Reliance Retail Limited' },
    { regex: /\b(office depot)\b/i, name: 'Office Depot Solutions' },
  ];

  for (const kp of knownParties) {
    if (kp.regex.test(text)) {
      return kp.name;
    }
  }

  // Regex extraction for "to <Party>" or "from <Party>"
  // e.g. "paid 15000 to Infotech Solutions for consulting"
  const partyMatch = text.match(/(?:to|from|for|by)\s+([A-Z][A-Za-z0-9&.\s]{2,28}?)(?=\s+(?:for|via|by|with|at|through|in|having|\d|cash|bank|gst|rs|rupees|$))/i);
  if (partyMatch && partyMatch[1].trim()) {
    const candidate = partyMatch[1].trim();
    // Filter out common stop words
    if (!/^(the|a|an|office|bank|cash|cheque|corporate|personal|quarterly|monthly|annual)$/i.test(candidate)) {
      return candidate.replace(/\b\w/g, l => l.toUpperCase());
    }
  }

  if (voucherType === 'Receipt') return 'Enterprise Client Corp';
  if (voucherType === 'Purchase') return 'Authorized Supply Vendor';
  return 'Local Commercial Vendor';
}

/**
 * Maps voice description to standard Tally Chart of Accounts.
 */
export function extractLedgerHead(text: string, voucherType: VoucherType): string {
  const lower = text.toLowerCase();

  if (voucherType === 'Sales' || voucherType === 'Receipt') {
    return 'Software Consulting & Service Revenue';
  }

  if (/\b(laptops?|computers?|hardware|monitors?|keyboards?|printers?|server machines?|macbooks?|dell|lenovo)\b/.test(lower)) {
    return 'Computer & Hardware Equipment A/c';
  }
  if (/\b(software|cloud|aws|azure|subscriptions?|saas|hosting|google workspace|domain|api)\b/.test(lower)) {
    return 'Software & Cloud Subscriptions';
  }
  if (/\b(rent|workspace|office space|office rent|deposit|premises|lease)\b/.test(lower)) {
    return 'Office Rent & Workspace Expense';
  }
  if (/\b(stationery|printing|cartridges?|paper|office supplies|navneet)\b/.test(lower)) {
    return 'Office Rent & Workspace Expense';
  }
  if (/\b(courier|freight|transport|delivery|shipping|logistics|parcel|blue dart|fedex)\b/.test(lower)) {
    return 'Freight & Local Transport Charges';
  }
  if (/\b(internet|wifi|broadband|telecom|phone|mobile bill|recharge|airtel|jio)\b/.test(lower)) {
    return 'Internet & Telecom Expenses';
  }
  if (/\b(tea|coffee|lunch|dinner|snacks|refreshment|staff|welfare|pantry|food)\b/.test(lower)) {
    return 'Staff Welfare & Refreshment';
  }
  if (/\b(legal|consulting|lawyer|advocate|ca fee|statutory audit|professional fees?)\b/.test(lower)) {
    return 'Legal & Professional Consulting Fees';
  }
  if (/\b(petty cash|cash)\b/.test(lower)) {
    return 'Petty Cash A/c';
  }

  if (voucherType === 'Purchase') {
    return 'Office Rent & Workspace Expense';
  }

  return 'Legal & Professional Consulting Fees';
}

/**
 * Parses full natural language voice prompt into a statutory Tally TransactionEntry.
 */
export function parseVoiceToTransaction(rawText: string): TransactionEntry {
  const text = rawText.trim();
  const lower = text.toLowerCase();
  const voucherType = extractVoucherType(text);
  const amount = extractAmountFromVoiceText(text);
  const gstRate = extractGstRate(text);
  const party = extractPartyName(text, voucherType);
  const ledger = extractLedgerHead(text, voucherType);
  const entryDate = extractDateFromVoiceText(text);

  // Interstate check (IGST vs CGST/SGST)
  // If text mentions interstate, igst, or party is outside Maharashtra (27)
  const isInterState = /\b(igst|interstate|outside state|gujarat|delhi|bangalore|karnataka)\b/.test(lower) || party.includes('Tata Motors') || party.includes('Lenovo');
  const partyGstin = isInterState ? '24AABCT9981K1Z2' : '27AAACB9021L1ZM';

  // Double-entry calculation
  const subtotal = Math.round((amount / (1 + gstRate / 100)) * 100) / 100;
  const totalTax = Math.round((amount - subtotal) * 100) / 100;
  const halfTax = Math.round((totalTax / 2) * 100) / 100;

  const cgst = isInterState ? 0 : halfTax;
  const sgst = isInterState ? 0 : halfTax;
  const igst = isInterState ? totalTax : 0;

  const debit = voucherType === 'Receipt' || voucherType === 'Sales' ? 0 : amount;
  const credit = voucherType === 'Receipt' || voucherType === 'Sales' ? amount : 0;

  const uniqueId = Date.now();
  const invNumber = `VOICE-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    id: `tx-voice-${uniqueId}`,
    documentId: `doc-voice-${uniqueId}`,
    invoiceNumber: invNumber,
    referenceNumber: `AUDIO-REC-${entryDate.replace(/-/g, '')}`,
    date: entryDate,
    voucherType,
    ledger,
    party,
    partyGstin,
    amount,
    debit,
    credit,
    gstRate,
    cgst,
    sgst,
    igst,
    isInterState,
    narration: `Voice memo transcribed: "${text}"`,
    confidence: {
      overall: 95,
      ledger: 96,
      amount: 98,
      party: 92,
      date: 97,
      voucherType: 96,
    },
    status: 'Pending',
    document: {
      id: `doc-voice-${uniqueId}`,
      name: `Voice_Memo_${invNumber}.wav`,
      fileType: 'voice',
      fileSize: '512 KB',
      uploadDate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      vendorName: party,
      invoiceNo: invNumber,
      date: entryDate,
      subtotal,
      taxAmount: totalTax,
      totalAmount: amount,
      taxRate: gstRate,
      gstin: partyGstin,
      lineItems: [
        {
          description: text.length > 80 ? text.substring(0, 80) + '...' : text,
          hsnCode: voucherType === 'Purchase' || ledger.includes('Equipment') ? '8471' : '9983',
          qty: 1,
          unitPrice: subtotal,
          amount: subtotal,
        }
      ]
    }
  };
}
