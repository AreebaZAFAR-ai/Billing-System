import { useMemo, useState } from 'react';
import { Download, Table2, BarChart3 } from 'lucide-react';
import { INDUSTRY_CONFIG } from '@/config/industries';
import {
  METHOD_LABEL,
  agingBuckets,
  dailySeries,
  departmentBreakdown,
  doctorBreakdown,
  monthlySeries,
  paymentMethods,
  staffPerformance,
  summarize,
  topItems,
} from '@/lib/analytics';
import { STATUS_LABEL, outstanding } from '@/lib/billing';
import { formatDate, formatMonth, formatShortDate, fromDateKey, toDateKey } from '@/lib/dates';
import { formatMoney, toMajorString } from '@/lib/money';
import type { InvoiceStatus } from '@/lib/types';
import { useStore } from '@/store/store';
import { useUI } from '@/store/ui';
import { downloadFile, formatPercent, toCSV } from '@/lib/utils';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Badge, Card, CardHeader, EmptyState, SampleTag, StatCard } from '@/components/ui/Card';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { Segmented } from '@/components/ui/Field';
import { Table, Td, Th } from '@/components/ui/Table';
import { BarList, CountBars, Donut, Legend, RevenueTrend, SERIES } from '@/components/charts/Charts';

const STATUS_COLOR: Record<InvoiceStatus, string> = { paid: '#0e9f6e', partial: '#d97706', unpaid: '#98a2ad', overdue: '#dc2626' };

export default function Reports() {
  const industry = useStore((s) => s.activeIndustry);
  const data = useStore((s) => s.data[industry]);
  const basis = useStore((s) => s.settings.global.commissionBasis);
  const cfg = INDUSTRY_CONFIG[industry];
  const { range, setRange } = useUI();
  const [dailyView, setDailyView] = useState<'chart' | 'table'>('chart');

  const s = useMemo(() => summarize(data.invoices, range, basis), [data.invoices, range, basis]);
  const daily = useMemo(() => dailySeries(data.invoices, range), [data.invoices, range]);
  const monthly = useMemo(() => monthlySeries(data.invoices, range), [data.invoices, range]);
  const methods = useMemo(() => paymentMethods(data.invoices, range), [data.invoices, range]);
  const products = useMemo(() => topItems(data.invoices, range, (k) => k === 'product', 10), [data.invoices, range]);
  const services = useMemo(() => topItems(data.invoices, range, (k) => k === 'service' || k === 'package', 10), [data.invoices, range]);
  const aging = useMemo(() => agingBuckets(data.invoices), [data.invoices]);
  const debtors = useMemo(
    () =>
      data.invoices
        .filter((i) => outstanding(i) > 0)
        .sort((a, b) => outstanding(b) - outstanding(a))
        .slice(0, 8),
    [data.invoices],
  );
  const lowStock = data.catalog.filter((c) => c.trackStock && (c.stock ?? 0) <= (c.reorderLevel ?? 0));
  const empty = s.invoiceCount === 0 && s.collected === 0;
  const statusSlices = (Object.keys(s.status) as InvoiceStatus[])
    .filter((k) => s.status[k] > 0)
    .map((k) => ({ label: STATUS_LABEL[k], value: s.status[k], color: STATUS_COLOR[k] }));

  const exportDaily = () =>
    downloadFile(
      `${industry}-sales-by-day-${range.from}-to-${range.to}.csv`,
      toCSV(['Date', 'Invoices', 'Billed', 'Collected'], daily.map((d) => [d.key, d.count, toMajorString(d.billed), toMajorString(d.collected)])),
    );
  const exportItems = () =>
    downloadFile(
      `${industry}-items-${range.from}-to-${range.to}.csv`,
      toCSV(['Item', 'Category', 'Type', 'Quantity', 'Invoices', 'Billed (gross)'], [
        ...products.map((p) => [p.name, p.category, 'Product', p.quantity, p.invoices, toMajorString(p.revenue)]),
        ...services.map((p) => [p.name, p.category, 'Service', p.quantity, p.invoices, toMajorString(p.revenue)]),
      ]),
    );

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: cfg.label, to: '/demo/overview' }, { label: 'Reports' }]}
        title={
          <span className="flex items-center gap-2">
            Reports <SampleTag />
          </span>
        }
        description={`${formatDate(range.from)} – ${formatDate(range.to)} · every figure is derived from the same invoice and payment records`}
        actions={
          <>
            <DateRangeFilter value={range} onChange={setRange} />
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportDaily}>
              Daily CSV
            </Button>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportItems}>
              Items CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Billed revenue" value={formatMoney(s.billed)} sub={`${s.invoiceCount} invoices · avg ${formatMoney(s.avgInvoice)}`} />
        <StatCard label="Collected payments" value={formatMoney(s.collected)} sub="by payment date" tone="success" />
        <StatCard label="Outstanding (period invoices)" value={formatMoney(s.outstanding)} sub={`${formatMoney(s.overdueAmount)} overdue`} tone={s.outstanding ? 'warning' : 'success'} />
        <StatCard
          label="Est. gross profit"
          value={formatMoney(s.estProfit)}
          sub={s.netSales ? `${formatPercent((s.estProfit / s.netSales) * 100, 0)} of net sales` : '—'}
          hint="Net sales − estimated cost − calculated commission; excludes rent, salaries and overheads"
        />
      </div>
      <Card className="mt-4">
        <dl className="grid grid-cols-2 gap-px bg-ink-100 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {[
            { l: 'Gross sales (subtotal)', v: formatMoney(s.netSales + s.discounts) },
            { l: 'Discounts', v: `− ${formatMoney(s.discounts)}` },
            { l: 'Net sales', v: formatMoney(s.netSales) },
            { l: 'Tax', v: formatMoney(s.tax) },
            { l: 'Est. cost of items', v: formatMoney(s.estCost) },
            { l: industry === 'salon' ? 'Commission (calculated)' : 'Commission', v: formatMoney(s.commission) },
          ].map((x) => (
            <div key={x.l} className="bg-white px-4 py-3">
              <dt className="text-xs text-ink-500">{x.l}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-ink-900">{x.v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {empty ? (
        <Card className="mt-4">
          <EmptyState title="No activity in this period" description="Choose a different date range to see reports." />
        </Card>
      ) : (
        <>
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Sales by day"
                description="Billed (invoice date) vs collected (payment date)"
                actions={
                  <>
                    <Legend items={[{ label: 'Billed', color: SERIES[0] }, { label: 'Collected', color: SERIES[1] }]} />
                    <Segmented
                      label="Daily view"
                      size="sm"
                      value={dailyView}
                      onChange={setDailyView}
                      options={[
                        { value: 'chart', label: <BarChart3 className="h-3.5 w-3.5" aria-label="Chart" /> },
                        { value: 'table', label: <Table2 className="h-3.5 w-3.5" aria-label="Table" /> },
                      ]}
                    />
                  </>
                }
              />
              {dailyView === 'chart' ? (
                <div className="space-y-4 p-4 sm:p-5">
                  <RevenueTrend data={daily} />
                  <div>
                    <p className="mb-1 text-xs font-medium text-ink-500">Invoices per day</p>
                    <CountBars data={daily} height={120} />
                  </div>
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Date</Th>
                        <Th align="right">Invoices</Th>
                        <Th align="right">Billed</Th>
                        <Th align="right">Collected</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...daily].reverse().map((d) => (
                        <tr key={d.key}>
                          <Td>{formatShortDate(fromDateKey(d.key))}</Td>
                          <Td align="right">{d.count}</Td>
                          <Td align="right">{formatMoney(d.billed)}</Td>
                          <Td align="right">{formatMoney(d.collected)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card>
            <Card>
              <CardHeader title="Invoice status" description="Invoices issued in period" />
              <div className="p-5">
                <Donut centerLabel="Invoices" centerValue={s.invoiceCount.toLocaleString()} slices={statusSlices} />
              </div>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Sales by month" description="Calendar months within the selected range" />
              <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1fr_260px]">
                <RevenueTrend data={monthly} monthly height={220} />
                <Table>
                  <thead>
                    <tr>
                      <Th>Month</Th>
                      <Th align="right">Billed</Th>
                      <Th align="right">Collected</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.map((m) => (
                      <tr key={m.key}>
                        <Td>{formatMonth(m.key)}</Td>
                        <Td align="right">{formatMoney(m.billed)}</Td>
                        <Td align="right">{formatMoney(m.collected)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
            <Card>
              <CardHeader title="Payment methods" description="Collected in period (simulated)" />
              <div className="p-5">
                {methods.length ? (
                  <Donut centerLabel="Collected" centerValue={formatMoney(s.collected)} slices={methods.map((m, i) => ({ label: METHOD_LABEL[m.method], value: m.amount, color: SERIES[i], display: `${formatMoney(m.amount)} · ${m.count}` }))} />
                ) : (
                  <EmptyState title="No payments in period" />
                )}
              </div>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {products.length > 0 && <ItemsTable title="Top-selling products" rows={products} />}
            {services.length > 0 && <ItemsTable title="Most-used services" rows={services} />}
          </div>
        </>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Outstanding balances" description="All open invoices by age (as of today)" />
          <div className="p-5">
            <BarList rows={aging.map((a) => ({ label: a.label, value: a.amount, sub: `${a.count} inv.` }))} color={SERIES[1]} />
          </div>
          {debtors.length > 0 && (
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>{cfg.customer}</Th>
                  <Th className="hidden sm:table-cell">Due</Th>
                  <Th align="right">Balance</Th>
                </tr>
              </thead>
              <tbody>
                {debtors.map((i) => (
                  <tr key={i.id}>
                    <Td className="font-mono text-[13px]">{i.number}</Td>
                    <Td className="max-w-[160px] truncate">{i.customerName}</Td>
                    <Td className="hidden sm:table-cell">{formatDate(i.dueDate)}</Td>
                    <Td align="right" className="font-medium text-amber-700">
                      {formatMoney(outstanding(i))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {industry === 'salon' ? (
          <SalonCommissions />
        ) : industry === 'hospital' ? (
          <Card>
            <CardHeader title="Department-wise billing" description="Gross line charges in period" />
            <Table>
              <thead>
                <tr>
                  <Th>Department</Th>
                  <Th align="right">Bills</Th>
                  <Th align="right">Gross charges</Th>
                </tr>
              </thead>
              <tbody>
                {departmentBreakdown(data.invoices, range, data.departments).map((d) => (
                  <tr key={d.id}>
                    <Td>
                      {d.name} <span className="text-xs text-ink-400">{d.code}</span>
                    </Td>
                    <Td align="right">{d.invoices}</Td>
                    <Td align="right" className="font-medium text-ink-900">
                      {formatMoney(d.gross)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ) : industry === 'clinic' ? (
          <Card>
            <CardHeader title="Billing by doctor" description="Invoices issued in period" />
            <Table>
              <thead>
                <tr>
                  <Th>Doctor</Th>
                  <Th align="right">Invoices</Th>
                  <Th align="right">Billed</Th>
                </tr>
              </thead>
              <tbody>
                {doctorBreakdown(data.invoices, range, data.staff).map((d) => (
                  <tr key={d.staff.id}>
                    <Td>
                      {d.staff.name}
                      <p className="text-xs text-ink-500">{d.staff.specialty}</p>
                    </Td>
                    <Td align="right">{d.invoices}</Td>
                    <Td align="right" className="font-medium text-ink-900">
                      {formatMoney(d.billed)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ) : null}

        {lowStock.length > 0 || data.catalog.some((c) => c.trackStock) ? (
          <Card>
            <CardHeader title="Inventory alerts" description="Current stock at or below reorder level" />
            {lowStock.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th align="right">Stock</Th>
                    <Th align="right">Reorder at</Th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((c) => (
                    <tr key={c.id}>
                      <Td>
                        {c.name}
                        <p className="font-mono text-[11px] text-ink-400">{c.sku}</p>
                      </Td>
                      <Td align="right">
                        <Badge tone={(c.stock ?? 0) === 0 ? 'danger' : 'warning'}>{c.stock}</Badge>
                      </Td>
                      <Td align="right">{c.reorderLevel}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="No inventory alerts" />
            )}
          </Card>
        ) : null}
      </div>
      <p className="mt-6 text-center text-xs text-ink-400">Report generated {formatDate(toDateKey(new Date()))} from fictional demo data.</p>
    </>
  );
}

function ItemsTable({ title, rows }: { title: string; rows: ReturnType<typeof topItems> }) {
  const total = rows.reduce((a, r) => a + r.revenue, 0);
  return (
    <Card>
      <CardHeader title={title} description="Gross line totals in period (before invoice-level discounts)" />
      <Table>
        <thead>
          <tr>
            <Th>Item</Th>
            <Th align="right">Qty</Th>
            <Th align="right">Billed</Th>
            <Th align="right" className="hidden sm:table-cell">
              Share
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <Td>
                <p className="text-ink-900">{r.name}</p>
                <p className="text-xs text-ink-500">{r.category}</p>
              </Td>
              <Td align="right">{r.quantity}</Td>
              <Td align="right" className="font-medium text-ink-900">
                {formatMoney(r.revenue)}
              </Td>
              <Td align="right" className="hidden sm:table-cell">
                {formatPercent((r.revenue / Math.max(1, total)) * 100, 0)}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function SalonCommissions() {
  const data = useStore((s) => s.data.salon);
  const basis = useStore((s) => s.settings.global.commissionBasis);
  const { range } = useUI();
  const perf = staffPerformance(data.invoices, range, data.staff, data.payouts, basis);
  return (
    <Card>
      <CardHeader title="Staff commissions" description="Calculated in period vs paid (all-time payouts)" />
      <Table>
        <thead>
          <tr>
            <Th>Staff</Th>
            <Th align="right">Revenue</Th>
            <Th align="right">Calculated</Th>
            <Th align="right">Payable</Th>
          </tr>
        </thead>
        <tbody>
          {perf.map((p) => (
            <tr key={p.staff.id}>
              <Td>
                {p.staff.name}
                <p className="text-xs text-ink-500">
                  {p.staff.role} · {p.staff.commissionRate}%
                </p>
              </Td>
              <Td align="right">{formatMoney(p.revenue)}</Td>
              <Td align="right" className="font-medium text-ink-900">
                {formatMoney(p.commission)}
              </Td>
              <Td align="right" className={p.payable ? 'text-amber-700' : 'text-ink-400'}>
                {formatMoney(p.payable)}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
