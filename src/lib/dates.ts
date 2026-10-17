export const DAY_MS = 86_400_000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Local yyyy-mm-dd */
export function toDateKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toMonthKey(d: Date | string): string {
  return toDateKey(d).slice(0, 7);
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

const dateFmt = new Intl.DateTimeFormat('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('en-PK', { day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('en-PK', { hour: 'numeric', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('en-PK', { month: 'short', year: 'numeric' });

/** Parses ISO timestamps, and treats bare yyyy-mm-dd keys as local dates. */
const asDate = (d: Date | string) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? fromDateKey(d) : new Date(d));

export const formatDate = (d: Date | string) => dateFmt.format(asDate(d));
export const formatShortDate = (d: Date | string) => shortFmt.format(asDate(d));
export const formatTime = (d: Date | string) => timeFmt.format(new Date(d));
export const formatDateTime = (d: Date | string) => `${formatDate(d)}, ${formatTime(d)}`;
export const formatMonth = (key: string) => monthFmt.format(fromDateKey(`${key}-01`));

export function formatTimeOfDay(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return formatTime(d);
}

export function relativeTime(iso: string, now = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(iso);
}

export type RangePreset = 'today' | '7d' | '30d' | '90d' | 'month' | 'lastMonth' | 'custom';

export interface DateRange {
  preset: RangePreset;
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
}

export const PRESET_LABEL: Record<RangePreset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  month: 'This month',
  lastMonth: 'Last month',
  custom: 'Custom',
};

export function rangeFromPreset(preset: RangePreset, now = new Date()): DateRange {
  const today = startOfDay(now);
  switch (preset) {
    case 'today':
      return { preset, from: toDateKey(today), to: toDateKey(today) };
    case '7d':
      return { preset, from: toDateKey(addDays(today, -6)), to: toDateKey(today) };
    case '30d':
      return { preset, from: toDateKey(addDays(today, -29)), to: toDateKey(today) };
    case '90d':
      return { preset, from: toDateKey(addDays(today, -89)), to: toDateKey(today) };
    case 'month':
      return { preset, from: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: toDateKey(today) };
    case 'lastMonth': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { preset, from: toDateKey(first), to: toDateKey(last) };
    }
    default:
      return { preset: 'custom', from: toDateKey(addDays(today, -29)), to: toDateKey(today) };
  }
}

export function inRange(iso: string, range: Pick<DateRange, 'from' | 'to'>): boolean {
  const key = toDateKey(iso);
  return key >= range.from && key <= range.to;
}

export function eachDay(range: Pick<DateRange, 'from' | 'to'>): string[] {
  const out: string[] = [];
  let d = fromDateKey(range.from);
  const end = fromDateKey(range.to);
  let guard = 0;
  while (d <= end && guard < 800) {
    out.push(toDateKey(d));
    d = addDays(d, 1);
    guard++;
  }
  return out;
}

export function rangeLengthDays(range: Pick<DateRange, 'from' | 'to'>): number {
  return Math.round((fromDateKey(range.to).getTime() - fromDateKey(range.from).getTime()) / DAY_MS) + 1;
}

/** Previous period of identical length, for comparisons. */
export function previousRange(range: Pick<DateRange, 'from' | 'to'>): { from: string; to: string } {
  const len = rangeLengthDays(range);
  const from = addDays(fromDateKey(range.from), -len);
  const to = addDays(fromDateKey(range.from), -1);
  return { from: toDateKey(from), to: toDateKey(to) };
}

export function daysBetween(a: string | Date, b: string | Date): number {
  return Math.round((startOfDay(new Date(b)).getTime() - startOfDay(new Date(a)).getTime()) / DAY_MS);
}
