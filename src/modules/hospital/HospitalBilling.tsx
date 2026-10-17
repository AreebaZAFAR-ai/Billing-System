import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BedDouble, Building2, FilePlus2, HandCoins, LogOut, Receipt, Trash2, UserPlus, Wallet } from 'lucide-react';
import { ROOM_TYPES } from '@/data/catalog';
import { METHOD_LABEL, departmentBreakdown, paymentMethods, summarize } from '@/lib/analytics';
import { computeTotals, lineTotal, outstanding, validatePayment } from '@/lib/billing';
import { daysBetween, formatDate, formatDateTime, formatTime, toDateKey } from '@/lib/dates';
import { formatMoney, toMajorString, toMinor } from '@/lib/money';
import type { Admission, DiscountType, Invoice, PaymentMethod } from '@/lib/types';
import { useStore } from '@/store/store';
import { uid } from '@/lib/utils';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Avatar, Badge, Card, CardHeader, EmptyState, StatCard } from '@/components/ui/Card';
import { Field, Input, MoneyInput, Segmented, Select, Textarea } from '@/components/ui/Field';
import { Drawer, Modal } from '@/components/ui/Modal';
import { Table, Tabs, Td, Th } from '@/components/ui/Table';
import { toast } from '@/components/ui/Toast';
import { CatalogBrowser, InvoiceComposer, catalogToLine } from '@/components/invoice/InvoiceComposer';
import { InvoiceDrawer } from '@/components/invoice/InvoiceDrawer';
import { InvoiceMiniTable } from '@/components/invoice/InvoiceTable';
import { DiscountControl, TotalsPanel, parseDiscount } from '@/components/invoice/TotalsPanel';
import { MethodPicker } from '@/components/invoice/PaymentModal';
import { CustomerPicker } from '@/components/customers/CustomerPicker';
import { BarList, Donut, SERIES } from '@/components/charts/Charts';

type Tab = 'opd' | 'ipd' | 'bills' | 'collections';

export default function HospitalBilling() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'opd';
  const setTab = (t: Tab) => setParams({ tab: t });
  const data = useStore((s) => s.data.hospital);
  const biz = useStore((s) => s.settings.businesses.hospital);
  const [openInvoice, setOpenInvoice] = useState<string | null>(null);
  const [composerKey, setComposerKey] = useState(uid('h'));
  const [admitting, setAdmitting] = useState(false);
  const [openAdmission, setOpenAdmission] = useState<string | null>(null);

  const admitted = data.admissions.filter((a) => a.status === 'admitted');
  const today = toDateKey(new Date());
  const todaySummary = useMemo(() => summarize(data.invoices, { from: today, to: today }), [data.invoices, today]);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: 'Hospital', to: '/demo/overview' }, { label: 'Hospital Billing' }]}
        title="Hospital Billing"
        description={`${biz.name} · outpatient & inpatient billing demonstration (not a hospital information system)`}
        actions={
          <>
            <Button variant="secondary" icon={<BedDouble className="h-4 w-4" />} onClick={() => setAdmitting(true)}>
              Admit patient
            </Button>
            <Button
              icon={<FilePlus2 className="h-4 w-4" />}
              onClick={() => {
                setComposerKey(uid('h'));
                setTab('opd');
              }}
            >
              New OPD bill
            </Button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today's billing" value={formatMoney(todaySummary.billed)} sub={`${todaySummary.invoiceCount} bills`} icon={Receipt} />
        <StatCard label="Today's collections" value={formatMoney(todaySummary.collected)} icon={Wallet} tone="success" />
        <StatCard label="Current inpatients" value={admitted.length} sub={`${ROOM_TYPES.length} room types`} icon={BedDouble} />
        <StatCard
          label="Total outstanding"
          value={formatMoney(data.invoices.reduce((a, i) => a + outstanding(i), 0))}
          sub={`${data.invoices.filter((i) => outstanding(i) > 0).length} open bills`}
          icon={HandCoins}
          tone="warning"
        />
      </div>
      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'opd', label: 'Outpatient (OPD) billing' },
          { value: 'ipd', label: 'Inpatients (IPD)', count: admitted.length },
          { value: 'bills', label: 'Bill history' },
          { value: 'collections', label: 'Collections & departments' },
        ]}
      />

      {tab === 'opd' && (
        <OpdComposer
          key={composerKey}
          initialCustomerId={params.get('customer') ?? undefined}
          onCreated={(inv) => {
            setComposerKey(uid('h'));
            setOpenInvoice(inv.id);
          }}
        />
      )}
      {tab === 'ipd' && <Inpatients onOpen={setOpenAdmission} onAdmit={() => setAdmitting(true)} onInvoice={setOpenInvoice} />}
      {tab === 'bills' && <BillHistory onOpen={setOpenInvoice} />}
      {tab === 'collections' && <Collections />}

      <AdmitModal open={admitting} onClose={() => setAdmitting(false)} onAdmitted={(a) => { setTab('ipd'); setOpenAdmission(a.id); }} />
      {openAdmission && <AdmissionDrawer admissionId={openAdmission} onClose={() => setOpenAdmission(null)} onBilled={(id) => { setOpenAdmission(null); setOpenInvoice(id); }} />}
      <InvoiceDrawer industry="hospital" invoiceId={openInvoice} onClose={() => setOpenInvoice(null)} />
    </>
  );
}

function OpdComposer({ initialCustomerId, onCreated }: { initialCustomerId?: string; onCreated: (i: Invoice) => void }) {
  const data = useStore((s) => s.data.hospital);
  const [dept, setDept] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const clinicalDepts = data.departments.filter((d) => !['dep_lab', 'dep_rad', 'dep_phr'].includes(d.id));
  const doctors = data.staff.filter((s) => !dept || s.departmentId === dept);
  const catalog = useMemo(() => data.catalog.filter((c) => !c.name.startsWith('Inpatient') && !c.name.startsWith('Nursing')), [data.catalog]);
  return (
    <InvoiceComposer
      industry="hospital"
      catalog={catalog}
      initialCustomerId={initialCustomerId}
      context={
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Department" htmlFor="h-dept" required>
            <Select
              id="h-dept"
              value={dept}
              onChange={(e) => {
                setDept(e.target.value);
                setDoctorId('');
              }}
            >
              <option value="">Select department…</option>
              {clinicalDepts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Doctor" htmlFor="h-doc" required>
            <Select id="h-doc" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">Select doctor…</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.specialty}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      }
      quickAdd={(add) => {
        const consult = data.catalog.find((c) => c.category === 'Consultation' && c.departmentId === dept && (c.name.startsWith('OPD') || c.name.startsWith('Emergency')));
        return consult ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
            <span className="text-[13px] text-indigo-900">{consult.name}</span>
            <Button size="xs" variant="secondary" onClick={() => add(consult)}>
              + Add · {formatMoney(consult.price)}
            </Button>
          </div>
        ) : null;
      }}
      resolveMeta={() =>
        !dept ? { error: 'Select a department.' } : !doctorId ? { error: 'Select the treating doctor.' } : { meta: { visitType: 'OPD', departmentId: dept, doctorId } }
      }
      onCreated={onCreated}
      submitLabel="Generate OPD bill"
    />
  );
}

function runningTotal(a: Admission) {
  const days = Math.max(1, daysBetween(a.admittedAt, new Date()));
  const charges = a.charges.reduce((s, l) => s + lineTotal(l), 0);
  return { days, room: days * a.roomRate, charges, total: days * a.roomRate + charges };
}

function Inpatients({ onOpen, onAdmit, onInvoice }: { onOpen: (id: string) => void; onAdmit: () => void; onInvoice: (id: string) => void }) {
  const data = useStore((s) => s.data.hospital);
  const [view, setView] = useState<'admitted' | 'discharged'>('admitted');
  const rows = data.admissions
    .filter((a) => a.status === view)
    .sort((a, b) => (b.dischargedAt ?? b.admittedAt).localeCompare(a.dischargedAt ?? a.admittedAt));
  const name = (id: string) => data.customers.find((c) => c.id === id);
  const dep = (id: string) => data.departments.find((d) => d.id === id)?.name;
  return (
    <Card>
      <CardHeader
        title="Admissions"
        description="Running charges accumulate until discharge, then a single final bill is generated."
        actions={
          <>
            <Segmented
              label="Admission status"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'admitted', label: 'Admitted' },
                { value: 'discharged', label: 'Discharged' },
              ]}
            />
            <Button size="sm" icon={<UserPlus className="h-4 w-4" />} onClick={onAdmit}>
              Admit
            </Button>
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={BedDouble} title={view === 'admitted' ? 'No current inpatients' : 'No discharges yet'} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Admission</Th>
              <Th>Patient</Th>
              <Th className="hidden md:table-cell">Department / room</Th>
              <Th className="hidden sm:table-cell">{view === 'admitted' ? 'Admitted' : 'Discharged'}</Th>
              <Th align="right">{view === 'admitted' ? 'Running bill' : 'Final bill'}</Th>
              <Th align="right">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const p = name(a.patientId);
              const rt = runningTotal(a);
              const inv = a.invoiceId ? data.invoices.find((i) => i.id === a.invoiceId) : undefined;
              return (
                <tr key={a.id} className="hover:bg-ink-50/60">
                  <Td className="font-mono text-[13px] text-ink-900">{a.number}</Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={p?.name ?? '?'} />
                      <div>
                        <p className="font-medium text-ink-900">{p?.name}</p>
                        <p className="text-xs text-ink-500">{p?.code}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <p className="text-ink-800">{dep(a.departmentId)}</p>
                    <p className="text-xs text-ink-500">{a.roomType}</p>
                  </Td>
                  <Td className="hidden whitespace-nowrap sm:table-cell">
                    {formatDate(view === 'admitted' ? a.admittedAt : a.dischargedAt!)}
                    {view === 'admitted' && <p className="text-xs text-ink-500">Day {rt.days}</p>}
                  </Td>
                  <Td align="right" className="font-medium text-ink-900">
                    {view === 'admitted' ? formatMoney(rt.total) : inv ? formatMoney(inv.total) : '—'}
                    {inv && outstanding(inv) > 0 && <p className="text-xs font-normal text-amber-700">{formatMoney(outstanding(inv))} due</p>}
                  </Td>
                  <Td align="right">
                    {view === 'admitted' ? (
                      <Button size="xs" onClick={() => onOpen(a.id)}>
                        Manage
                      </Button>
                    ) : inv ? (
                      <Button size="xs" variant="secondary" onClick={() => onInvoice(inv.id)}>
                        {inv.number}
                      </Button>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

function AdmitModal({ open, onClose, onAdmitted }: { open: boolean; onClose: () => void; onAdmitted: (a: Admission) => void }) {
  const data = useStore((s) => s.data.hospital);
  const admit = useStore((s) => s.admitPatient);
  const [patientId, setPatientId] = useState<string>();
  const [dept, setDept] = useState('dep_gm');
  const [doctorId, setDoctorId] = useState('');
  const [room, setRoom] = useState(ROOM_TYPES[0].name);
  const [touched, setTouched] = useState(false);
  const wards = data.departments.filter((d) => ['dep_gm', 'dep_ped', 'dep_car', 'dep_sur'].includes(d.id));
  const doctors = data.staff.filter((s) => s.departmentId === dept);
  const already = patientId && data.admissions.some((a) => a.patientId === patientId && a.status === 'admitted');
  const err = !patientId ? 'Select a patient.' : already ? 'This patient is already admitted.' : !doctorId ? 'Select the admitting doctor.' : null;
  const close = () => {
    setPatientId(undefined);
    setDoctorId('');
    setTouched(false);
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title="Admit patient"
      description="Creates an inpatient admission with running charges"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTouched(true);
              if (err || !patientId) return;
              const rt = ROOM_TYPES.find((r) => r.name === room)!;
              const a = admit({ patientId, departmentId: dept, doctorId, roomType: rt.name, roomRate: rt.rate });
              toast.success(`Admitted · ${a.number}`, `${rt.name} at ${formatMoney(rt.rate)}/day`);
              close();
              onAdmitted(a);
            }}
          >
            Admit patient
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Patient" required>
          <CustomerPicker industry="hospital" value={patientId} onChange={setPatientId} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department" htmlFor="adm-dept">
            <Select
              id="adm-dept"
              value={dept}
              onChange={(e) => {
                setDept(e.target.value);
                setDoctorId('');
              }}
            >
              {wards.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Admitting doctor" htmlFor="adm-doc">
            <Select id="adm-doc" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">Select…</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Room type">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ROOM_TYPES.map((r) => (
              <button
                key={r.name}
                type="button"
                aria-pressed={room === r.name}
                onClick={() => setRoom(r.name)}
                className={
                  room === r.name
                    ? 'rounded-lg border border-brand-600 bg-brand-50 p-2.5 text-left'
                    : 'rounded-lg border border-ink-200 p-2.5 text-left hover:border-ink-300'
                }
              >
                <p className="text-[13px] font-medium text-ink-900">{r.name}</p>
                <p className="text-xs tabular-nums text-ink-500">{formatMoney(r.rate)}/day</p>
              </button>
            ))}
          </div>
        </Field>
        {touched && err && (
          <p className="text-sm text-red-600" role="alert">
            {err}
          </p>
        )}
      </div>
    </Modal>
  );
}

function AdmissionDrawer({ admissionId, onClose, onBilled }: { admissionId: string; onClose: () => void; onBilled: (invoiceId: string) => void }) {
  const data = useStore((s) => s.data.hospital);
  const addCharge = useStore((s) => s.addAdmissionCharge);
  const removeCharge = useStore((s) => s.removeAdmissionCharge);
  const [discharging, setDischarging] = useState(false);
  const a = data.admissions.find((x) => x.id === admissionId);
  if (!a) return null;
  const p = data.customers.find((c) => c.id === a.patientId);
  const doc = data.staff.find((s) => s.id === a.doctorId);
  const dept = data.departments.find((d) => d.id === a.departmentId);
  const rt = runningTotal(a);
  const chargeable = data.catalog.filter((c) => c.category !== 'Consultation' || c.name.startsWith('Inpatient'));
  const reserved = (id: string) => a.charges.filter((l) => l.refId === id).reduce((s, l) => s + l.quantity, 0);

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        width="max-w-3xl"
        title={`${a.number} · ${p?.name}`}
        description={`${dept?.name} · ${doc?.name} · ${a.roomType} · admitted ${formatDateTime(a.admittedAt)}`}
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            {a.status === 'admitted' && (
              <Button icon={<LogOut className="h-4 w-4" />} onClick={() => setDischarging(true)}>
                Discharge & generate bill
              </Button>
            )}
          </>
        }
      >
        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-ink-50 p-3">
                <p className="text-xs text-ink-500">Room ({rt.days}d)</p>
                <p className="mt-0.5 font-semibold tabular-nums">{formatMoney(rt.room)}</p>
              </div>
              <div className="rounded-lg bg-ink-50 p-3">
                <p className="text-xs text-ink-500">Charges</p>
                <p className="mt-0.5 font-semibold tabular-nums">{formatMoney(rt.charges)}</p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-3">
                <p className="text-xs text-indigo-700">Running total</p>
                <p className="mt-0.5 font-semibold tabular-nums text-indigo-900">{formatMoney(rt.total)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-500">Room days are counted from admission to discharge (minimum one day). Daily visit and nursing fees can be posted as charges.</p>
            <h3 className="mt-5 text-sm font-semibold text-ink-900">Posted charges</h3>
            {a.charges.length === 0 ? (
              <EmptyState title="No charges posted" description="Add lab, radiology, pharmacy or procedure charges." />
            ) : (
              <ul className="mt-2 divide-y divide-ink-100 rounded-lg border border-ink-200">
                {a.charges.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink-900">{l.description}</p>
                      <p className="text-xs text-ink-500">
                        {l.category} · {l.quantity} × {formatMoney(l.unitPrice)}
                      </p>
                    </div>
                    <span className="text-[13px] font-medium tabular-nums">{formatMoney(lineTotal(l))}</span>
                    <IconButton label={`Remove ${l.description}`} className="h-7 w-7 hover:text-red-600" onClick={() => removeCharge(a.id, l.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-ink-900">Post a charge</h3>
            <CatalogBrowser
              items={chargeable}
              stockOf={(c) => (c.trackStock ? (c.stock ?? 0) - reserved(c.id) : undefined)}
              onAdd={(c) => {
                if (c.trackStock && (c.stock ?? 0) - reserved(c.id) <= 0) {
                  toast.error('Insufficient stock', `${c.name} is out of stock.`);
                  return;
                }
                addCharge(a.id, catalogToLine(c));
                toast.success('Charge posted', c.name);
              }}
            />
          </div>
        </div>
      </Drawer>
      <DischargeModal admission={a} open={discharging} onClose={() => setDischarging(false)} onDone={onBilled} />
    </>
  );
}

function DischargeModal({ admission, open, onClose, onDone }: { admission: Admission; open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const discharge = useStore((s) => s.dischargeAdmission);
  const biz = useStore((s) => s.settings.businesses.hospital);
  const [discType, setDiscType] = useState<DiscountType>('fixed');
  const [discRaw, setDiscRaw] = useState('');
  const [mode, setMode] = useState<'none' | 'partial' | 'full'>('partial');
  const [method, setMethod] = useState<PaymentMethod>('bank');
  const [amountRaw, setAmountRaw] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rt = runningTotal(admission);
  const roomLine = { quantity: rt.days, unitPrice: admission.roomRate };
  const disc = parseDiscount(discType, discRaw, rt.total);
  const totals = computeTotals({ items: [roomLine, ...admission.charges], discount: disc.discount, taxRate: biz.taxRate, taxEnabled: biz.taxEnabled });
  const amt = mode === 'full' ? totals.total : mode === 'partial' ? toMinor(amountRaw) : 0;
  const payErr = mode === 'partial' ? (amountRaw === '' ? 'Enter the advance received.' : validatePayment(totals.total, amt)) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Discharge & final bill"
      description={`${admission.number} · ${rt.days} day(s) in ${admission.roomType}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setError(null);
              if (disc.error) return setError(disc.error);
              if (payErr) return setError(payErr);
              const res = discharge(admission.id, {
                extraItems: [],
                discount: disc.discount,
                payment: amt > 0 ? { amount: amt, method } : undefined,
                notes,
              });
              if (!res.ok) return setError(res.error);
              toast.success(`Final bill ${res.value.number} generated`, 'Patient discharged (demo).');
              onClose();
              onDone(res.value.id);
            }}
          >
            Discharge & bill {formatMoney(totals.total)}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-3">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">
                Room · {rt.days} × {formatMoney(admission.roomRate)}
              </dt>
              <dd className="tabular-nums">{formatMoney(rt.room)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Posted charges ({admission.charges.length})</dt>
              <dd className="tabular-nums">{formatMoney(rt.charges)}</dd>
            </div>
          </dl>
          <div className="space-y-3 rounded-lg bg-ink-50 p-3">
            <DiscountControl type={discType} value={discRaw} onType={setDiscType} onValue={setDiscRaw} error={disc.error} />
            <TotalsPanel totals={totals} taxLabel={biz.taxLabel} taxRate={biz.taxEnabled ? biz.taxRate : 0} />
          </div>
        </div>
        <div className="space-y-3">
          <Segmented
            label="Payment at discharge"
            className="w-full"
            value={mode}
            onChange={(m) => {
              setMode(m);
              if (m === 'partial' && !amountRaw) setAmountRaw(toMajorString(Math.round(totals.total / 2 / 10000) * 10000));
            }}
            options={[
              { value: 'full', label: 'Full' },
              { value: 'partial', label: 'Advance' },
              { value: 'none', label: 'Bill later' },
            ]}
          />
          {mode !== 'none' && <MethodPicker value={method} onChange={setMethod} compact />}
          {mode === 'partial' && (
            <Field label="Amount received" htmlFor="dis-amt" error={amountRaw ? payErr : null} hint={!payErr ? `Balance: ${formatMoney(totals.total - amt)}` : undefined}>
              <MoneyInput id="dis-amt" value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} invalid={!!amountRaw && !!payErr} />
            </Field>
          )}
          <Field label="Notes" htmlFor="dis-notes">
            <Textarea id="dis-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Panel/insurance claim pending" maxLength={200} />
          </Field>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

function BillHistory({ onOpen }: { onOpen: (id: string) => void }) {
  const data = useStore((s) => s.data.hospital);
  const [dept, setDept] = useState('');
  const [visit, setVisit] = useState<'all' | 'OPD' | 'IPD'>('all');
  const [date, setDate] = useState('');
  const rows = data.invoices.filter(
    (i) =>
      (!dept || i.meta?.departmentId === dept) &&
      (visit === 'all' || i.meta?.visitType === visit) &&
      (!date || toDateKey(i.createdAt) === date),
  );
  return (
    <Card>
      <CardHeader
        title="Bill history"
        description={`${rows.length} bills`}
        actions={
          <>
            <Segmented
              label="Visit type"
              size="sm"
              value={visit}
              onChange={setVisit}
              options={[
                { value: 'all', label: 'All' },
                { value: 'OPD', label: 'OPD' },
                { value: 'IPD', label: 'IPD' },
              ]}
            />
            <label htmlFor="bh-dept" className="sr-only">
              Department
            </label>
            <Select id="bh-dept" className="h-8 w-[170px]" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {data.departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <label htmlFor="bh-date" className="sr-only">
              Date
            </label>
            <Input id="bh-date" type="date" className="h-8 w-[150px]" value={date} onChange={(e) => setDate(e.target.value)} />
          </>
        }
      />
      {rows.length ? <InvoiceMiniTable invoices={rows.slice(0, 40)} onOpen={(i) => onOpen(i.id)} /> : <EmptyState title="No bills match these filters" />}
      {rows.length > 40 && <p className="px-5 py-3 text-xs text-ink-500">Showing latest 40 · see Bills page for full search and export.</p>}
    </Card>
  );
}

function Collections() {
  const data = useStore((s) => s.data.hospital);
  const [date, setDate] = useState(toDateKey(new Date()));
  const range = { from: date, to: date };
  const s = summarize(data.invoices, range);
  const methods = paymentMethods(data.invoices, range);
  const depts = departmentBreakdown(data.invoices, range, data.departments);
  const payments = data.invoices
    .flatMap((i) => i.payments.map((p) => ({ p, i })))
    .filter(({ p }) => toDateKey(p.date) === date)
    .sort((a, b) => b.p.date.localeCompare(a.p.date));
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label htmlFor="col-date" className="text-sm font-medium text-ink-700">
          Collections for
        </label>
        <Input id="col-date" type="date" className="w-[160px]" value={date} max={toDateKey(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Collected" value={formatMoney(s.collected)} sub={`${payments.length} receipts`} icon={Wallet} tone="success" />
        <StatCard label="Billed" value={formatMoney(s.billed)} sub={`${s.invoiceCount} bills`} icon={Receipt} />
        <StatCard label="OPD / IPD bills" value={`${data.invoices.filter((i) => toDateKey(i.createdAt) === date && i.meta?.visitType === 'OPD').length} / ${data.invoices.filter((i) => toDateKey(i.createdAt) === date && i.meta?.visitType === 'IPD').length}`} icon={Building2} />
        <StatCard label="Outstanding from day" value={formatMoney(s.outstanding)} icon={HandCoins} tone={s.outstanding ? 'warning' : 'success'} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Department-wise billing" description="Gross line charges by department, before bill-level discounts" />
          <div className="p-5">{depts.some((d) => d.gross) ? <BarList rows={depts.filter((d) => d.gross).map((d) => ({ label: d.name, value: d.gross, sub: `${d.invoices} bills` }))} color={SERIES[6]} /> : <EmptyState title="No billing on this day" />}</div>
        </Card>
        <Card>
          <CardHeader title="Collections by method" />
          <div className="p-5">
            {methods.length ? (
              <Donut centerLabel="Collected" centerValue={formatMoney(s.collected)} slices={methods.map((m, i) => ({ label: METHOD_LABEL[m.method], value: m.amount, color: SERIES[i], display: formatMoney(m.amount) }))} />
            ) : (
              <EmptyState title="No collections on this day" />
            )}
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader title="Receipts" description="Simulated payments recorded on this day" />
        {payments.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Bill</Th>
                <Th>Patient</Th>
                <Th className="hidden sm:table-cell">Method</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {payments.map(({ p, i }) => (
                <tr key={p.id}>
                  <Td className="whitespace-nowrap text-ink-500">{formatTime(p.date)}</Td>
                  <Td className="font-mono text-[13px]">{i.number}</Td>
                  <Td>{i.customerName}</Td>
                  <Td className="hidden sm:table-cell">
                    <Badge>{METHOD_LABEL[p.method]}</Badge>
                  </Td>
                  <Td align="right" className="font-medium text-ink-900">
                    {formatMoney(p.amount)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No receipts on this day" />
        )}
      </Card>
    </div>
  );
}
