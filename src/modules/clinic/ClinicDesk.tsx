import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, CalendarPlus, FilePlus2, Stethoscope, UserPlus, Users, Wallet, HandCoins, Receipt } from 'lucide-react';
import { addDays, formatDate, formatTimeOfDay, fromDateKey, toDateKey } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { METHOD_LABEL, categoryBreakdown, doctorBreakdown, paymentMethods, summarize } from '@/lib/analytics';
import type { AppointmentStatus, Invoice } from '@/lib/types';
import { useStore } from '@/store/store';
import { uid } from '@/lib/utils';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Avatar, Badge, Card, CardHeader, EmptyState, StatCard } from '@/components/ui/Card';
import { Field, Input, SearchInput, Select } from '@/components/ui/Field';
import { Table, Tabs, Td, Th } from '@/components/ui/Table';
import { InvoiceComposer, catalogToLine } from '@/components/invoice/InvoiceComposer';
import { InvoiceDrawer } from '@/components/invoice/InvoiceDrawer';
import { InvoiceMiniTable } from '@/components/invoice/InvoiceTable';
import { AppointmentModal } from '@/components/appointments/AppointmentModal';
import { CustomerFormModal } from '@/components/customers/CustomerForm';
import { CustomerDrawer } from '@/components/customers/CustomerDrawer';
import { matchCustomer } from '@/components/customers/CustomerPicker';
import { customerBalance } from '@/lib/analytics';
import { BarList, Donut, SERIES } from '@/components/charts/Charts';

type Tab = 'today' | 'bill' | 'patients' | 'summary';

const STATUS_TONE: Record<AppointmentStatus, 'neutral' | 'info' | 'success' | 'danger' | 'warning'> = {
  scheduled: 'neutral',
  'checked-in': 'info',
  completed: 'success',
  cancelled: 'danger',
  'no-show': 'warning',
};
const STATUS_TEXT: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  'checked-in': 'Checked in',
  completed: 'Billed',
  cancelled: 'Cancelled',
  'no-show': 'No-show',
};

export default function ClinicDesk() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'today';
  const setTab = (t: Tab) => setParams(t === 'today' ? {} : { tab: t });
  const data = useStore((s) => s.data.clinic);
  const biz = useStore((s) => s.settings.businesses.clinic);
  const setStatus = useStore((s) => s.setAppointmentStatus);

  const [date, setDate] = useState(toDateKey(new Date()));
  const [doctorFilter, setDoctorFilter] = useState('');
  const [booking, setBooking] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [openPatient, setOpenPatient] = useState<string | null>(null);
  const [patientQ, setPatientQ] = useState('');
  const [prefill, setPrefill] = useState<{ key: string; customerId?: string; doctorId?: string; appointmentId?: string }>(() => ({
    key: uid('c'),
    customerId: params.get('customer') ?? undefined,
  }));

  const doctors = data.staff.filter((s) => s.role === 'Doctor');
  const appts = data.appointments
    .filter((a) => a.date === date && (!doctorFilter || a.staffId === doctorFilter))
    .sort((a, b) => a.time.localeCompare(b.time));
  const dayRange = { from: date, to: date };
  const day = useMemo(() => summarize(data.invoices, dayRange, 'gross'), [data.invoices, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const startBilling = (customerId?: string, doctorId?: string, appointmentId?: string) => {
    setPrefill({ key: uid('c'), customerId, doctorId, appointmentId });
    setTab('bill');
  };

  const onCreated = (inv: Invoice) => {
    setPrefill({ key: uid('c') });
    setParams({});
    setOpenInvoice(inv.id);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Clinic', to: '/demo/overview' }, { label: 'Clinic Desk' }]}
        title="Clinic Desk"
        description={`${biz.name} · appointments, patient billing and daily collections`}
        actions={
          <>
            <Button variant="secondary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setRegistering(true)}>
              Register patient
            </Button>
            <Button variant="secondary" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setBooking(true)}>
              Book appointment
            </Button>
            <Button icon={<FilePlus2 className="h-4 w-4" />} onClick={() => startBilling()}>
              New invoice
            </Button>
          </>
        }
      />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'today', label: 'Appointments' },
          { value: 'bill', label: 'New invoice' },
          { value: 'patients', label: 'Patients', count: data.customers.length },
          { value: 'summary', label: 'Daily summary' },
        ]}
      />

      {tab === 'today' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Billed" value={formatMoney(day.billed)} sub={formatDate(date)} icon={Receipt} />
            <StatCard label="Collected" value={formatMoney(day.collected)} icon={Wallet} tone="success" />
            <StatCard label="Outstanding" value={formatMoney(day.outstanding)} icon={HandCoins} tone={day.outstanding ? 'warning' : 'success'} />
            <StatCard label="Patients billed" value={day.invoiceCount} sub={`${appts.filter((a) => a.status === 'scheduled' || a.status === 'checked-in').length} waiting`} icon={Users} />
          </div>
          <Card>
            <CardHeader
              title="Appointments"
              description="Check patients in and bill their visit"
              actions={
                <>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDate(toDateKey(addDays(fromDateKey(date), -1)))} aria-label="Previous day">
                      ‹
                    </Button>
                    <label htmlFor="clinic-date" className="sr-only">
                      Date
                    </label>
                    <Input id="clinic-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-8 w-[150px]" />
                    <Button size="sm" variant="ghost" onClick={() => setDate(toDateKey(addDays(fromDateKey(date), 1)))} aria-label="Next day">
                      ›
                    </Button>
                  </div>
                  <label htmlFor="doc-filter" className="sr-only">
                    Doctor
                  </label>
                  <Select id="doc-filter" className="h-8 w-[180px]" value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)}>
                    <option value="">All doctors</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </>
              }
            />
            {appts.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No appointments on this day" description="Book an appointment or pick another date." action={<Button size="sm" onClick={() => setBooking(true)}>Book appointment</Button>} />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Time</Th>
                    <Th>Patient</Th>
                    <Th className="hidden md:table-cell">Doctor</Th>
                    <Th>Status</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {appts.map((a) => {
                    const p = data.customers.find((c) => c.id === a.customerId);
                    const d = data.staff.find((s) => s.id === a.staffId);
                    const inv = a.invoiceId ? data.invoices.find((i) => i.id === a.invoiceId) : undefined;
                    const open = a.status === 'scheduled' || a.status === 'checked-in';
                    return (
                      <tr key={a.id} className="hover:bg-ink-50/60">
                        <Td className="whitespace-nowrap font-medium tabular-nums text-ink-900">{formatTimeOfDay(a.time)}</Td>
                        <Td>
                          <button type="button" className="flex items-center gap-2.5 text-left" onClick={() => p && setOpenPatient(p.id)}>
                            <Avatar name={p?.name ?? '?'} />
                            <span>
                              <span className="block font-medium text-ink-900 hover:underline">{p?.name}</span>
                              <span className="block text-xs text-ink-500">{p?.code}</span>
                            </span>
                          </button>
                        </Td>
                        <Td className="hidden md:table-cell">
                          <span className="block text-ink-800">{d?.name}</span>
                          <span className="block text-xs text-ink-500">{d?.specialty}</span>
                        </Td>
                        <Td>
                          <Badge tone={STATUS_TONE[a.status]} dot>
                            {STATUS_TEXT[a.status]}
                          </Badge>
                        </Td>
                        <Td align="right">
                          <div className="flex justify-end gap-1.5">
                            {a.status === 'scheduled' && (
                              <Button size="xs" variant="secondary" onClick={() => setStatus('clinic', a.id, 'checked-in')}>
                                Check in
                              </Button>
                            )}
                            {open && (
                              <Button size="xs" onClick={() => startBilling(a.customerId, a.staffId, a.id)}>
                                Bill
                              </Button>
                            )}
                            {open && (
                              <Button size="xs" variant="ghost" onClick={() => setStatus('clinic', a.id, a.status === 'scheduled' ? 'cancelled' : 'no-show')}>
                                {a.status === 'scheduled' ? 'Cancel' : 'No-show'}
                              </Button>
                            )}
                            {inv && (
                              <Button size="xs" variant="ghost" onClick={() => setOpenInvoice(inv.id)}>
                                {inv.number}
                              </Button>
                            )}
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {tab === 'bill' && <ClinicComposer key={prefill.key} prefill={prefill} onCreated={onCreated} />}

      {tab === 'patients' && (
        <Card>
          <CardHeader
            title="Patient directory"
            description="Fictional patients · click a row for billing history"
            actions={
              <>
                <SearchInput placeholder="Name, MRN or phone" value={patientQ} onChange={(e) => setPatientQ(e.target.value)} wrapperClassName="w-60" />
                <Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={() => setRegistering(true)}>
                  Register
                </Button>
              </>
            }
          />
          <PatientTable query={patientQ} onOpen={setOpenPatient} onBill={(id) => startBilling(id)} />
        </Card>
      )}

      {tab === 'summary' && <DailySummary date={date} setDate={setDate} onOpen={setOpenInvoice} />}

      <AppointmentModal industry="clinic" open={booking} onClose={() => setBooking(false)} defaultDate={date >= toDateKey(new Date()) ? date : undefined} onBooked={(a) => setDate(a.date)} />
      <CustomerFormModal industry="clinic" open={registering} onClose={() => setRegistering(false)} onSaved={(c) => startBilling(c.id)} />
      <InvoiceDrawer industry="clinic" invoiceId={openInvoice} onClose={() => setOpenInvoice(null)} />
      <CustomerDrawer industry="clinic" customerId={openPatient} onClose={() => setOpenPatient(null)} />
    </>
  );
}

function ClinicComposer({ prefill, onCreated }: { prefill: { customerId?: string; doctorId?: string; appointmentId?: string }; onCreated: (i: Invoice) => void }) {
  const data = useStore((s) => s.data.clinic);
  const doctors = data.staff.filter((s) => s.role === 'Doctor' && s.active);
  const [doctorId, setDoctorId] = useState(prefill.doctorId ?? '');
  const doctor = doctors.find((d) => d.id === doctorId);
  const consultFor = (specialty?: string) =>
    data.catalog.find((c) =>
      specialty === 'Pediatrician' ? c.name === 'Pediatric Consultation' : specialty === 'Dermatologist' ? c.name === 'Specialist Consultation' : c.name === 'General Consultation',
    );
  const initialItems = useMemo(() => {
    const d = doctors.find((x) => x.id === prefill.doctorId);
    const c = d ? consultFor(d.specialty) : undefined;
    return c ? [catalogToLine(c)] : [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <InvoiceComposer
      industry="clinic"
      catalog={data.catalog}
      initialCustomerId={prefill.customerId}
      initialItems={initialItems}
      lockCustomer={!!prefill.appointmentId}
      context={
        <Field label="Consulting doctor" htmlFor="cl-doctor" required>
          <Select id="cl-doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
            <option value="">Select doctor…</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.specialty} ({formatMoney(d.consultationFee ?? 0)})
              </option>
            ))}
          </Select>
        </Field>
      }
      quickAdd={(add) =>
        doctor ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
            <span className="flex items-center gap-2 text-[13px] text-sky-900">
              <Stethoscope className="h-4 w-4" aria-hidden /> {doctor.name}
            </span>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                const c = consultFor(doctor.specialty);
                if (c) add(c);
              }}
            >
              + Add consultation
            </Button>
          </div>
        ) : null
      }
      resolveMeta={() => (doctorId ? { meta: { doctorId, appointmentId: prefill.appointmentId } } : { error: 'Select the consulting doctor.' })}
      onCreated={onCreated}
      submitLabel="Create invoice"
    />
  );
}

function PatientTable({ query, onOpen, onBill }: { query: string; onOpen: (id: string) => void; onBill: (id: string) => void }) {
  const data = useStore((s) => s.data.clinic);
  const rows = useMemo(
    () =>
      data.customers
        .filter((c) => matchCustomer(c, query))
        .map((c) => ({ c, b: customerBalance(data.invoices, c.id) }))
        .sort((a, b) => (b.b.lastVisit ?? '').localeCompare(a.b.lastVisit ?? '')),
    [data.customers, data.invoices, query],
  );
  if (!rows.length) return <EmptyState title="No patients match" description="Try another name, MRN or phone number." />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Patient</Th>
          <Th className="hidden md:table-cell">Phone</Th>
          <Th className="hidden lg:table-cell">Last visit</Th>
          <Th align="right">Visits</Th>
          <Th align="right">Balance</Th>
          <Th align="right">
            <span className="sr-only">Actions</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 60).map(({ c, b }) => (
          <tr key={c.id} className="cursor-pointer hover:bg-ink-50/60" onClick={() => onOpen(c.id)}>
            <Td>
              <div className="flex items-center gap-2.5">
                <Avatar name={c.name} />
                <div>
                  <p className="font-medium text-ink-900">{c.name}</p>
                  <p className="text-xs text-ink-500">
                    {c.code} · {c.age}y {c.gender}
                  </p>
                </div>
              </div>
            </Td>
            <Td className="hidden md:table-cell">{c.phone}</Td>
            <Td className="hidden lg:table-cell">{b.lastVisit ? formatDate(b.lastVisit) : '—'}</Td>
            <Td align="right">{b.invoices.length}</Td>
            <Td align="right">{b.outstanding > 0 ? <span className="font-medium text-amber-700">{formatMoney(b.outstanding)}</span> : <span className="text-ink-400">—</span>}</Td>
            <Td align="right">
              <Button
                size="xs"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  onBill(c.id);
                }}
              >
                Bill
              </Button>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function DailySummary({ date, setDate, onOpen }: { date: string; setDate: (d: string) => void; onOpen: (id: string) => void }) {
  const data = useStore((s) => s.data.clinic);
  const range = { from: date, to: date };
  const s = summarize(data.invoices, range, 'gross');
  const cats = categoryBreakdown(data.invoices, range);
  const docs = doctorBreakdown(data.invoices, range, data.staff);
  const methods = paymentMethods(data.invoices, range);
  const invs = data.invoices.filter((i) => toDateKey(i.createdAt) === date);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="sum-date" className="text-sm font-medium text-ink-700">
          Summary for
        </label>
        <Input id="sum-date" type="date" value={date} max={toDateKey(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-[160px]" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Billed revenue" value={formatMoney(s.billed)} sub={`${s.invoiceCount} invoices`} icon={Receipt} />
        <StatCard label="Collected (simulated)" value={formatMoney(s.collected)} icon={Wallet} tone="success" />
        <StatCard label="Outstanding from day" value={formatMoney(s.outstanding)} icon={HandCoins} tone={s.outstanding ? 'warning' : 'success'} />
        <StatCard label="Discounts given" value={formatMoney(s.discounts)} icon={Users} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="By service type" />
          <div className="p-5">{cats.length ? <BarList rows={cats.map((c) => ({ label: c.name, value: c.revenue }))} /> : <EmptyState title="No billing on this day" />}</div>
        </Card>
        <Card>
          <CardHeader title="By doctor" />
          <div className="p-5">
            {docs.some((d) => d.invoices) ? (
              <BarList rows={docs.filter((d) => d.invoices).map((d) => ({ label: d.staff.name, value: d.billed, sub: `${d.invoices}` }))} color={SERIES[2]} />
            ) : (
              <EmptyState title="No consultations" />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Collections by method" />
          <div className="p-5">
            {methods.length ? (
              <Donut centerLabel="Collected" centerValue={formatMoney(s.collected)} height={150} slices={methods.map((m, i) => ({ label: METHOD_LABEL[m.method], value: m.amount, color: SERIES[i], display: formatMoney(m.amount) }))} />
            ) : (
              <EmptyState title="No payments" />
            )}
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title={`Invoices on ${formatDate(date)}`} />
        {invs.length ? <InvoiceMiniTable invoices={invs} onOpen={(i) => onOpen(i.id)} /> : <EmptyState title="No invoices on this day" />}
      </Card>
    </div>
  );
}
