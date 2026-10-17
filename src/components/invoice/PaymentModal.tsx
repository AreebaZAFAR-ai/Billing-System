import { useEffect, useState } from 'react';
import { Banknote, CreditCard, Landmark, Smartphone } from 'lucide-react';
import { outstanding, validatePayment } from '@/lib/billing';
import { formatMoney, toMajorString, toMinor } from '@/lib/money';
import type { Invoice, PaymentMethod } from '@/lib/types';
import { useStore } from '@/store/store';
import { Button } from '@/components/ui/Button';
import { Field, Input, MoneyInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

export const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'bank', label: 'Bank transfer', icon: Landmark },
  { value: 'wallet', label: 'Mobile wallet', icon: Smartphone },
];

export function MethodPicker({ value, onChange, compact }: { value: PaymentMethod; onChange: (m: PaymentMethod) => void; compact?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Payment method" className={cn('grid gap-2', compact ? 'grid-cols-4' : 'grid-cols-2 sm:grid-cols-4')}>
      {METHODS.map((m) => (
        <button
          key={m.value}
          type="button"
          role="radio"
          aria-checked={value === m.value}
          onClick={() => onChange(m.value)}
          className={cn(
            'flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            value === m.value ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
          )}
        >
          <m.icon className="h-4 w-4" aria-hidden />
          <span className="text-center leading-tight">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

export function PaymentModal({ invoice, open, onClose }: { invoice: Invoice; open: boolean; onClose: () => void }) {
  const recordPayment = useStore((s) => s.recordPayment);
  const balance = outstanding(invoice);
  const [amount, setAmount] = useState(toMajorString(balance));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(toMajorString(outstanding(invoice)));
      setTendered('');
      setReference('');
      setTouched(false);
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice.id]);

  const amt = toMinor(amount);
  const err = validatePayment(balance, amt);
  const tend = tendered === '' ? undefined : toMinor(tendered);
  const tendErr = method === 'cash' && tend !== undefined && (Number.isNaN(tend) || tend < (Number.isNaN(amt) ? 0 : amt)) ? 'Cash received must cover the payment amount.' : null;
  const remaining = Number.isNaN(amt) ? balance : Math.max(0, balance - amt);

  const submit = () => {
    setTouched(true);
    if (err || tendErr || submitting) return;
    setSubmitting(true);
    const res = recordPayment(invoice.industry, invoice.id, { amount: amt, method, tendered: tend, reference });
    if (res.ok) {
      toast.success('Payment recorded (simulated)', `${formatMoney(amt)} on ${invoice.number}`);
      onClose();
    } else {
      toast.error('Could not record payment', res.error);
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record payment"
      description={`${invoice.number} · ${invoice.customerName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting} disabled={balance <= 0}>
            Record {Number.isNaN(amt) ? '' : formatMoney(amt)}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid grid-cols-3 gap-2 rounded-lg bg-ink-50 p-3 text-center text-xs">
          <div>
            <p className="text-ink-500">Total</p>
            <p className="mt-0.5 font-semibold tabular-nums text-ink-900">{formatMoney(invoice.total)}</p>
          </div>
          <div>
            <p className="text-ink-500">Outstanding</p>
            <p className="mt-0.5 font-semibold tabular-nums text-amber-700">{formatMoney(balance)}</p>
          </div>
          <div>
            <p className="text-ink-500">After payment</p>
            <p className="mt-0.5 font-semibold tabular-nums text-ink-900">{formatMoney(remaining)}</p>
          </div>
        </div>
        <Field label="Payment method">
          <MethodPicker value={method} onChange={setMethod} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount" htmlFor="pay-amount" error={touched ? err : null} hint="Part payments are allowed.">
            <MoneyInput id="pay-amount" value={amount} onChange={(e) => setAmount(e.target.value)} invalid={touched && !!err} data-autofocus />
          </Field>
          {method === 'cash' ? (
            <Field label="Cash received (optional)" htmlFor="pay-tendered" error={tendErr} hint={tend && !tendErr && !Number.isNaN(amt) ? `Change: ${formatMoney(tend - amt)}` : undefined}>
              <MoneyInput id="pay-tendered" value={tendered} onChange={(e) => setTendered(e.target.value)} invalid={!!tendErr} />
            </Field>
          ) : (
            <Field label="Reference (optional)" htmlFor="pay-ref" hint="e.g. last 4 digits or transfer ID">
              <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={40} />
            </Field>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {[0.25, 0.5, 1].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setAmount(toMajorString(Math.round(balance * f)))}
              className="rounded-full border border-ink-200 px-2.5 py-1 text-xs text-ink-600 hover:bg-ink-50"
            >
              {f === 1 ? 'Full balance' : `${f * 100}%`}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-500">Demo mode: this records a simulated payment only. No money is moved.</p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
