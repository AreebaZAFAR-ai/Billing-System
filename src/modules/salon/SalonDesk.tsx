import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarPlus, Clock, HandCoins, Receipt, Scissors, ShoppingBag, Sparkles, Users, Wallet } from 'lucide-react';
import { staffPerformance, summarize } from '@/lib/analytics';
import { lineTotal } from '@/lib/billing';
import { addDays, formatDate, formatTimeOfDay, fromDateKey, toDateKey } from '@/lib/dates';
import { formatMoney, toMinor } from '@/lib/money';
import type { Appointment, AppointmentStatus, Invoice, LineItem } from '@/lib/types';
import { useStore } from '@/store/store';
import { useUI } from '@/store/ui';
import { cn, uid } from '@/lib/utils';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Avatar, Badge, Card, CardHeader, EmptyState, StatCard } from '@/components/ui/Card';
import { DateRangeFilter } from '@/components/ui/DateRangeFilter';
import { Field, Input, MoneyInput, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Table, Tabs, Td, Th } from '@/components/ui/Table';
import { toast } from '@/components/ui/Toast';
import { InvoiceComposer, catalogToLine } from '@/components/invoice/InvoiceComposer';
import { InvoiceDrawer } from '@/components/invoice/InvoiceDrawer';
import { AppointmentModal } from '@/components/appointments/AppointmentModal';
import { BarList } from '@/components/charts/Charts';

type Tab = 'appointments' | 'checkout' | 'staff';

const STATUS: Record<AppointmentStatus, { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' | 'warning' }> = {
  scheduled: { label: 'Booked', tone: 'neutral' },
  'checked-in': { label: 'In chair', tone: 'info' },
  completed: { label: 'Paid', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  'no-show': { label: 'No-show', tone: 'warning' },
};

export default function SalonDesk() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'appointments';
  const setTab = (t: Tab) => setParams(t === 'appointments' ? {} : { tab: t });
  const biz = useStore((s) => s.settings.businesses.salon);
  const [booking, setBooking] = useState(params.get('book') === '1');
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [date, setDate] = useState(toDateKey(new Date()));
  const [checkout, setCheckout] = useState<{ key: string; appointment?: Appointment; customerId?: string }>(() => ({
    key: uid('s'),
    customerId: params.get('customer') ?? undefined,
  }));

  const startCheckout = (appointment?: Appointment) => {
    setCheckout({ key: uid('s'), appointment, customerId: appointment?.customerId });
    setTab('checkout');
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Beauty Salon', to: '/demo/overview' }, { label: 'Salon Desk' }]}
        title="Salon Desk"
        description={`${biz.name} · bookings, checkout and staff commissions`}
        actions={
          <>
            <Button variant="secondary" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setBooking(true)}>
              Book appointment
            </Button>
            <Button icon={<Scissors className="h-4 w-4" />} onClick={() => startCheckout()}>
              Walk-in checkout
            </Button>
          </>
        }
      />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'appointments', label: 'Appointment book' },
          { value: 'checkout', label: 'Checkout' },
          { value: 'staff', label: 'Staff & commissions' },
        ]}
      />

      {tab === 'appointments' && <AppointmentBook date={date} setDate={setDate} onCheckout={startCheckout} onBook={() => setBooking(true)} onInvoice={setOpenInvoice} />}
      {tab === 'checkout' && (
        <SalonCheckout
          key={checkout.key}
          appointment={checkout.appointment}
          customerId={checkout.customerId}
          onCreated={(inv) => {
            setCheckout({ key: uid('s') });
            setTab('appointments');
            setOpenInvoice(inv.id);
          }}
        />
      )}
      {tab === 'staff' && <StaffCommissions />}

      <AppointmentModal
        industry="salon"
        open={booking}
        withServices
        defaultDate={date >= toDateKey(new Date()) ? date : undefined}
        onClose={() => {
          setBooking(false);
          if (params.get('book')) setParams({});
        }}
        onBooked={(a) => {
          setDate(a.date);
          if (tab !== 'appointments') setTab('appointments');
        }}
      />
      <InvoiceDrawer industry="salon" invoiceId={openInvoice} onClose={() => setOpenInvoice(null)} />
    </>
  );
}

function AppointmentBook({
  date,
  setDate,
  onCheckout,
  onBook,
  onInvoice,
}: {
  date: string;
  setDate: (d: string) => void;
  onCheckout: (a: Appointment) => void;
  onBook: () => void;
  onInvoice: (id: string) => void;
}) {
  const data = useStore((s) => s.data.salon);
  const setStatus = useStore((s) => s.setAppointmentStatus);
  const basis = useStore((s) => s.settings.global.commissionBasis);
  const stylists = data.staff.filter((s) => s.commissionRate !== undefined && s.active);
  const appts = data.appointments.filter((a) => a.date === date);
  const range = { from: date, to: date };
  const day = summarize(data.invoices, range, basis);
  const perf = staffPerformance(data.invoices, range, data.staff, data.payouts, basis).filter((p) => p.revenue > 0);
  const productSales = data.invoices
    .filter((i) => toDateKey(i.createdAt) === date)
    .flatMap((i) => i.items)
    .filter((l) => l.kind === 'product')
    .reduce((a, l) => a + lineTotal(l), 0);
  const svcName = (id: string) => data.catalog.find((c) => c.id === id)?.name ?? 'Service';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatMoney(day.billed)} sub={formatDate(date)} icon={Receipt} />
        <StatCard label="Collected" value={formatMoney(day.collected)} icon={Wallet} tone="success" />
        <StatCard label="Retail product sales" value={formatMoney(productSales)} icon={ShoppingBag} />
        <StatCard label="Appointments" value={appts.filter((a) => a.status !== 'cancelled').length} sub={`${appts.filter((a) => a.status === 'scheduled' || a.status === 'checked-in').length} still to serve`} icon={Users} />
      </div>
      <Card>
        <CardHeader
          title="Appointment book"
          description="Each column is a staff member. Check clients in, then check out to bill."
          actions={
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" aria-label="Previous day" onClick={() => setDate(toDateKey(addDays(fromDateKey(date), -1)))}>
                ‹
              </Button>
              <label htmlFor="salon-date" className="sr-only">
                Date
              </label>
              <Input id="salon-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-8 w-[150px]" />
              <Button size="sm" variant="ghost" aria-label="Next day" onClick={() => setDate(toDateKey(addDays(fromDateKey(date), 1)))}>
                ›
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDate(toDateKey(new Date()))}>
                Today
              </Button>
            </div>
          }
        />
        {appts.length === 0 ? (
          <EmptyState icon={Clock} title="No bookings on this day" action={<Button size="sm" onClick={onBook}>Book appointment</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[880px] gap-3 p-4" style={{ gridTemplateColumns: `repeat(${stylists.length}, minmax(0, 1fr))` }}>
              {stylists.map((st) => {
                const list = appts.filter((a) => a.staffId === st.id).sort((a, b) => a.time.localeCompare(b.time));
                return (
                  <div key={st.id} className="min-w-0">
                    <div className="mb-2 flex items-center gap-2 border-b border-ink-100 pb-2">
                      <Avatar name={st.name} className="h-7 w-7 text-[10px]" />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-ink-900">{st.name}</p>
                        <p className="truncate text-[11px] text-ink-500">{st.role}</p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {list.length === 0 && <li className="rounded-lg border border-dashed border-ink-200 px-2 py-3 text-center text-xs text-ink-400">Free</li>}
                      {list.map((a) => {
                        const c = data.customers.find((x) => x.id === a.customerId);
                        const s = STATUS[a.status];
                        const open = a.status === 'scheduled' || a.status === 'checked-in';
                        return (
                          <li
                            key={a.id}
                            className={cn(
                              'rounded-lg border p-2.5 text-xs',
                              a.status === 'checked-in' ? 'border-sky-200 bg-sky-50/60' : a.status === 'completed' ? 'border-ink-200 bg-ink-50/60' : 'border-ink-200 bg-white',
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold tabular-nums text-ink-900">{formatTimeOfDay(a.time)}</span>
                              <Badge tone={s.tone} className="px-1.5 text-[10px]">
                                {s.label}
                              </Badge>
                            </div>
                            <p className="mt-1 truncate font-medium text-ink-800">{c?.name}</p>
                            <p className="truncate text-ink-500" title={a.serviceIds.map(svcName).join(', ')}>
                              {a.serviceIds.map(svcName).join(', ')}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {a.status === 'scheduled' && (
                                <Button size="xs" variant="secondary" className="h-6 px-2 text-[11px]" onClick={() => setStatus('salon', a.id, 'checked-in')}>
                                  Check in
                                </Button>
                              )}
                              {open && (
                                <Button size="xs" className="h-6 px-2 text-[11px]" onClick={() => onCheckout(a)}>
                                  Check out
                                </Button>
                              )}
                              {a.status === 'scheduled' && (
                                <Button size="xs" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setStatus('salon', a.id, 'cancelled')}>
                                  Cancel
                                </Button>
                              )}
                              {a.invoiceId && (
                                <Button size="xs" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => onInvoice(a.invoiceId!)}>
                                  Invoice
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="Staff performance today" description="Service revenue and calculated commission for the selected day" />
        <div className="p-5">
          {perf.length ? (
            <BarList rows={perf.map((p) => ({ label: p.staff.name, value: p.revenue, sub: `${p.services} services · comm. ${formatMoney(p.commission)}` }))} />
          ) : (
            <EmptyState title="No services billed on this day yet" />
          )}
        </div>
      </Card>
    </div>
  );
}

function SalonCheckout({ appointment, customerId, onCreated }: { appointment?: Appointment; customerId?: string; onCreated: (i: Invoice) => void }) {
  const data = useStore((s) => s.data.salon);
  const stylists = data.staff.filter((s) => s.commissionRate !== undefined && s.active);
  const rateOf = (id: string) => data.staff.find((s) => s.id === id)?.commissionRate;
  const initialItems = useMemo<LineItem[]>(() => {
    if (!appointment) return [];
    return appointment.serviceIds
      .map((id) => data.catalog.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => catalogToLine(c, { staffId: appointment.staffId, commissionRate: rateOf(appointment.staffId) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const packages = data.catalog.filter((c) => c.kind === 'package' && c.active);
  return (
    <>
      {appointment && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-900">
          <Sparkles className="h-4 w-4" aria-hidden />
          Checking out appointment at {formatTimeOfDay(appointment.time)} with {data.staff.find((s) => s.id === appointment.staffId)?.name}. Services are pre-filled.
        </div>
      )}
      <InvoiceComposer
        industry="salon"
        catalog={data.catalog}
        initialCustomerId={customerId}
        initialItems={initialItems}
        lockCustomer={!!appointment}
        lineStaff={{ options: stylists.map((s) => ({ id: s.id, name: `${s.name} (${s.commissionRate}%)` })), defaultId: appointment?.staffId ?? stylists[0]?.id, rateOf }}
        quickAdd={(add) =>
          packages.length ? (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">Packages</p>
              <div className="flex flex-wrap gap-2">
                {packages.map((p) => (
                  <button key={p.id} type="button" onClick={() => add(p)} className="rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-1.5 text-left text-xs hover:bg-rose-50">
                    <span className="block font-medium text-rose-900">{p.name}</span>
                    <span className="text-rose-700">{formatMoney(p.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null
        }
        resolveMeta={() => ({ meta: { appointmentId: appointment?.id, staffId: appointment?.staffId } })}
        onCreated={onCreated}
        submitLabel="Check out"
      />
    </>
  );
}

function StaffCommissions() {
  const data = useStore((s) => s.data.salon);
  const basis = useStore((s) => s.settings.global.commissionBasis);
  const { range, setRange } = useUI();
  const [payFor, setPayFor] = useState<string | null>(null);
  const perf = useMemo(() => staffPerformance(data.invoices, range, data.staff, data.payouts, basis), [data.invoices, range, data.staff, data.payouts, basis]);
  const totals = perf.reduce(
    (a, p) => ({ revenue: a.revenue + p.revenue, commission: a.commission + p.commission, payable: a.payable + p.payable, paid: a.paid + p.paid }),
    { revenue: 0, commission: 0, payable: 0, paid: 0 },
  );
  const payTarget = perf.find((p) => p.staff.id === payFor);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeFilter value={range} onChange={setRange} />
        <p className="text-xs text-ink-500">
          Commission basis: <strong className="text-ink-700">{basis === 'gross' ? 'service price before discount' : 'service price after invoice discount'}</strong> · change in Settings
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Service revenue (period)" value={formatMoney(totals.revenue)} icon={Receipt} />
        <StatCard label="Commission calculated (period)" value={formatMoney(totals.commission)} icon={HandCoins} hint="Calculated from invoiced services — not yet a payment" />
        <StatCard label="Commission paid (all time)" value={formatMoney(totals.paid)} icon={Wallet} tone="success" hint="Recorded payouts (simulated)" />
        <StatCard label="Payable balance" value={formatMoney(totals.payable)} icon={Users} tone={totals.payable ? 'warning' : 'success'} hint="All-time calculated minus all-time paid" />
      </div>
      <Card>
        <CardHeader title="Staff performance & commissions" description="Calculated commission is an obligation; it becomes “paid” only when a payout is recorded." />
        <Table>
          <thead>
            <tr>
              <Th>Staff</Th>
              <Th align="right">Rate</Th>
              <Th align="right">Services</Th>
              <Th align="right">Revenue</Th>
              <Th align="right">Calculated (period)</Th>
              <Th align="right" className="hidden lg:table-cell">
                Calculated (all time)
              </Th>
              <Th align="right" className="hidden md:table-cell">
                Paid (all time)
              </Th>
              <Th align="right">Payable</Th>
              <Th align="right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {perf.map((p) => (
              <tr key={p.staff.id}>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={p.staff.name} />
                    <div>
                      <p className="font-medium text-ink-900">{p.staff.name}</p>
                      <p className="text-xs text-ink-500">{p.staff.role}</p>
                    </div>
                  </div>
                </Td>
                <Td align="right">{p.staff.commissionRate}%</Td>
                <Td align="right">{p.services}</Td>
                <Td align="right" className="text-ink-900">
                  {formatMoney(p.revenue)}
                </Td>
                <Td align="right" className="font-medium text-ink-900">
                  {formatMoney(p.commission)}
                </Td>
                <Td align="right" className="hidden lg:table-cell">
                  {formatMoney(p.lifetimeCommission)}
                </Td>
                <Td align="right" className="hidden text-emerald-700 md:table-cell">
                  {formatMoney(p.paid)}
                </Td>
                <Td align="right" className={p.payable > 0 ? 'font-semibold text-amber-700' : 'text-ink-400'}>
                  {formatMoney(p.payable)}
                </Td>
                <Td align="right">
                  <Button size="xs" variant="secondary" disabled={p.payable <= 0} onClick={() => setPayFor(p.staff.id)}>
                    Record payout
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <PayoutHistory />
      {payTarget && <PayoutModal staffId={payTarget.staff.id} name={payTarget.staff.name} payable={payTarget.payable} onClose={() => setPayFor(null)} />}
    </div>
  );
}

function PayoutHistory() {
  const data = useStore((s) => s.data.salon);
  if (!data.payouts.length) return null;
  return (
    <Card>
      <CardHeader title="Commission payouts" description="Simulated payout records" />
      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Staff</Th>
            <Th className="hidden sm:table-cell">Note</Th>
            <Th align="right">Amount</Th>
          </tr>
        </thead>
        <tbody>
          {data.payouts.slice(0, 15).map((p) => (
            <tr key={p.id}>
              <Td className="whitespace-nowrap">{formatDate(p.date)}</Td>
              <Td>{data.staff.find((s) => s.id === p.staffId)?.name}</Td>
              <Td className="hidden text-ink-500 sm:table-cell">{p.note ?? '—'}</Td>
              <Td align="right" className="font-medium text-ink-900">
                {formatMoney(p.amount)}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function PayoutModal({ staffId, name, payable, onClose }: { staffId: string; name: string; payable: number; onClose: () => void }) {
  const record = useStore((s) => s.recordPayout);
  const [raw, setRaw] = useState(String(payable / 100));
  const [note, setNote] = useState('Commission settlement');
  const amt = toMinor(raw);
  const err = Number.isNaN(amt) || amt <= 0 ? 'Enter an amount above zero.' : amt > payable ? 'Cannot pay more than the payable balance.' : null;
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Record commission payout"
      description={`${name} · payable ${formatMoney(payable)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!!err}
            onClick={() => {
              const res = record(staffId, amt, note.trim() || undefined);
              if (!res.ok) return toast.error('Could not record payout', res.error);
              toast.success('Payout recorded (simulated)', `${formatMoney(amt)} to ${name}`);
              onClose();
            }}
          >
            Record payout
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Amount" htmlFor="po-amt" error={err}>
          <MoneyInput id="po-amt" value={raw} onChange={(e) => setRaw(e.target.value)} invalid={!!err} />
        </Field>
        <Field label="Note" htmlFor="po-note">
          <Textarea id="po-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} className="min-h-[56px]" />
        </Field>
        <p className="text-xs text-ink-500">Demo mode: records the payout only. No money is transferred.</p>
      </div>
    </Modal>
  );
}
