import { create } from 'zustand';
import { rangeFromPreset, type DateRange } from '@/lib/dates';

/** Ephemeral UI state shared across pages (not persisted). */
export const useUI = create<{ range: DateRange; setRange: (r: DateRange) => void }>((set) => ({
  range: rangeFromPreset('30d'),
  setRange: (range) => set({ range }),
}));
