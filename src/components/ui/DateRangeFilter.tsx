import { CalendarDays } from 'lucide-react';
import { PRESET_LABEL, rangeFromPreset, type DateRange, type RangePreset } from '@/lib/dates';
import { Input, Select } from './Field';

const PRESETS: RangePreset[] = ['today', '7d', '30d', '90d', 'month', 'lastMonth', 'custom'];

export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
        <label htmlFor="range-preset" className="sr-only">
          Date range
        </label>
        <Select
          id="range-preset"
          className="w-[170px] pl-9"
          value={value.preset}
          onChange={(e) => {
            const p = e.target.value as RangePreset;
            onChange(p === 'custom' ? { ...value, preset: 'custom' } : rangeFromPreset(p));
          }}
        >
          {PRESETS.map((p) => (
            <option key={p} value={p}>
              {PRESET_LABEL[p]}
            </option>
          ))}
        </Select>
      </div>
      {value.preset === 'custom' && (
        <div className="flex items-center gap-1.5">
          <label htmlFor="range-from" className="sr-only">
            From
          </label>
          <Input
            id="range-from"
            type="date"
            className="w-[150px]"
            value={value.from}
            max={value.to}
            onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
          />
          <span className="text-sm text-ink-400">to</span>
          <label htmlFor="range-to" className="sr-only">
            To
          </label>
          <Input
            id="range-to"
            type="date"
            className="w-[150px]"
            value={value.to}
            min={value.from}
            onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
