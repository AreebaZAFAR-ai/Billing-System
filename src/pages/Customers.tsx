import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, UserPlus, Users } from 'lucide-react';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { customerBalance } from '@/lib/analytics';
import { formatDate, toDateKey } from '@/lib/dates';
import { formatMoney, toMajorString } from '@/lib/money';
import { useStore } from '@/store/store';
import { downloadFile, toCSV } from '@/lib/utils';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Avatar, Card, EmptyState, SampleTag } from '@/components/ui/Card';
import { SearchInput, Select } from '@/components/ui/Field';
import { Pagination, SortTh, Table, Td, Th } from '@/components/ui/Table';
import { CustomerFormModal } from '@/components/customers/CustomerForm';
import { CustomerDrawer } from '@/components/customers/CustomerDrawer';
import { matchCustomer } from '@/components/customers/CustomerPicker';

type SortKey = 'name' | 'visits' | 'billed' | 'outstanding' | 'last';
const PAGE = 15;

export default function Customers() {
  const industry = useStore((s) => s.activeIndustry);
  const data = useStore((s) => s.data[industry]);
  const cfg = INDUSTRY_CONFIG[industry];
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'balance' | 'new'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'last', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const registering = params.get('new') === '1';

  const rows = useMemo(() => {
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const list = data.customers
      .filter((c) => matchCustomer(c, q))
      .map((c) => ({ c, b: customerBalance(data.invoices, c.id) }))
      .filter(({ c, b }) => (filter === 'balance' ? b.outstanding > 0 : filter === 'new' ? c.createdAt >= monthAgo : true));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return list.sort((x, y) => {
      switch (sort.key) {
        case 'name':
          return x.c.name.localeCompare(y.c.name) * dir;
        case 'visits':
          return (x.b.invoices.length - y.b.invoices.length) * dir;
        case 'billed':
          return (x.b.billed - y.b.billed) * dir;
        case 'outstanding':
          return (x.b.outstanding - y.b.outstanding) * dir;
        default:
          return (x.b.lastVisit ?? x.c.createdAt).localeCompare(y.b.lastVisit ?? y.c.createdAt) * dir;
      }
    });
  }, [data.customers, data.invoices, q, filter, sort]);

  const onSort = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);

  const exportCSV = () =>
    downloadFile(
      `${industry}-${cfg.customers.toLowerCase()}-${toDateKey(new Date())}.csv`,
      toCSV(
        ['ID', 'Name', 'Phone', 'Email', 'City', 'Visits', 'Billed', 'Paid', 'Outstanding', 'Last visit'],
        rows.map(({ c, b }) => [
          c.code,
          c.name,
          c.phone,
          c.email ?? '',
          c.city ?? '',
          b.invoices.length,
          toMajorString(b.billed),
          toMajorString(b.paid),
          toMajorString(b.outstanding),
          b.lastVisit ? toDateKey(b.lastVisit) : '',
        ]),
      ),
    );

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: cfg.label, to: '/demo/overview' }, { label: cfg.customers }]}
        title={
          <span className="flex items-center gap-2">
            {cfg.customers} <SampleTag />
          </span>
        }
        description={`Fictional ${cfg.customers.toLowerCase()} with billing history and balances. Never enter real personal or medical information in this demo.`}
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCSV} disabled={!rows.length}>
              Export CSV
            </Button>
            <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setParams({ new: '1' })}>
              Register {cfg.customer.toLowerCase()}
            </Button>
          </>
        }
      />
      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center">
          <SearchInput
            wrapperClassName="sm:w-80"
            placeholder="Search name, ID or phone"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <label htmlFor="cust-filter" className="sr-only">
            Filter
          </label>
          <Select
            id="cust-filter"
            className="sm:w-56"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter);
              setPage(1);
            }}
          >
            <option value="all">All {cfg.customers.toLowerCase()}</option>
            <option value="balance">With outstanding balance</option>
            <option value="new">Registered in last 30 days</option>
          </Select>
          <p className="text-sm text-ink-500 sm:ml-auto">{rows.length.toLocaleString()} records</p>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title={`No ${cfg.customers.toLowerCase()} found`} description="Try a different search or filter." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <SortTh label={cfg.customer} sortKey="name" sort={sort} onSort={onSort} />
                  <Th className="hidden md:table-cell">Contact</Th>
                  <SortTh label="Visits" sortKey="visits" sort={sort} onSort={onSort} align="right" />
                  <SortTh label="Billed" sortKey="billed" sort={sort} onSort={onSort} align="right" className="hidden sm:table-cell" />
                  <SortTh label="Balance" sortKey="outstanding" sort={sort} onSort={onSort} align="right" />
                  <SortTh label="Last visit" sortKey="last" sort={sort} onSort={onSort} className="hidden lg:table-cell" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ c, b }) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-ink-50/70" onClick={() => setOpenId(c.id)}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.name} />
                        <div className="min-w-0">
                          <button
                            type="button"
                            className="block truncate text-left font-medium text-ink-900 hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenId(c.id);
                            }}
                          >
                            {c.name}
                          </button>
                          <p className="text-xs text-ink-500">
                            {c.code}
                            {c.age ? ` · ${c.age}y` : ''}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="hidden md:table-cell">
                      <p className="text-ink-800">{c.phone}</p>
                      <p className="text-xs text-ink-500">{c.city}</p>
                    </Td>
                    <Td align="right">{b.invoices.length}</Td>
                    <Td align="right" className="hidden text-ink-900 sm:table-cell">
                      {formatMoney(b.billed)}
                    </Td>
                    <Td align="right">
                      {b.outstanding > 0 ? <span className="font-medium text-amber-700">{formatMoney(b.outstanding)}</span> : <span className="text-ink-400">—</span>}
                    </Td>
                    <Td className="hidden whitespace-nowrap lg:table-cell">{b.lastVisit ? formatDate(b.lastVisit) : <span className="text-ink-400">No visits</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
          </>
        )}
      </Card>
      <CustomerFormModal industry={industry} open={registering} onClose={() => setParams({})} onSaved={(c) => setOpenId(c.id)} />
      <CustomerDrawer industry={industry} customerId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
