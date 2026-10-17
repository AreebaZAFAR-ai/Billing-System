import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Wallet } from 'lucide-react';
import type { Industry, Invoice } from '@/lib/types';
import { useStore } from '@/store/store';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { customerBalance } from '@/lib/analytics';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { outstanding } from '@/lib/billing';
import { Button } from '@/components/ui/Button';
import { Avatar, EmptyState } from '@/components/ui/Card';
import { Drawer } from '@/components/ui/Modal';
import { InvoiceMiniTable } from '@/components/invoice/InvoiceTable';
import { InvoiceDrawer } from '@/components/invoice/InvoiceDrawer';
import { PaymentModal } from '@/components/invoice/PaymentModal';
import { CustomerFormModal } from './CustomerForm';

export function CustomerDrawer({ industry, customerId, onClose }: { industry: Industry; customerId: string | null; onClose: () => void }) {
  const cfg = INDUSTRY_CONFIG[industry];
  const data = useStore((s) => s.data[industry]);
  const customer = customerId ? data.customers.find((c) => c.id === customerId) : undefined;
  const bal = useMemo(() => (customer ? customerBalance(data.invoices, customer.id) : null), [customer, data.invoices]);
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [editing, setEditing] = useState(false);
  if (!customer || !bal) return null;
  const openOnes = bal.invoices.filter((i) => outstanding(i) > 0);
  const upcoming = data.appointments.filter((a) => a.customerId === customer.id && (a.status === 'scheduled' || a.status === 'checked-in'));

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width="max-w-2xl"
        title={customer.name}
        description={`${cfg.customer} ID ${customer.code} · registered ${formatDate(customer.createdAt)}`}
        footer={
          <>
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
              Edit details
            </Button>
            {industry !== 'grocery' && (
              <Link
                to={`${cfg.modulePath}?tab=${industry === 'hospital' ? 'opd' : industry === 'salon' ? 'checkout' : 'bill'}&customer=${customer.id}`}
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"
              >
                New {cfg.invoiceTerm.toLowerCase()}
              </Link>
            )}
          </>
        }
      >
        <div className="space-y-5 p-5">
          <div className="flex items-center gap-4">
            <Avatar name={customer.name} className="h-12 w-12 text-sm" />
            <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-3">
              <div>
                <dt className="text-ink-500">Phone</dt>
                <dd className="text-ink-900">{customer.phone}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Email</dt>
                <dd className="truncate text-ink-900">{customer.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-500">{customer.age ? 'Age / gender' : 'Gender'}</dt>
                <dd className="text-ink-900">{[customer.age && `${customer.age}y`, customer.gender].filter(Boolean).join(' · ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-500">City</dt>
                <dd className="text-ink-900">{customer.city ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Last visit</dt>
                <dd className="text-ink-900">{bal.lastVisit ? formatDate(bal.lastVisit) : '—'}</dd>
              </div>
            </dl>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { l: 'Visits', v: String(bal.invoices.length) },
              { l: 'Total billed', v: formatMoney(bal.billed) },
              { l: 'Paid', v: formatMoney(bal.paid) },
              { l: 'Outstanding', v: formatMoney(bal.outstanding), warn: bal.outstanding > 0 },
            ].map((s) => (
              <div key={s.l} className={s.warn ? 'rounded-lg bg-amber-50 p-3' : 'rounded-lg bg-ink-50 p-3'}>
                <p className="text-xs text-ink-500">{s.l}</p>
                <p className={s.warn ? 'mt-0.5 font-semibold tabular-nums text-amber-800' : 'mt-0.5 font-semibold tabular-nums text-ink-900'}>{s.v}</p>
              </div>
            ))}
          </div>

          {openOnes.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50">
              <p className="border-b border-amber-200 px-4 py-2.5 text-sm font-semibold text-amber-900">Open balances</p>
              <ul className="divide-y divide-amber-100">
                {openOnes.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div>
                      <button type="button" onClick={() => setOpenInvoice(i.id)} className="font-mono text-[13px] font-medium text-brand-700 hover:underline">
                        {i.number}
                      </button>
                      <p className="text-xs text-ink-500">
                        {formatDate(i.createdAt)} · due {formatDate(i.dueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-amber-800">{formatMoney(outstanding(i))}</span>
                      <Button size="xs" icon={<Wallet className="h-3.5 w-3.5" />} onClick={() => setPaying(i)}>
                        Pay
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-900">Upcoming appointments</p>
              <ul className="space-y-1 text-[13px] text-ink-700">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    {formatDate(a.date)} at {a.time} · {data.staff.find((s) => s.id === a.staffId)?.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-ink-900">{industry === 'salon' ? 'Visit history' : 'Billing history'}</p>
            <div className="overflow-hidden rounded-lg border border-ink-200">
              {bal.invoices.length ? (
                <InvoiceMiniTable invoices={bal.invoices} onOpen={(i) => setOpenInvoice(i.id)} showCustomer={false} />
              ) : (
                <EmptyState title="No invoices yet" />
              )}
            </div>
          </div>
        </div>
      </Drawer>
      <InvoiceDrawer industry={industry} invoiceId={openInvoice} onClose={() => setOpenInvoice(null)} />
      {paying && <PaymentModal invoice={data.invoices.find((i) => i.id === paying.id) ?? paying} open onClose={() => setPaying(null)} />}
      <CustomerFormModal industry={industry} open={editing} onClose={() => setEditing(false)} existing={customer} />
    </>
  );
}
