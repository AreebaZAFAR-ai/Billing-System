import type { Totals } from '@/lib/billing';
import { formatMoney } from '@/lib/money';
import type { DiscountType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Checkbox, Input, Segmented } from '@/components/ui/Field';

export function DiscountControl({
  type,
  value,
  onType,
  onValue,
  error,
}: {
  type: DiscountType;
  value: string;
  onType: (t: DiscountType) => void;
  onValue: (v: string) => void;
  error?: string | null;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <label htmlFor="discount-value" className="w-16 shrink-0 text-[13px] text-ink-600">
          Discount
        </label>
        <Segmented
          label="Discount type"
          size="sm"
          value={type}
          onChange={onType}
          options={[
            { value: 'percent', label: '%' },
            { value: 'fixed', label: 'Rs' },
          ]}
        />
        <Input
          id="discount-value"
          className="h-8 text-right tabular-nums"
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={(e) => onValue(e.target.value)}
          invalid={!!error}
        />
      </div>
      {error && (
        <p className="mt-1 text-right text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TaxControl({
  enabled,
  rate,
  label,
  onEnabled,
  onRate,
}: {
  enabled: boolean;
  rate: string;
  label: string;
  onEnabled: (v: boolean) => void;
  onRate: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Checkbox label={`Apply ${label.toLowerCase()}`} checked={enabled} onChange={onEnabled} />
      {enabled && (
        <div className="flex items-center gap-1">
          <label htmlFor="tax-rate" className="sr-only">
            Tax rate percent
          </label>
          <Input id="tax-rate" className="h-8 w-16 text-right tabular-nums" inputMode="decimal" value={rate} onChange={(e) => onRate(e.target.value)} />
          <span className="text-sm text-ink-500">%</span>
        </div>
      )}
    </div>
  );
}

export function TotalsPanel({ totals, taxLabel, taxRate, className }: { totals: Totals; taxLabel: string; taxRate: number; className?: string }) {
  return (
    <dl className={cn('space-y-1.5 text-sm', className)}>
      <div className="flex justify-between">
        <dt className="text-ink-500">Subtotal</dt>
        <dd className="tabular-nums text-ink-800">{formatMoney(totals.subtotal)}</dd>
      </div>
      {totals.discountAmount > 0 && (
        <div className="flex justify-between">
          <dt className="text-ink-500">Discount</dt>
          <dd className="tabular-nums text-emerald-700">− {formatMoney(totals.discountAmount)}</dd>
        </div>
      )}
      {totals.taxAmount > 0 && (
        <div className="flex justify-between">
          <dt className="text-ink-500">
            {taxLabel} ({taxRate}%)
          </dt>
          <dd className="tabular-nums text-ink-800">{formatMoney(totals.taxAmount)}</dd>
        </div>
      )}
      <div className="flex items-baseline justify-between border-t border-ink-200 pt-2">
        <dt className="font-semibold text-ink-900">Total</dt>
        <dd className="text-xl font-semibold tabular-nums text-ink-900">{formatMoney(totals.total)}</dd>
      </div>
    </dl>
  );
}

/** Parse discount/tax text inputs into safe numbers + validation messages. */
export function parseDiscount(type: DiscountType, raw: string, subtotal: number) {
  if (raw.trim() === '') return { discount: { type, value: 0 }, error: null as string | null };
  const n = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return { discount: { type, value: 0 }, error: 'Enter a positive number.' };
  if (type === 'percent') {
    if (n > 100) return { discount: { type, value: 0 }, error: 'Cannot exceed 100%.' };
    return { discount: { type, value: Math.round(n * 100) / 100 }, error: null };
  }
  const minor = Math.round(n * 100);
  if (minor > subtotal) return { discount: { type, value: 0 }, error: 'Cannot exceed the subtotal.' };
  return { discount: { type, value: minor }, error: null };
}

export function parseRate(raw: string) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 50) return { rate: 0, error: 'Tax rate must be between 0 and 50%.' };
  return { rate: Math.round(n * 100) / 100, error: null as string | null };
}
