import clsx, { type ClassValue } from 'clsx';

export const cn = (...v: ClassValue[]) => clsx(v);

export function uid(prefix = ''): string {
  const c = globalThis.crypto;
  const raw =
    c && typeof c.randomUUID === 'function'
      ? c.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefix ? `${prefix}_${raw}` : raw;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function pluralize(n: number, word: string, plural = `${word}s`) {
  return `${n.toLocaleString('en-PK')} ${n === 1 ? word : plural}`;
}

export function formatNumber(n: number) {
  return n.toLocaleString('en-PK');
}

export function formatPercent(n: number, digits = 1) {
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

/** Stable seeded PRNG (mulberry32) for deterministic demo data. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers: string[], rows: unknown[][]): string {
  return '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function phoneValid(p: string) {
  return /^[+\d][\d\s-]{6,16}$/.test(p.trim());
}

export function emailValid(e: string) {
  return e.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}
