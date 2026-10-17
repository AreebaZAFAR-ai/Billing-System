import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Minus, Plus, Trash2, FileCheck2, PackageSearch } from 'lucide-react';
import { computeTotals, lineTotal, roundToUnit, validatePayment } from '@/lib/billing';
import { formatMoney, percentOf, toMajorString, toMinor } from '@/lib/money';
import type { CatalogItem, Industry, Invoice, InvoiceMeta, LineItem, PaymentMethod, DiscountType } from '@/lib/types';
import { useStore } from '@/store/store';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { cn, uid } from '@/lib/utils';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Field, MoneyInput, SearchInput, Segmented, Select, Textarea } from '@/components/ui/Field';
import { toast } from '@/components/ui/Toast';
import { CustomerPicker } from '@/components/customers/CustomerPicker';
import { DiscountControl, TaxControl, TotalsPanel, parseDiscount, parseRate } from './TotalsPanel';
import { MethodPicker } from './PaymentModal';

export function catalogToLine(c: CatalogItem, extra: Partial<LineItem> = {}): LineItem {
  return {
    id: uid('li'),
    refId: c.id,
    kind: c.kind,
    description: c.name,
    category: c.category,
    quantity: 1,
    unitPrice: c.price,
    unitCost: c.cost,
    departmentId: c.departmentId,
    ...extra,
  };
}

export function CatalogBrowser({
  items,
  onAdd,
  stockOf,
  className,
}: {
  items: CatalogItem[];
  onAdd: (c: CatalogItem) => void;
  stockOf?: (c: CatalogItem) => number | undefined;
  className?: string;
}) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map((i) => i.category)))], [items]);
  const filtered = items.filter(
    (i) =>
      i.active &&
      (cat === 'All' || i.category === cat) &&
      (q.trim() === '' || i.name.toLowerCase().includes(q.toLowerCase()) || i.sku?.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div className={className}>
      <SearchInput placeholder="Search services or items" label="Search catalog" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            aria-pressed={cat === c}
            className={cn(
              'whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              cat === c ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
            )}
          >
            {c}
          </button>
        ))}
      </div>
      <ul className="mt-2 max-h-[420px] divide-y divide-ink-100 overflow-y-auto rounded-lg border border-ink-200">
        {filtered.length === 0 && (
          <li>
            <EmptyState icon={PackageSearch} title="Nothing matches" description="Try another search or category." />
          </li>
        )}
        {filtered.map((c) => {
          const stock = stockOf?.(c) ?? c.stock;
          const out = c.trackStock && (stock ?? 0) <= 0;
          return (
            <li key={c.id}>
              <button
                type="button"
                disabled={out}
                onClick={() => onAdd(c)}
                className="group flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-50/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-900">{c.name}</span>
                  <span className="block truncate text-xs text-ink-500">
                    {c.category}
                    {c.durationMin ? ` · ${c.durationMin} min` : ''}
                    {c.includes ? ` · ${c.includes.join(', ')}` : ''}
                    {c.trackStock ? ` · ${out ? 'Out of stock' : `${stock} in stock`}` : ''}
                  </span>
                </span>
                <span className="text-sm font-medium tabular-nums text-ink-800">{formatMoney(c.price)}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 text-ink-500 group-hover:border-brand-500 group-hover:bg-brand-600 group-hover:text-white">
                  <Plus className="h-4 w-4" aria-hidden />
                  <span className="sr-only">Add {c.name}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface ComposerProps {
  industry: Industry;
  catalog: CatalogItem[];
  initialCustomerId?: string;
  initialItems?: LineItem[];
  lockCustomer?: boolean;
  /** Extra controls above the line items (doctor, department…). */
  context?: ReactNode;
  /** Returns validation error or meta for the invoice. */
  resolveMeta?: () => { error?: string; meta?: InvoiceMeta };
  lineStaff?: { options: { id: string; name: string }[]; defaultId?: string; rateOf: (id: string) => number | undefined };
  quickAdd?: ReactNode | ((add: (c: CatalogItem, extra?: Partial<LineItem>) => void) => ReactNode);
  onCreated: (inv: Invoice) => void;
  submitLabel?: string;
  allowWalkIn?: boolean;
}

export function InvoiceComposer({
  industry,
  catalog,
  initialCustomerId,
  initialItems = [],
  lockCustomer,
  context,
  resolveMeta,
  lineStaff,
  quickAdd,
  onCreated,
  submitLabel = 'Create invoice',
  allowWalkIn,
}: ComposerProps) {
  const cfg = INDUSTRY_CONFIG[industry];
  const biz = useStore((s) => s.settings.businesses[industry]);
  const liveCatalog = useStore((s) => s.data[industry].catalog);
  const createInvoice = useStore((s) => s.createInvoice);
  const [customerId, setCustomerId] = useState<string | undefined>(initialCustomerId);
  const [items, setItems] = useState<LineItem[]>(initialItems);
  const [discType, setDiscType] = useState<DiscountType>('percent');
  const [discRaw, setDiscRaw] = useState('');
  const [taxEnabled, setTaxEnabled] = useState(biz.taxEnabled);
  const [taxRaw, setTaxRaw] = useState(String(biz.taxRate || 0));
  const [payMode, setPayMode] = useState<'full' | 'partial' | 'later'>('full');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [partialRaw, setPartialRaw] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const idemKey = useRef(uid('idem'));

  const rate = parseRate(taxRaw);
  const subtotalOnly = items.reduce((a, l) => a + lineTotal(l), 0);
  const disc = parseDiscount(discType, discRaw, subtotalOnly);
  const totals = computeTotals({ items, discount: disc.discount, taxRate: rate.rate, taxEnabled });
  const partialMinor = toMinor(partialRaw);
  const payAmount = payMode === 'full' ? totals.total : payMode === 'partial' ? partialMinor : 0;
  const payErr =
    payMode === 'partial'
      ? partialRaw === ''
        ? 'Enter the amount received.'
        : validatePayment(totals.total, partialMinor) ?? (partialMinor === totals.total ? 'For a full payment choose “Pay in full”.' : null)
      : null;

  const stockLeft = (c: CatalogItem) => {
    const live = liveCatalog.find((x) => x.id === c.id) ?? c;
    if (!live.trackStock) return undefined;
    const inCart = items.filter((l) => l.refId === c.id).reduce((a, l) => a + l.quantity, 0);
    return (live.stock ?? 0) - inCart;
  };

  const add = (c: CatalogItem, extra: Partial<LineItem> = {}) => {
    setError(null);
    const left = stockLeft(c);
    if (left !== undefined && left <= 0) {
      toast.error('Insufficient stock', `${c.name} has no more units available.`);
      return;
    }
    setItems((prev) => {
      const existing = prev.find((l) => l.refId === c.id && (!lineStaff || l.staffId === (extra.staffId ?? lineStaff.defaultId)));
      if (existing && c.kind === 'product') return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      const staffId = lineStaff && c.kind !== 'product' ? (extra.staffId ?? lineStaff.defaultId) : extra.staffId;
      return [
        ...prev,
        catalogToLine(c, { ...extra, staffId, commissionRate: staffId && c.kind !== 'product' ? lineStaff?.rateOf(staffId) : undefined }),
      ];
    });
  };

  const setQty = (id: string, q: number) => {
    setItems((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const c = l.refId ? liveCatalog.find((x) => x.id === l.refId) : undefined;
        if (c?.trackStock) {
          const others = prev.filter((x) => x.refId === l.refId && x.id !== id).reduce((a, x) => a + x.quantity, 0);
          const max = (c.stock ?? 0) - others;
          if (q > max) {
            toast.error('Insufficient stock', `Only ${max} of ${c.name} available.`);
            return { ...l, quantity: Math.max(1, max) };
          }
        }
        return { ...l, quantity: Math.max(1, Math.min(999, q)) };
      }),
    );
  };

  const setStaff = (id: string, staffId: string) =>
    setItems((prev) =>
      prev.map((l) => (l.id === id ? { ...l, staffId: staffId || undefined, commissionRate: staffId && l.kind !== 'product' ? lineStaff?.rateOf(staffId) : undefined } : l)),
    );

  const submit = () => {
    if (submitting.current) return;
    setError(null);
    if (!customerId && !allowWalkIn) return setError(`Select or register a ${cfg.customer.toLowerCase()}.`);
    if (items.length === 0) return setError('Add at least one item to the invoice.');
    if (disc.error) return setError(disc.error);
    if (taxEnabled && rate.error) return setError(rate.error);
    if (payErr) return setError(payErr);
    const ctx = resolveMeta?.() ?? {};
    if (ctx.error) return setError(ctx.error);
    submitting.current = true;
    const res = createInvoice(industry, {
      customerId,
      items,
      discount: disc.discount,
      taxRate: rate.rate,
      taxEnabled,
      notes,
      meta: ctx.meta,
      payment: payAmount > 0 ? { amount: payAmount, method } : undefined,
      idempotencyKey: idemKey.current,
    });
    if (!res.ok) {
      submitting.current = false;
      setError(res.error);
      return;
    }
    toast.success(`${cfg.invoiceTerm} ${res.value.number} created`, payAmount > 0 ? `Simulated ${method} payment of ${formatMoney(payAmount)} recorded.` : 'Saved as unpaid.');
    onCreated(res.value);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="min-w-0 space-y-5">
        <Card>
          <CardHeader title={cfg.customer} description={lockCustomer ? undefined : `Search existing ${cfg.customers.toLowerCase()} or register a new one.`} />
          <div className="space-y-4 p-5">
            <CustomerPicker industry={industry} value={customerId} onChange={setCustomerId} locked={lockCustomer} allowWalkIn={allowWalkIn} />
            {context}
          </div>
        </Card>
        <Card>
          <CardHeader title="Add charges" description="Click an item to add it to the invoice." />
          <div className="p-5">
            {typeof quickAdd === 'function' ? quickAdd(add) : quickAdd}
            <CatalogBrowser items={catalog} onAdd={(c) => add(c)} stockOf={stockLeft} />
          </div>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-20 lg:self-start">
        <CardHeader title={`New ${cfg.invoiceTerm.toLowerCase()}`} description={`${biz.name} · numbered automatically on save`} />
        <div className="p-5">
          {items.length === 0 ? (
            <EmptyState icon={FileCheck2} title="No charges yet" description="Add services or items from the catalog." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {items.map((l) => (
                <li key={l.id} className="py-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900">{l.description}</p>
                      <p className="text-xs text-ink-500">
                        {l.category} · {formatMoney(l.unitPrice)} each
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-ink-900">{formatMoney(lineTotal(l))}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center rounded-lg border border-ink-200">
                      <IconButton label={`Decrease ${l.description}`} className="h-7 w-7" onClick={() => setQty(l.id, l.quantity - 1)} disabled={l.quantity <= 1}>
                        <Minus className="h-3.5 w-3.5" />
                      </IconButton>
                      <span className="w-8 text-center text-sm tabular-nums" aria-label="Quantity">
                        {l.quantity}
                      </span>
                      <IconButton label={`Increase ${l.description}`} className="h-7 w-7" onClick={() => setQty(l.id, l.quantity + 1)}>
                        <Plus className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                    {lineStaff && (
                      <Select
                        aria-label={`Staff for ${l.description}`}
                        className="h-7 w-auto min-w-[150px] py-0 text-xs"
                        value={l.staffId ?? ''}
                        onChange={(e) => setStaff(l.id, e.target.value)}
                      >
                        <option value="">{l.kind === 'product' ? 'No staff (retail)' : 'Unassigned'}</option>
                        {lineStaff.options.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    )}
                    {lineStaff && l.commissionRate ? (
                      <span className="text-[11px] text-ink-500">
                        Commission {l.commissionRate}% · {formatMoney(roundToUnit(percentOf(lineTotal(l), l.commissionRate)))}
                      </span>
                    ) : null}
                    <IconButton label={`Remove ${l.description}`} className="ml-auto h-7 w-7 hover:text-red-600" onClick={() => setItems((p) => p.filter((x) => x.id !== l.id))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-3 rounded-lg bg-ink-50/70 p-4">
            <DiscountControl type={discType} value={discRaw} onType={setDiscType} onValue={setDiscRaw} error={disc.error} />
            <TaxControl enabled={taxEnabled} rate={taxRaw} label={biz.taxLabel} onEnabled={setTaxEnabled} onRate={setTaxRaw} />
            {taxEnabled && rate.error && <p className="text-xs text-red-600">{rate.error}</p>}
            <TotalsPanel totals={totals} taxLabel={biz.taxLabel} taxRate={taxEnabled ? rate.rate : 0} />
          </div>

          <div className="mt-4 space-y-3">
            <Segmented
              label="Payment"
              value={payMode}
              onChange={(v) => {
                setPayMode(v);
                if (v === 'partial' && partialRaw === '') setPartialRaw(toMajorString(Math.round(totals.total / 2 / 100) * 100));
              }}
              className="w-full"
              options={[
                { value: 'full', label: 'Pay in full' },
                { value: 'partial', label: 'Part payment' },
                { value: 'later', label: 'Bill later' },
              ]}
            />
            {payMode !== 'later' && <MethodPicker value={method} onChange={setMethod} compact />}
            {payMode === 'partial' && (
              <Field label="Amount received now" htmlFor="partial-amt" error={partialRaw !== '' ? payErr : null} hint={!payErr && !Number.isNaN(partialMinor) ? `Balance after payment: ${formatMoney(totals.total - partialMinor)}` : undefined}>
                <MoneyInput id="partial-amt" value={partialRaw} onChange={(e) => setPartialRaw(e.target.value)} invalid={partialRaw !== '' && !!payErr} />
              </Field>
            )}
            <Field label="Notes (optional)" htmlFor="inv-notes">
              <Textarea id="inv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} className="min-h-[56px]" placeholder="Shown on the invoice" />
            </Field>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
          <Button size="lg" className="mt-4 w-full" onClick={submit} disabled={items.length === 0}>
            {submitLabel} · {formatMoney(totals.total)}
          </Button>
          <p className="mt-2 text-center text-[11px] text-ink-500">Simulated transaction — no real payment is processed.</p>
        </div>
      </Card>
    </div>
  );
}
