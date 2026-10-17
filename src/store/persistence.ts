/**
 * Safe client-side persistence for demo data. Browser storage is NOT a secure database —
 * it only keeps simulated demo transactions between page loads on this device.
 */
import type { Industry, IndustryData, Settings } from '@/lib/types';
import { INDUSTRIES } from '@/lib/types';

export const SCHEMA_VERSION = 4;
const PREFIX = 'billora';
const metaKey = `${PREFIX}:meta`;
const dataKey = (i: Industry) => `${PREFIX}:data:${i}`;

export interface PersistedMeta {
  version: number;
  seededAt: string;
  activeIndustry: Industry;
  settings: Settings;
}

let available: boolean | null = null;

export function storageAvailable(): boolean {
  if (available !== null) return available;
  try {
    const k = `${PREFIX}:probe`;
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

function read<T>(key: string): T | null {
  if (!storageAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export type WriteResult = 'ok' | 'unavailable' | 'quota';

function write(key: string, value: unknown): WriteResult {
  if (!storageAvailable()) return 'unavailable';
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return 'ok';
  } catch {
    return 'quota';
  }
}

function isIndustryData(x: unknown): x is IndustryData {
  if (!x || typeof x !== 'object') return false;
  const d = x as Record<string, unknown>;
  return (
    Array.isArray(d.invoices) &&
    Array.isArray(d.customers) &&
    Array.isArray(d.catalog) &&
    Array.isArray(d.staff) &&
    Array.isArray(d.appointments) &&
    Array.isArray(d.admissions) &&
    Array.isArray(d.activities) &&
    typeof d.invoiceSeq === 'number'
  );
}

function isMeta(x: unknown): x is PersistedMeta {
  if (!x || typeof x !== 'object') return false;
  const m = x as Partial<PersistedMeta>;
  return (
    m.version === SCHEMA_VERSION &&
    typeof m.seededAt === 'string' &&
    !!m.activeIndustry &&
    INDUSTRIES.includes(m.activeIndustry) &&
    !!m.settings?.global &&
    !!m.settings?.businesses &&
    INDUSTRIES.every((i) => !!m.settings!.businesses[i])
  );
}

export interface LoadedState {
  meta: PersistedMeta;
  data: Record<Industry, IndustryData>;
}

/** Returns null when nothing valid is stored (missing, corrupted or outdated schema). */
export function loadPersisted(): LoadedState | null {
  const meta = read<unknown>(metaKey);
  if (!isMeta(meta)) return null;
  const data = {} as Record<Industry, IndustryData>;
  for (const i of INDUSTRIES) {
    const d = read<unknown>(dataKey(i));
    if (!isIndustryData(d)) return null;
    data[i] = d;
  }
  return { meta, data };
}

export function saveMeta(meta: PersistedMeta): WriteResult {
  return write(metaKey, meta);
}

export function saveIndustry(i: Industry, d: IndustryData): WriteResult {
  return write(dataKey(i), d);
}

export function clearPersisted() {
  if (!storageAvailable()) return;
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith(`${PREFIX}:`))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
