import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { Appointment, Industry } from '@/lib/types';
import { useStore } from '@/store/store';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { formatMoney } from '@/lib/money';
import { toDateKey } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';
import { CustomerPicker } from '@/components/customers/CustomerPicker';

const SLOTS = Array.from({ length: 24 }, (_, i) => {
  const h = 9 + Math.floor(i / 2);
  return `${String(h).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;
});

export function AppointmentModal({
  industry,
  open,
  onClose,
  withServices,
  defaultDate,
  onBooked,
}: {
  industry: Industry;
  open: boolean;
  onClose: () => void;
  withServices?: boolean;
  defaultDate?: string;
  onBooked?: (a: Appointment) => void;
}) {
  const cfg = INDUSTRY_CONFIG[industry];
  const data = useStore((s) => s.data[industry]);
  const addAppointment = useStore((s) => s.addAppointment);
  const staff = data.staff.filter((s) => s.active && (industry === 'salon' ? s.commissionRate !== undefined : s.role === 'Doctor'));
  const services = useMemo(() => data.catalog.filter((c) => c.kind !== 'product' && c.active), [data.catalog]);
  const [customerId, setCustomerId] = useState<string>();
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(defaultDate ?? toDateKey(new Date()));
  const [time, setTime] = useState('11:00');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerId(undefined);
      setStaffId('');
      setDate(defaultDate ?? toDateKey(new Date()));
      setServiceIds([]);
      setNotes('');
      setTouched(false);
      const next = SLOTS.find((s) => {
        const [h, m] = s.split(':').map(Number);
        const d = new Date();
        return h * 60 + m > d.getHours() * 60 + d.getMinutes();
      });
      setTime(next ?? '11:00');
    }
  }, [open, defaultDate]);

  const today = toDateKey(new Date());
  const clash = data.appointments.find(
    (a) => a.staffId === staffId && a.date === date && a.time === time && a.status !== 'cancelled' && a.status !== 'no-show',
  );
  const pastSlot = (() => {
    if (date < today) return true;
    if (date > today) return false;
    const [h, m] = time.split(':').map(Number);
    const n = new Date();
    return h * 60 + m <= n.getHours() * 60 + n.getMinutes();
  })();
  const errors = {
    customer: !customerId ? `Select a ${cfg.customer.toLowerCase()}.` : null,
    staff: !staffId ? `Select ${industry === 'salon' ? 'a staff member' : 'a doctor'}.` : null,
    date: pastSlot ? 'Choose a future date and time.' : null,
    clash: clash ? 'This time slot is already booked for the selected staff member.' : null,
    services: withServices && serviceIds.length === 0 ? 'Select at least one service.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const duration = serviceIds.reduce((a, id) => a + (services.find((s) => s.id === id)?.durationMin ?? 0), 0);
  const estimate = serviceIds.reduce((a, id) => a + (services.find((s) => s.id === id)?.price ?? 0), 0);

  const submit = () => {
    setTouched(true);
    if (!valid || !customerId) return;
    const a = addAppointment(industry, { customerId, staffId, date, time, serviceIds, status: 'scheduled', notes: notes.trim() || undefined });
    toast.success('Appointment booked', `${date} at ${time} · confirmation messages are not sent in demo mode.`);
    onBooked?.(a);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Book appointment"
      description={`Schedule a ${cfg.customer.toLowerCase()} visit`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Book appointment</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={cfg.customer} required error={touched ? errors.customer : null}>
          <CustomerPicker industry={industry} value={customerId} onChange={setCustomerId} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={industry === 'salon' ? 'Staff member' : 'Doctor'} htmlFor="ap-staff" required error={touched ? errors.staff : null}>
            <Select id="ap-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Select…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.specialty ?? s.role}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="ap-date" required error={touched ? errors.date : null}>
            <Input id="ap-date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time" htmlFor="ap-time" required error={touched ? errors.clash : null}>
            <Select id="ap-time" value={time} onChange={(e) => setTime(e.target.value)}>
              {SLOTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>
        {withServices && (
          <Field label="Services" required error={touched ? errors.services : null} hint={serviceIds.length ? `${duration} min · est. ${formatMoney(estimate)}` : undefined}>
            <div className="grid max-h-60 gap-1.5 overflow-y-auto rounded-lg border border-ink-200 p-2 sm:grid-cols-2">
              {services.map((s) => {
                const on = serviceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setServiceIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-[13px] transition-colors',
                      on ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-transparent hover:bg-ink-50',
                    )}
                  >
                    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-ink-300')}>
                      {on && <Check className="h-3 w-3" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="tabular-nums text-ink-500">{formatMoney(s.price)}</span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        <Field label="Notes (optional)" htmlFor="ap-notes">
          <Textarea id="ap-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} className="min-h-[56px]" />
        </Field>
      </div>
    </Modal>
  );
}
