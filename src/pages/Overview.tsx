import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarClock,
  FileText,
  HandCoins,
  PackageOpen,
  Plus,
  ReceiptText,
  TrendingUp,
  Users,
  Wallet,
  BedDouble,
  type LucideIcon,
} from 'lucide-react';
import { INDUSTRY_CONFIG } from '@/config/industries';
import {
  METHOD_LABEL,
  departmentBreakdown,
  doctorBreakdown,
  paymentMethods,
  pctChange,
  summarize,
  topItems,
  dailySeries,
  monthlySeries,
} from '@/lib/analytics';
import { previousRange, rangeLengthDays, relativeTime, toDateKey, formatTimeOfDay } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Industry } from '@/lib/types';
import { useStore } from '@/store/store';
import { useUI } from '@/store/ui';
import { PageHeader } from '@/components/layout/AppShell';
import { ButtonLink } from '@/components/ui/Button';
import { Badge, Card, CardHeader, EmptyState, SampleTag, StatCard } from '@/components/ui/Card';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { BarList, Donut, Legend, RevenueTrend, SERIES } from '@/components/charts/Charts';
import { InvoiceMiniTable } from '@/components/invoice/InvoiceTable';
import { InvoiceDrawer } from '@/components/invoice/InvoiceDrawer';
import { formatPercent } from '@/lib/utils';

const QUICK: Record<Industry, { label: string; to: string; icon: LucideIcon }[]> = {
  grocery: [
    { label: 'New sale', to: '/demo/grocery', icon: Plus },
    { label: 'Receive stock', to: '/demo/products', icon: PackageOpen },
    { label: 'Sales history', to: '/demo/invoices', icon: ReceiptText },
    { label: 'Sales report', to: '/demo/reports', icon: TrendingUp },
  ],
  clinic: [
    { label: 'New patient invoice', to: '/demo/clinic?tab=bill', icon: Plus },
    { label: "Today's appointments", to: '/demo/clinic', icon: CalendarClock },
    { label: 'Register patient', to: '/demo/customers?new=1', icon: Users },
    { label: 'Outstanding balances', to: '/demo/invoices?status=open', icon: HandCoins },
  ],
  hospital: [
    { label: 'New OPD bill', to: '/demo/hospital?tab=opd', icon: Plus },
    { label: 'Inpatients', to: '/demo/hospital?tab=ipd', icon: BedDouble },
    { label: 'Daily collections', to: '/demo/hospital?tab=collections', icon: Banknote },
    { label: 'Outstanding bills', to: '/demo/invoices?status=open', icon: HandCoins },
  ],
  salon: [
    { label: 'Book appointment', to: '/demo/salon?book=1', icon: CalendarClock },
    { label: 'Walk-in checkout', to: '/demo/salon?tab=checkout', icon: Plus },
    { label: 'Staff commissions', to: '/demo/salon?tab=staff', icon: HandCoins },
    { label: 'Retail stock', to: '/demo/products', icon: PackageOpen },
  ],
};

export default function Overview() {
  const industry = useStore((s) => s.activeIndustry);
  const data = useStore((s) => s.data[industry]);
  const biz = useStore((s) => s.settings.businesses[industry]);
  const basis = useStore((s) => s.settings.global.commissionBasis);
  const { range, setRange } = useUI();
  const cfg = INDUSTRY_CONFIG[industry];
  const [openId, setOpenId] = useState<string | null>(null);

  const summary = useMemo(() => summarize(data.invoices, range, basis), [data.invoices, range, basis]);
  const prev = useMemo(() => summarize(data.invoices, previousRange(range), basis), [data.invoices, range, basis]);
  const long = rangeLengthDays(range) > 92;
  const series = useMemo(() => (long ? monthlySeries(data.invoices, range) : dailySeries(data.invoices, range)), [data.invoices, range, long]);
  const methods = useMemo(() => paymentMethods(data.invoices, range), [data.invoices, range]);
  const top = useMemo(
    () => topItems(data.invoices, range, industry === 'grocery' ? () => true : (k) => k !== 'product' && k !== 'room', 6),
    [data.invoices, range, industry],
  );
  const lowStock = data.catalog.filter((c) => c.trackStock && c.active && (c.stock ?? 0) <= (c.reorderLevel ?? 0));
  const recent = data.invoices.slice(0, 7);
  const today = toDateKey(new Date());
  const upcoming = data.appointments
    .filter((a) => a.date === today && (a.status === 'scheduled' || a.status === 'checked-in'))
    .sort((a, b) => a.time.localeCompare(b.time));

  const collectionRate = summary.billed ? (summary.collected / summary.billed) * 100 : 0;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Demo', to: '/demo' }, { label: cfg.label }, { label: 'Overview' }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {biz.name} <SampleTag />
          </span>
        }
        description={`Business overview · ${cfg.label} demo. All figures are calculated from the sample invoices below.`}
        actions={
          <>
            <DateRangeFilter value={range} onChange={setRange} />
            <ButtonLink to={cfg.modulePath} icon={<cfg.moduleIcon className="h-4 w-4" />}>
              Open {cfg.moduleLabel}
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <StatCard label="Billed revenue" value={formatMoney(summary.billed)} change={pctChange(summary.billed, prev.billed)} sub="vs previous period" icon={TrendingUp} hint="Sum of invoice totals issued in the period" />
        <StatCard label="Collected payments" value={formatMoney(summary.collected)} sub={`${formatPercent(collectionRate, 0)} of billed`} icon={Wallet} tone="success" hint="Payments received in the period (simulated)" />
        <StatCard
          label="Outstanding balance"
          value={formatMoney(summary.outstanding)}
          sub={summary.overdueAmount > 0 ? <span className="text-red-700">{formatMoney(summary.overdueAmount)} overdue</span> : 'Nothing overdue'}
          icon={HandCoins}
          tone={summary.outstanding > 0 ? 'warning' : 'success'}
          hint="Unpaid balance on invoices issued in the period"
        />
        <StatCard label="Invoices" value={summary.invoiceCount.toLocaleString()} sub={`Avg ${formatMoney(summary.avgInvoice)}`} change={pctChange(summary.invoiceCount, prev.invoiceCount)} icon={FileText} />
        <div className="col-span-2 xl:col-span-1">
          <StatCard
            label="Est. gross profit"
            value={formatMoney(summary.estProfit)}
            sub={summary.netSales ? `${formatPercent((summary.estProfit / summary.netSales) * 100, 0)} margin · excl. overheads` : 'excl. overheads'}
            icon={Banknote}
            hint="Net sales (after discount, before tax) minus estimated item cost and calculated commission"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Revenue trend"
            description="Billed revenue by invoice date vs payments collected by payment date"
            actions={
              <Legend
                items={[
                  { label: 'Billed', color: SERIES[0] },
                  { label: 'Collected', color: SERIES[1] },
                ]}
              />
            }
          />
          <div className="p-4 sm:p-5">{summary.invoiceCount === 0 && summary.collected === 0 ? <EmptyState title="No invoices in this period" description="Choose a wider date range." /> : <RevenueTrend data={series} monthly={long} />}</div>
        </Card>
        <Card>
          <CardHeader title="Payment methods" description="Collected payments in period" />
          <div className="p-5">
            {methods.length === 0 ? (
              <EmptyState title="No payments in this period" />
            ) : (
              <Donut
                centerLabel="Collected"
                centerValue={formatMoney(summary.collected)}
                slices={methods.map((m, i) => ({ label: METHOD_LABEL[m.method], value: m.amount, color: SERIES[i], display: formatMoney(m.amount) }))}
              />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={industry === 'grocery' ? 'Recent sales' : `Recent ${cfg.invoiceTerm.toLowerCase()}s`}
            actions={
              <Link to="/demo/invoices" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
                View all <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            }
          />
          {recent.length ? <InvoiceMiniTable invoices={recent} onOpen={(inv) => setOpenId(inv.id)} /> : <EmptyState title="No invoices yet" />}
        </Card>
        <Card>
          <CardHeader title="Quick actions" description={`Common ${cfg.short.toLowerCase()} tasks`} />
          <div className="grid grid-cols-2 gap-2 p-4">
            {QUICK[industry].map((q) => (
              <Link
                key={q.label}
                to={q.to}
                className="flex flex-col gap-2 rounded-lg border border-ink-200 p-3 text-sm font-medium text-ink-800 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
              >
                <q.icon className="h-4 w-4 text-brand-700" aria-hidden />
                {q.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-ink-100 px-5 py-4">
            <p className="text-sm font-semibold text-ink-900">Recent activity</p>
            <ul className="mt-3 space-y-3">
              {data.activities.slice(0, 5).map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink-700">{a.message}</p>
                    <p className="text-[11px] text-ink-400">{relativeTime(a.at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={industry === 'grocery' ? 'Top-selling products' : 'Most-used services'} description="By billed amount in period" />
          <div className="p-5">
            {top.length ? (
              <BarList rows={top.map((t) => ({ label: t.name, value: t.revenue, sub: `× ${t.quantity}` }))} />
            ) : (
              <EmptyState title="No sales in this period" />
            )}
          </div>
        </Card>

        {industry === 'clinic' ? (
          <Card>
            <CardHeader
              title="Today's appointments"
              actions={
                <Link to="/demo/clinic" className="text-sm font-medium text-brand-700 hover:text-brand-800">
                  Open desk
                </Link>
              }
            />
            {upcoming.length ? (
              <ul className="divide-y divide-ink-100">
                {upcoming.slice(0, 6).map((a) => {
                  const p = data.customers.find((c) => c.id === a.customerId);
                  const d = data.staff.find((s) => s.id === a.staffId);
                  return (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">{p?.name}</p>
                        <p className="truncate text-xs text-ink-500">{d?.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm tabular-nums text-ink-600">{formatTimeOfDay(a.time)}</span>
                        <Badge tone={a.status === 'checked-in' ? 'info' : 'neutral'}>{a.status === 'checked-in' ? 'Checked in' : 'Scheduled'}</Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={CalendarClock} title="No more appointments today" />
            )}
            <div className="border-t border-ink-100 p-5">
              <p className="mb-3 text-sm font-semibold text-ink-900">Billing by doctor (period)</p>
              <BarList rows={doctorBreakdown(data.invoices, range, data.staff).map((d) => ({ label: d.staff.name, value: d.billed, sub: `${d.invoices} inv.` }))} />
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader
              title="Low-stock alerts"
              description={industry === 'hospital' ? 'Pharmacy items at or below reorder level' : industry === 'salon' ? 'Retail products at or below reorder level' : 'Items at or below reorder level'}
              actions={
                <Link to="/demo/products" className="text-sm font-medium text-brand-700 hover:text-brand-800">
                  Manage stock
                </Link>
              }
            />
            {lowStock.length ? (
              <ul className="divide-y divide-ink-100">
                {lowStock.slice(0, 7).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <AlertTriangle className={(c.stock ?? 0) === 0 ? 'h-4 w-4 text-red-600' : 'h-4 w-4 text-amber-600'} aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">{c.name}</p>
                        <p className="text-xs text-ink-500">
                          {c.sku} · reorder at {c.reorderLevel}
                        </p>
                      </div>
                    </div>
                    <Badge tone={(c.stock ?? 0) === 0 ? 'danger' : 'warning'}>{(c.stock ?? 0) === 0 ? 'Out of stock' : `${c.stock} left`}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={PackageOpen} title="Stock levels are healthy" />
            )}
            {industry === 'hospital' && (
              <div className="border-t border-ink-100 p-5">
                <p className="mb-3 text-sm font-semibold text-ink-900">Department billing (period)</p>
                <BarList rows={departmentBreakdown(data.invoices, range, data.departments).slice(0, 5).map((d) => ({ label: d.name, value: d.gross }))} />
              </div>
            )}
          </Card>
        )}
      </div>

      <InvoiceDrawer industry={industry} invoiceId={openId} onClose={() => setOpenId(null)} receipt={industry === 'grocery'} />
    </>
  );
}
