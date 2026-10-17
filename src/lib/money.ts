import type { Money } from './types';

let currencyCode = 'PKR';
let localeCode = 'en-PK';
const cache = new Map<string, Intl.NumberFormat>();

export function configureMoney(currency: string, locale: string) {
  currencyCode = currency;
  localeCode = locale;
}

function fmt(fractions: number, compact = false) {
  const key = `${localeCode}|${currencyCode}|${fractions}|${compact}`;
  let f = cache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(localeCode, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: compact ? 0 : fractions,
        maximumFractionDigits: compact ? 1 : fractions,
        notation: compact ? 'compact' : 'standard',
      });
    } catch {
      f = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'PKR',
        minimumFractionDigits: fractions,
        maximumFractionDigits: fractions,
      });
    }
    cache.set(key, f);
  }
  return f;
}

/** Format integer minor units. Whole amounts drop decimals unless `decimals` is set. */
export function formatMoney(minor: Money, opts: { decimals?: boolean } = {}): string {
  const safe = Number.isFinite(minor) ? Math.round(minor) : 0;
  const decimals = opts.decimals ?? safe % 100 !== 0;
  return fmt(decimals ? 2 : 0).format(safe / 100);
}

export function formatMoneyCompact(minor: Money): string {
  return fmt(0, true).format((Number.isFinite(minor) ? minor : 0) / 100);
}

/** Convert a user-entered major-unit value (e.g. "1,250.50") to minor units. Returns NaN when invalid. */
export function toMinor(input: string | number): Money {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : NaN;
  const cleaned = input.replace(/[,\s]/g, '').trim();
  if (cleaned === '' || !/^-?\d+(\.\d{0,2})?$/.test(cleaned)) return NaN;
  const negative = cleaned.startsWith('-');
  const [whole, frac = ''] = cleaned.replace('-', '').split('.');
  const minor = parseInt(whole, 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
  return negative ? -minor : minor;
}

export function toMajorString(minor: Money): string {
  const v = Math.round(minor);
  return v % 100 === 0 ? String(v / 100) : (v / 100).toFixed(2);
}

/** Percentage of a minor amount using integer basis points, rounded half away from zero. */
export function percentOf(minor: Money, percent: number): Money {
  const bps = Math.round(percent * 100);
  const raw = (minor * bps) / 10000;
  return Math.sign(raw) * Math.round(Math.abs(raw));
}

export function sumMoney(values: Money[]): Money {
  return values.reduce((a, b) => a + b, 0);
}
