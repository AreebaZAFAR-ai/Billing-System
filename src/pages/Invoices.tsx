import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, ReceiptText } from 'lucide-react';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { METHOD_LABEL } from '@/lib/analytics';
import { STATUS_LABEL, amountPaid, invoiceStatus, outstanding } from '@/lib/billing';
import { formatDate, formatTime, inRange, rangeFromPreset, toDateKey, type DateRange } from '@/lib/dates';
import { formatMoney, toMajorString } from '@/lib/money';
import type { InvoiceStatus } from '@/lib/types';
import { useStore } from '@/store/store';
import { downloadFile, toCSV } from '@/lib/utils';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, EmptyState } from '@/components/ui/Card';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { SearchInput, Select } from '@/components/ui/Field';
import { Pagination, SortTh, Table, Td, Th } from '@/components/ui/Table';
import { StatusBadge } from '@/components/invoice/StatusBadge';
import { InvoiceDrawer } from '@/components/invoice/InvoiceDrawer';

type StatusFilter = 'all' | 'open' | InvoiceStatus;
type SortKey = 'date' | 'number' | 'total' | 'balance' | 'customer';
const PAGE = 15;

export default function Invoices() {
  const industry = useStore((s) => s.activeIndustry);
  const data = useStore((s) => s.data[industry]);
  const cfg = INDUSTRY_CONFIG[industry];
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const status = (params.get('status') as StatusFilter) || 'all';
  const [range, setRange] = useState<DateRange>(rangeFromPreset('90d'));
  const [allTime, setAllTime] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [visit, setVisit] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const now = new Date();
    const rows = data.invoices.filter((i) => {
      if (!allTime && !inRange(i.createdAt, range)) return false;
      if (visit && i.meta?.visitType !== visit) return false;
      if (s && !i.number.toLowerCase().includes(s) && !i.customerName.toLowerCase().includes(s)) return false;
      if (status === 'all') return true;
      const st = invoiceStatus(i, now);
      return status === 'open' ? st !== 'paid' : st === status;
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      switch (sort.key) {
        case 'number':
          return a.number.localeCompare(b.number) * dir;
        case 'customer':
          return a.customerName.localeCompare(b.customerName) * dir;
        case 'total':
          return (a.total - b.total) * dir;
        case 'balance':
          return (outstanding(a) - outstanding(b)) * dir;
        default:
          return a.createdAt.localeCompare(b.createdAt) * dir;
      }
    });
  }, [data.invoices, q, status, range, allTime, sort, visit]);

  const totals = useMemo(
    () => filtered.reduce((a, i) => ({ billed: a.billed + i.total, paid: a.paid + amountPaid(i), due: a.due + outstanding(i) }), { billed: 0, paid: 0, due: 0 }),
    [filtered],
  );
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const onSort = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

  const exportCSV = () => {
    const csv = toCSV(
      ['Invoice number', 'Date', 'Customer', 'Items', 'Subtotal', 'Discount', 'Tax', 'Total', 'Paid', 'Balance', 'Status', 'Due date', 'Payment methods'],
      filtered.map((i) => [
        i.number,
        toDateKey(i.createdAt),
        i.customerName,
        i.items.length,
        toMajorString(i.subtotal),
        toMajorString(i.discountAmount),
        toMajorString(i.taxAmount),
        toMajorString(i.total),
        toMajorString(amountPaid(i)),
        toMajorString(outstanding(i)),
        STATUS_LABEL[invoiceStatus(i)],
        toDateKey(i.dueDate),
        [...new Set(i.payments.map((p) => METHOD_LABEL[p.method]))].join(' / '),
      ]),
    );
    downloadFile(`${industry}-invoices-${toDateKey(new Date())}.csv`, csv);
  };

  const title = industry === 'grocery' ? 'Sales history' : `${cfg.invoiceTerm}s`;
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: cfg.label, to: '/demo/overview' }, { label: title }]}
        title={title}
        description="Search, filter, reprint and collect payments on simulated invoices."
        actions={
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCSV} disabled={!filtered.length}>
            Export CSV
          </Button>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 lg:flex-row lg:items-center">
          <SearchInput
            wrapperClassName="lg:w-72"
            placeholder={`Invoice number or ${cfg.customer.toLowerCase()} name`}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="inv-status" className="sr-only">
              Status
            </label>
            <Select
              id="inv-status"
              className="w-[160px]"
              value={status}
              onChange={(e) => {
                setParams(e.target.value === 'all' ? {} : { status: e.target.value });
                setPage(1);
              }}
            >
              <option value="all">All statuses</option>
              <option value="open">Open (unpaid balance)</option>
              <option value="paid">Paid</option>
              <option value="partial">Partially paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </Select>
            {industry === 'hospital' && (
              <>
                <label htmlFor="inv-visit" className="sr-only">
                  Visit type
                </label>
                <Select id="inv-visit" className="w-[130px]" value={visit} onChange={(e) => setVisit(e.target.value)}>
                  <option value="">OPD & IPD</option>
                  <option value="OPD">OPD only</option>
                  <option value="IPD">IPD only</option>
                </Select>
              </>
            )}
            <label htmlFor="inv-period" className="sr-only">
              Period
            </label>
            <Select
              id="inv-period"
              className="w-[130px]"
              value={allTime ? 'all' : 'range'}
              onChange={(e) => {
                setAllTime(e.target.value === 'all');
                setPage(1);
              }}
            >
              <option value="all">All dates</option>
              <option value="range">Date range</option>
            </Select>
            {!allTime && (
              <DateRangeFilter
                value={range}
                onChange={(r) => {
                  setRange(r);
                  setPage(1);
                }}
              />
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border-b border-ink-100 bg-ink-100 text-sm sm:grid-cols-4">
          {[
            { l: 'Invoices', v: filtered.length.toLocaleString() },
            { l: 'Billed', v: formatMoney(totals.billed) },
            { l: 'Collected', v: formatMoney(totals.paid) },
            { l: 'Outstanding', v: formatMoney(totals.due) },
          ].map((s) => (
            <div key={s.l} className="bg-white px-4 py-3">
              <p className="text-xs text-ink-500">{s.l}</p>
              <p className="font-semibold tabular-nums text-ink-900">{s.v}</p>
            </div>
          ))}
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No invoices match your filters" description="Clear the search or widen the date range." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <SortTh label="Invoice" sortKey="number" sort={sort} onSort={onSort} />
                  <SortTh label={cfg.customer} sortKey="customer" sort={sort} onSort={onSort} />
                  <SortTh label="Date" sortKey="date" sort={sort} onSort={onSort} className="hidden sm:table-cell" />
                  <Th className="hidden lg:table-cell">Due</Th>
                  <SortTh label="Total" sortKey="total" sort={sort} onSort={onSort} align="right" />
                  <SortTh label="Balance" sortKey="balance" sort={sort} onSort={onSort} align="right" className="hidden md:table-cell" />
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((i) => (
                  <tr key={i.id} className="cursor-pointer hover:bg-ink-50/70" onClick={() => setOpenId(i.id)}>
                    <Td>
                      <button
                        type="button"
                        className="font-mono text-[13px] font-medium text-brand-700 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(i.id);
                        }}
                      >
                        {i.number}
                      </button>
                      {i.meta?.visitType && <span className="ml-2 text-[11px] text-ink-400">{i.meta.visitType}</span>}
                    </Td>
                    <Td className="max-w-[200px] truncate text-ink-900">{i.customerName}</Td>
                    <Td className="hidden whitespace-nowrap sm:table-cell">
                      {formatDate(i.createdAt)} <span className="text-ink-400">{formatTime(i.createdAt)}</span>
                    </Td>
                    <Td className="hidden whitespace-nowrap text-ink-500 lg:table-cell">{formatDate(i.dueDate)}</Td>
                    <Td align="right" className="font-medium text-ink-900">
                      {formatMoney(i.total)}
                    </Td>
                    <Td align="right" className="hidden md:table-cell">
                      {outstanding(i) > 0 ? <span className="text-amber-700">{formatMoney(outstanding(i))}</span> : <span className="text-ink-400">—</span>}
                    </Td>
                    <Td>
                      <StatusBadge invoice={i} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} />
          </>
        )}
      </Card>
      <InvoiceDrawer industry={industry} invoiceId={openId} onClose={() => setOpenId(null)} receipt={industry === 'grocery'} />
    </>
  );
}
