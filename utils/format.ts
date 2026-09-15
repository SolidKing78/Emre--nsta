export type NumberLocale = 'en' | 'tr';

const GROUP: Record<NumberLocale, string> = { en: ',', tr: '.' };
const DECIMAL: Record<NumberLocale, string> = { en: '.', tr: ',' };
const SUFFIX: Record<NumberLocale, { k: string; m: string; b: string }> = {
  en: { k: 'K', m: 'M', b: 'B' },
  tr: { k: ' B', m: ' Mn', b: ' Mr' },
};

/** 12483 -> "12,483" (en) / "12.483" (tr) */
export function formatNumber(value: number, locale: NumberLocale = 'en'): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP[locale]);
  return sign + grouped;
}

function trimZeros(text: string, decimalSep: string): string {
  if (!text.includes(decimalSep)) return text;
  const stripped = text.replace(/0+$/, '');
  return stripped.endsWith(decimalSep) ? stripped.slice(0, -1) : stripped;
}

/**
 * Instagram-style compact numbers.
 * 12500 -> 12.5K, 1250000 -> 1.25M, 999 -> 999
 * Turkish: 12,5 B / 1,25 Mn
 */
export function formatCompact(value: number, locale: NumberLocale = 'en'): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const dec = DECIMAL[locale];
  const suffix = SUFFIX[locale];

  const fmt = (n: number, unit: string, maxDecimals: number): string => {
    const factor = Math.pow(10, maxDecimals);
    const truncated = Math.floor(n * factor + 1e-9) / factor;
    const text = truncated.toFixed(maxDecimals).replace('.', dec);
    return sign + trimZeros(text, dec) + unit;
  };

  if (abs < 1000) return sign + Math.round(abs).toString();
  if (abs < 100_000) return fmt(abs / 1000, suffix.k, 1);
  if (abs < 1_000_000) return fmt(abs / 1000, suffix.k, 0);
  if (abs < 10_000_000) return fmt(abs / 1_000_000, suffix.m, 2);
  if (abs < 1_000_000_000) return fmt(abs / 1_000_000, suffix.m, 1);
  return fmt(abs / 1_000_000_000, suffix.b, 2);
}

/** "+18.4%" (en) / "+%18,4" (tr) */
export function formatPercent(value: number, locale: NumberLocale = 'en', digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  const text = Math.abs(value).toFixed(digits).replace('.', DECIMAL[locale]);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return locale === 'tr' ? `${sign}%${text}` : `${sign}${text}%`;
}

export function percentChange(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Parse "12.500" / "12,500" / "12500" / "12.5K" / "1,2 Mn" into a number. */
export function parseNumericInput(text: string): number | null {
  const cleaned = text.trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) return null;
  const compact = cleaned.match(/^([\d.,]+)(K|B|M|MN)?$/);
  if (!compact) return null;
  const raw = compact[1] ?? '';
  const unit = compact[2];
  // Remove thousands separators (., or , followed by exactly 3 digits) then treat the rest as decimal.
  const withoutGroups = raw.replace(/[.,](?=\d{3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?$)/g, '');
  const normalized = withoutGroups.replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num)) return null;
  if (unit === 'K' || unit === 'B') return Math.round(num * 1000);
  if (unit === 'M' || unit === 'MN') return Math.round(num * 1_000_000);
  return Math.round(num);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/** Instagram's watch-time style: "30sn" / "1dk 05sn" (tr), "30s" / "1m 05s" (en). */
export function formatWatchTime(seconds: number, locale: NumberLocale = 'en'): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const sec = locale === 'tr' ? 'sn' : 's';
  const min = locale === 'tr' ? 'dk' : 'm';
  if (m === 0) return `${r}${sec}`;
  return `${m}${min} ${r.toString().padStart(2, '0')}${sec}`;
}

export function safeDivide(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}
