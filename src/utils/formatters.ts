/**
 * Format number into Indian Rupee format (Lakhs & Crores)
 * e.g., 142800 -> ₹1,42,800.00
 */
export function formatCurrencyINR(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  const parts = absAmount.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  return `${isNegative ? '-' : ''}₹${formattedInteger}.${decimalPart}`;
}

/**
 * Gets today's local date formatted as YYYY-MM-DD (prevents UTC timezone shift).
 */
export function getTodayLocalDateISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets current local timestamp formatted as YYYY-MM-DD HH:mm:ss.
 */
export function getNowLocalTimestamp(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Normalizes any date format (DD/MM/YYYY, DD-MM-YYYY, YYYYMMDD) into strict YYYY-MM-DD ISO format
 * so that HTML5 <input type="date"> renders accurately without showing blank.
 */
export function normalizeDateToISO(dateStr: string | undefined | null): string {
  if (!dateStr) return getTodayLocalDateISO();
  const cleaned = String(dateStr).trim();

  // Already standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

  // 8-digit Tally format YYYYMMDD
  if (/^\d{8}$/.test(cleaned)) {
    return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 6)}-${cleaned.substring(6, 8)}`;
  }

  // Split by / or - or .
  const parts = cleaned.split(/[\/\-\.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY/MM/DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else {
      // DD/MM/YYYY
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return getTodayLocalDateISO();
}

/**
 * Formats any date string into standard Indian statutory format: DD/MM/YYYY
 */
export function formatDateIndian(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const iso = normalizeDateToISO(dateStr);
  const parts = iso.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Formats any date into official 8-digit Tally Prime format: YYYYMMDD
 */
export function formatDateTally(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const iso = normalizeDateToISO(dateStr);
  return iso.replace(/-/g, '');
}

export function getConfidenceBadgeColor(score: number): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  if (score >= 90) {
    return {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      label: 'High Confidence',
    };
  }
  if (score >= 75) {
    return {
      bg: 'bg-amber-500/15',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      label: 'Needs Verification',
    };
  }
  return {
    bg: 'bg-rose-500/15',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    label: 'Low - Review Required',
  };
}

export function getVoucherTypeColor(type: string): string {
  switch (type) {
    case 'Purchase':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'Sales':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'Payment':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'Receipt':
      return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
    case 'Journal':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'Contra':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}
