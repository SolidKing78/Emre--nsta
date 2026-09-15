import type { DateRange, DateRangePreset } from '@/types/app';

export type DateLocale = 'en' | 'tr';

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function daysBetween(since: string, until: string): number {
  const a = parseISODate(since).getTime();
  const b = parseISODate(until).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

export function buildDateRange(
  preset: DateRangePreset,
  now: Date = new Date(),
  custom?: { since: string; until: string },
): DateRange {
  const until = toISODate(now);
  if (preset === 'custom' && custom) {
    return { preset, since: custom.since, until: custom.until };
  }
  const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 30;
  const since = toISODate(addDays(now, -(days - 1)));
  return { preset: preset === 'custom' ? '30d' : preset, since, until };
}

/** The equally-sized period right before `range` (for period-over-period deltas). */
export function previousRange(range: DateRange): DateRange {
  const days = daysBetween(range.since, range.until);
  const until = addDays(parseISODate(range.since), -1);
  const since = addDays(until, -(days - 1));
  return { preset: 'custom', since: toISODate(since), until: toISODate(until) };
}

export function eachDay(range: DateRange): string[] {
  const days = daysBetween(range.since, range.until);
  const start = parseISODate(range.since);
  const out: string[] = [];
  for (let i = 0; i < days; i += 1) out.push(toISODate(addDays(start, i)));
  return out;
}

export function isWithinRange(isoTimestamp: string, range: DateRange): boolean {
  const day = toISODate(new Date(isoTimestamp));
  return day >= range.since && day <= range.until;
}

const MONTHS: Record<DateLocale, string[]> = {
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  tr: [
    'Ocak',
    'Şubat',
    'Mart',
    'Nisan',
    'Mayıs',
    'Haziran',
    'Temmuz',
    'Ağustos',
    'Eylül',
    'Ekim',
    'Kasım',
    'Aralık',
  ],
};

const MONTHS_SHORT: Record<DateLocale, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
};

const WEEKDAYS_SHORT: Record<DateLocale, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  tr: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
};

export function formatPostDate(iso: string, locale: DateLocale, now: Date = new Date()): string {
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  if (diffH < 1) {
    const mins = Math.max(1, Math.floor(diffMs / 60_000));
    return locale === 'tr' ? `${mins} dakika önce` : `${mins} minutes ago`;
  }
  if (diffH < 24) return locale === 'tr' ? `${diffH} saat önce` : `${diffH} hours ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return locale === 'tr' ? `${diffD} gün önce` : `${diffD} days ago`;
  const month = MONTHS[locale][date.getMonth()] ?? '';
  const sameYear = date.getFullYear() === now.getFullYear();
  if (locale === 'tr') {
    return sameYear ? `${date.getDate()} ${month}` : `${date.getDate()} ${month} ${date.getFullYear()}`;
  }
  return sameYear ? `${month} ${date.getDate()}` : `${month} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Compact relative like Instagram activity: 3s, 5d, 2w */
export function formatRelativeShort(iso: string, locale: DateLocale, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return locale === 'tr' ? `${s}sn` : `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return locale === 'tr' ? `${m}dk` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return locale === 'tr' ? `${h}sa` : `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return locale === 'tr' ? `${d}g` : `${d}d`;
  const w = Math.floor(d / 7);
  return locale === 'tr' ? `${w}h` : `${w}w`;
}

export function formatShortDate(iso: string, locale: DateLocale): string {
  const date = iso.length === 10 ? parseISODate(iso) : new Date(iso);
  const month = MONTHS_SHORT[locale][date.getMonth()] ?? '';
  return locale === 'tr' ? `${date.getDate()} ${month}` : `${month} ${date.getDate()}`;
}

export function formatLongDate(iso: string, locale: DateLocale): string {
  const date = iso.length === 10 ? parseISODate(iso) : new Date(iso);
  const month = MONTHS[locale][date.getMonth()] ?? '';
  return locale === 'tr'
    ? `${date.getDate()} ${month} ${date.getFullYear()}`
    : `${month} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatWeekday(iso: string, locale: DateLocale): string {
  const date = iso.length === 10 ? parseISODate(iso) : new Date(iso);
  return WEEKDAYS_SHORT[locale][date.getDay()] ?? '';
}

export function hourOf(iso: string): number {
  return new Date(iso).getHours();
}
