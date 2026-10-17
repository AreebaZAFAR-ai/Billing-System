import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Apple,
  Barcode,
  CheckCircle2,
  Coffee,
  Cookie,
  Croissant,
  Droplets,
  Keyboard,
  Milk,
  Minus,
  Plus,
  Printer,
  ShoppingBasket,
  Sparkles,
  SprayCan,
  Trash2,
  Wheat,
  X,
  type LucideIcon,
} from 'lucide-react';
import { computeTotals, lineTotal, outstanding } from '@/lib/billing';
import { formatDateTime, toDateKey } from '@/lib/dates';
import { formatMoney, toMajorString, toMinor } from '@/lib/money';
import type { CatalogItem, DiscountType, Invoice, LineItem, PaymentMethod } from '@/lib/types';
import { useStore } from '@/store/store';
import { cn, uid } from '@/lib/utils';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Badge, Card, EmptyState } from '@/components/ui/Card';
import { Field, MoneyInput, SearchInput } from '@/components/ui/Field';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Table';
import { toast } from '@/components/ui/Toast';
import { CustomerPicker } from '@/components/customers/CustomerPicker';
import { DiscountControl, TaxControl, TotalsPanel, parseDiscount, parseRate } from '@/components/invoice/TotalsPanel';
import { MethodPicker } from '@/components/invoice/PaymentModal';
import { ThermalReceipt } from '@/components/invoice/InvoiceDocument';
import { printInvoice } from '@/components/invoice/Print';
import { InvoiceMiniTable } from '@/components/invoice/InvoiceTable';
import { InvoiceDrawer } from '@/components/invoice/InvoiceDrawer';
import { catalogToLine } from '@/components/invoice/InvoiceComposer';

const CAT_ICON: Record<string, { icon: LucideIcon; tint: string }> = {
  Staples: { icon: Wheat, tint: 'bg-amber-50 text-amber-700' },
  'Oil & Ghee': { icon: Droplets, tint: 'bg-yellow-50 text-yellow-700' },
  'Dairy & Eggs': { icon: Milk, tint: 'bg-sky-50 text-sky-700' },
  Bakery: { icon: Croissant, tint: 'bg-orange-50 text-orange-700' },
  Beverages: { icon: Coffee, tint: 'bg-rose-50 text-rose-700' },
  Snacks: { icon: Cookie, tint: 'bg-violet-50 text-violet-700' },
  Household: { icon: SprayCan, tint: 'bg-teal-50 text-teal-700' },
  'Personal Care': { icon: Sparkles, tint: 'bg-pink-50 text-pink-700' },
};
const catIcon = (c: string) => CAT_ICON[c] ?? { icon: Apple, tint: 'bg-ink-100 text-ink-600' };

function quickCash(total: number): number[] {
  const out = new Set<number>([total]);
  for (const step of [50000, 100000, 500000]) {
    const v = Math.ceil(total / step) * step;
    if (v > total) out.add(v);
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

export default function GroceryPOS() {
  const data = useStore((s) => s.data.grocery);
  const biz = useStore((s) => s.settings.businesses.grocery);
  const createInvoice = useStore((s) => s.createInvoice);

  const [tab, setTab] = useState<'pos' | 'history'>('pos');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [cart, setCart] = useState<LineItem[]>([]);
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [discType, setDiscType] = useState<DiscountType>('percent');
  const [discRaw, setDiscRaw] = useState('');
  const [taxEnabled, setTaxEnabled] = useState(biz.taxEnabled);
  const [taxRaw, setTaxRaw] = useState(String(biz.taxRate));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [cashRaw, setCashRaw] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [completed, setCompleted] = useState<Invoice | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idem = useRef(uid('sale'));
  const searchRef = useRef<HTMLInputElement>(null);
  const cashRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => ['All', ...Array.from(new Set(data.catalog.map((c) => c.category)))], [data.catalog]);
  const products = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.catalog.filter(
      (c) =>
        c.active &&
        (cat === 'All' || c.category === cat) &&
        (!s || c.name.toLowerCase().includes(s) || c.sku?.toLowerCase().includes(s) || c.barcode?.includes(s)),
    );
  }, [data.catalog, q, cat]);

  const inCart = (id: string) => cart.find((l) => l.refId === id)?.quantity ?? 0;
  const stockOf = (id: string) => data.catalog.find((c) => c.id === id)?.stock ?? 0;

  const rate = parseRate(taxRaw);
  const subtotal = cart.reduce((a, l) => a + lineTotal(l), 0);
  const disc = parseDiscount(discType, discRaw, subtotal);
  const totals = computeTotals({ items: cart, discount: disc.discount, taxRate: rate.rate, taxEnabled });
  const cash = toMinor(cashRaw);
  const change = method === 'cash' && !Number.isNaN(cash) ? cash - totals.total : 0;
  const cashError =
    method === 'cash' && cashRaw !== '' && (Number.isNaN(cash) || cash < totals.total) ? 'Cash received is less than the total.' : null;

  const add = (c: CatalogItem, qty = 1) => {
    setError(null);
    const available = (c.stock ?? 0) - inCart(c.id);
    if (available < qty) {
      toast.error('Insufficient stock', available <= 0 ? `${c.name} is out of stock.` : `Only ${available} more ${c.unit ?? 'unit'}(s) of ${c.name} available.`);
      return;
    }
    setCart((prev) => {
      const ex = prev.find((l) => l.refId === c.id);
      if (ex) return prev.map((l) => (l === ex ? { ...l, quantity: l.quantity + qty } : l));
      return [...prev, catalogToLine(c, { quantity: qty })];
    });
  };

  const setQty = (lineId: string, raw: number) => {
    setCart((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        if (!Number.isFinite(raw) || raw < 1) return { ...l, quantity: 1 };
        const max = stockOf(l.refId!);
        if (raw > max) {
          toast.error('Insufficient stock', `Only ${max} of ${l.description} in stock.`);
          return { ...l, quantity: max };
        }
        return { ...l, quantity: Math.floor(raw) };
      }),
    );
  };

  const onSearchEnter = () => {
    const s = q.trim();
    if (!s) return;
    const exact = data.catalog.find((c) => c.barcode === s || c.sku?.toLowerCase() === s.toLowerCase());
    if (exact) {
      add(exact);
      setQ('');
      return;
    }
    if (products.length === 1) {
      add(products[0]);
      setQ('');
      return;
    }
    toast.info(products.length ? `${products.length} matches — pick one from the grid` : 'No product found', products.length ? undefined : `Nothing matches “${s}”.`);
  };

  const reset = () => {
    setCart([]);
    setCustomerId(undefined);
    setDiscRaw('');
    setCashRaw('');
    setReference('');
    setError(null);
    idem.current = uid('sale');
  };

  const complete = () => {
    if (busy) return;
    setError(null);
    if (cart.length === 0) return setError('The cart is empty.');
    if (disc.error) return setError(disc.error);
    if (taxEnabled && rate.error) return setError(rate.error);
    if (method === 'cash') {
      if (cashRaw === '') return setError('Enter the cash received.');
      if (cashError) return setError(cashError);
    }
    setBusy(true);
    const res = createInvoice('grocery', {
      customerId,
      items: cart,
      discount: disc.discount,
      taxRate: rate.rate,
      taxEnabled,
      payment: { amount: totals.total, method, tendered: method === 'cash' ? cash : undefined, reference },
      idempotencyKey: idem.current,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCompleted(res.value);
    reset();
    toast.success(`Sale ${res.value.number} completed`, 'Simulated payment recorded and stock updated.');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tab !== 'pos' || completed) return;
      const target = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (e.key === 'F2' || (e.key === '/' && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setMethod('cash');
        window.requestAnimationFrame(() => cashRef.current?.focus());
      } else if (e.key === 'F9' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        complete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const todays = data.invoices.filter((i) => toDateKey(i.createdAt) === toDateKey(new Date()));
  const todaysTotal = todays.reduce((a, i) => a + i.total, 0);
  const itemCount = cart.reduce((a, l) => a + l.quantity, 0);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Grocery & Retail', to: '/demo/overview' }, { label: 'Point of Sale' }]}
        title="Point of Sale"
        description={`${biz.name} · Today: ${todays.length} sales · ${formatMoney(todaysTotal)}`}
        actions={
          <div className="hidden items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-500 md:flex">
            <Keyboard className="h-3.5 w-3.5" aria-hidden />
            <kbd className="rounded bg-ink-100 px-1 font-sans">F2</kbd> search
            <kbd className="ml-1 rounded bg-ink-100 px-1 font-sans">F4</kbd> cash
            <kbd className="ml-1 rounded bg-ink-100 px-1 font-sans">F9</kbd> complete
          </div>
        }
      />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'pos', label: 'Checkout' },
          { value: 'history', label: 'Sales history', count: todays.length },
        ]}
      />

      {tab === 'history' ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-5 py-4">
            <div>
              <h2 className="text-[15px] font-semibold text-ink-900">Recent sales</h2>
              <p className="text-[13px] text-ink-500">Latest 25 transactions · open any receipt to reprint</p>
            </div>
          </div>
          <InvoiceMiniTable invoices={data.invoices.slice(0, 25)} onOpen={(i) => setOpenId(i.id)} />
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* Products */}
          <div className="min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <SearchInput
                  ref={searchRef}
                  label="Search products or scan barcode"
                  placeholder="Search name, SKU or scan barcode — Enter to add"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onSearchEnter();
                    } else if (e.key === 'Escape') setQ('');
                  }}
                  className="h-11 text-[15px]"
                  autoFocus
                />
                <Barcode className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-300" aria-hidden />
              </div>
            </div>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={cat === c}
                  onClick={() => setCat(c)}
                  className={cn(
                    'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    cat === c ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            {products.length === 0 ? (
              <Card className="mt-4">
                <EmptyState title="No products found" description="Check the spelling or barcode, or clear the category filter." />
              </Card>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
                {products.map((p) => {
                  const left = (p.stock ?? 0) - inCart(p.id);
                  const low = (p.stock ?? 0) <= (p.reorderLevel ?? 0);
                  const out = left <= 0;
                  const { icon: Icon, tint } = catIcon(p.category);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => add(p)}
                        disabled={out}
                        className="group flex h-full w-full flex-col rounded-xl border border-ink-200 bg-white p-3 text-left shadow-card transition-all hover:border-brand-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tint)}>
                            <Icon className="h-5 w-5" aria-hidden />
                          </span>
                          {inCart(p.id) > 0 && <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[11px] font-semibold text-white">{inCart(p.id)} in cart</span>}
                        </div>
                        <p className="mt-2.5 line-clamp-2 text-[13px] font-medium leading-snug text-ink-900">{p.name}</p>
                        <p className="mt-0.5 font-mono text-[10.5px] text-ink-400">{p.barcode}</p>
                        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                          <span className="text-[15px] font-semibold tabular-nums text-ink-900">{formatMoney(p.price)}</span>
                          <span className={cn('text-[11px] font-medium', out ? 'text-red-600' : low ? 'text-amber-700' : 'text-ink-500')}>
                            {out ? 'Out of stock' : `${left} left`}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Cart */}
          <Card className="flex flex-col xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:self-start">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <ShoppingBasket className="h-5 w-5 text-ink-500" aria-hidden />
                <h2 className="text-[15px] font-semibold text-ink-900">Current sale</h2>
                <Badge tone="neutral">{itemCount} items</Badge>
              </div>
              <Button variant="ghost" size="xs" onClick={() => setConfirmClear(true)} disabled={cart.length === 0} icon={<X className="h-3.5 w-3.5" />}>
                Clear
              </Button>
            </div>
            <div className="border-b border-ink-100 px-4 py-3">
              <CustomerPicker industry="grocery" value={customerId} onChange={setCustomerId} allowWalkIn />
              {!customerId && <p className="mt-1.5 text-xs text-ink-500">Walk-in customer · add a loyalty customer optionally</p>}
            </div>
            <div className="min-h-[120px] flex-1 overflow-y-auto px-4">
              {cart.length === 0 ? (
                <EmptyState icon={ShoppingBasket} title="Cart is empty" description="Tap a product or scan a barcode to start." className="py-8" />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {cart.map((l) => (
                    <li key={l.id} className="flex items-center gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink-900">{l.description}</p>
                        <p className="text-[11px] tabular-nums text-ink-500">{formatMoney(l.unitPrice)} each</p>
                      </div>
                      <div className="flex items-center rounded-lg border border-ink-200">
                        <IconButton label={`Decrease ${l.description}`} className="h-7 w-7" onClick={() => (l.quantity <= 1 ? setCart((c) => c.filter((x) => x.id !== l.id)) : setQty(l.id, l.quantity - 1))}>
                          <Minus className="h-3.5 w-3.5" />
                        </IconButton>
                        <input
                          aria-label={`Quantity of ${l.description}`}
                          className="h-7 w-9 border-0 bg-transparent text-center text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                          inputMode="numeric"
                          value={l.quantity}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, '');
                            if (v === '') return;
                            setQty(l.id, Number(v));
                          }}
                        />
                        <IconButton label={`Increase ${l.description}`} className="h-7 w-7" onClick={() => setQty(l.id, l.quantity + 1)}>
                          <Plus className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                      <span className="w-20 text-right text-[13px] font-semibold tabular-nums text-ink-900">{formatMoney(lineTotal(l))}</span>
                      <IconButton label={`Remove ${l.description}`} className="h-7 w-7 hover:text-red-600" onClick={() => setCart((c) => c.filter((x) => x.id !== l.id))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-3 border-t border-ink-100 bg-ink-50/60 px-4 py-3">
              <DiscountControl type={discType} value={discRaw} onType={setDiscType} onValue={setDiscRaw} error={disc.error} />
              <TaxControl enabled={taxEnabled} rate={taxRaw} label={biz.taxLabel} onEnabled={setTaxEnabled} onRate={setTaxRaw} />
              {taxEnabled && rate.error && <p className="text-xs text-red-600">{rate.error}</p>}
              <TotalsPanel totals={totals} taxLabel={biz.taxLabel} taxRate={taxEnabled ? rate.rate : 0} />
            </div>
            <div className="space-y-3 border-t border-ink-100 px-4 py-3">
              <MethodPicker value={method} onChange={setMethod} compact />
              {method === 'cash' ? (
                <div>
                  <Field label="Cash received" htmlFor="cash-received" error={cashError}>
                    <MoneyInput
                      ref={cashRef}
                      id="cash-received"
                      value={cashRaw}
                      onChange={(e) => setCashRaw(e.target.value)}
                      invalid={!!cashError}
                      onKeyDown={(e) => e.key === 'Enter' && complete()}
                      placeholder={toMajorString(totals.total)}
                    />
                  </Field>
                  {totals.total > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {quickCash(totals.total).map((v) => (
                        <button key={v} type="button" onClick={() => setCashRaw(toMajorString(v))} className="rounded-md border border-ink-200 bg-white px-2 py-1 text-xs tabular-nums text-ink-700 hover:bg-ink-50">
                          {v === totals.total ? 'Exact' : formatMoney(v)}
                        </button>
                      ))}
                    </div>
                  )}
                  {cashRaw !== '' && !cashError && (
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm">
                      <span className="font-medium text-emerald-800">Change due</span>
                      <span className="text-lg font-semibold tabular-nums text-emerald-800">{formatMoney(change)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <Field label="Reference (optional)" htmlFor="pos-ref" hint={method === 'card' ? 'e.g. last 4 digits from the card terminal slip' : 'Transaction ID'}>
                  <input id="pos-ref" className="block h-9 w-full rounded-lg border border-ink-200 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={30} />
                </Field>
              )}
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700" role="alert">
                  {error}
                </p>
              )}
              <Button size="lg" className="w-full" onClick={complete} loading={busy} disabled={cart.length === 0} icon={<CheckCircle2 className="h-5 w-5" />}>
                Complete sale · {formatMoney(totals.total)}
              </Button>
              <p className="text-center text-[11px] text-ink-500">Simulated payment — no real card or bank transaction.</p>
            </div>
          </Card>
        </div>
      )}

      {/* Mobile sticky total */}
      {tab === 'pos' && cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-ink-200 bg-white px-4 py-3 shadow-pop xl:hidden no-print">
          <div>
            <p className="text-xs text-ink-500">{itemCount} items</p>
            <p className="text-lg font-semibold tabular-nums">{formatMoney(totals.total)}</p>
          </div>
          <Button
            onClick={() => document.getElementById(method === 'cash' ? 'cash-received' : 'pos-ref')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          >
            Go to payment
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Clear the current sale?"
        description="All items in the cart will be removed. Nothing has been charged."
        confirmLabel="Clear cart"
        onConfirm={reset}
      />

      <Modal
        open={!!completed}
        onClose={() => {
          setCompleted(null);
          window.requestAnimationFrame(() => searchRef.current?.focus());
        }}
        title={
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden /> Sale completed
          </span>
        }
        description={completed ? `${completed.number} · ${formatDateTime(completed.createdAt)} · simulated` : undefined}
        footer={
          completed && (
            <>
              <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => printInvoice('grocery', completed.id, 'thermal')}>
                Print receipt
              </Button>
              <Button
                data-autofocus
                onClick={() => {
                  setCompleted(null);
                  window.requestAnimationFrame(() => searchRef.current?.focus());
                }}
              >
                New sale
              </Button>
            </>
          )
        }
      >
        {completed && (
          <div className="rounded-lg bg-ink-100/70 p-4">
            {completed.payments[0]?.change ? (
              <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-800">
                Give change: <span className="tabular-nums">{formatMoney(completed.payments[0].change)}</span>
              </p>
            ) : null}
            <div className="rounded bg-white shadow-card">
              <ThermalReceipt invoice={completed} business={biz} data={data} />
            </div>
            {outstanding(completed) > 0 && <p className="mt-2 text-xs text-amber-700">Balance remains on this receipt.</p>}
          </div>
        )}
      </Modal>
      <InvoiceDrawer industry="grocery" invoiceId={openId} onClose={() => setOpenId(null)} receipt />
    </>
  );
}
