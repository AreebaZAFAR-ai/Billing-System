import { useEffect, useState } from 'react';
import type { Customer, Industry } from '@/lib/types';
import { useStore } from '@/store/store';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { emailValid, phoneValid } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/components/ui/Toast';

const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Other'];

export function CustomerFormModal({
  industry,
  open,
  onClose,
  onSaved,
  existing,
}: {
  industry: Industry;
  open: boolean;
  onClose: () => void;
  onSaved?: (c: Customer) => void;
  existing?: Customer;
}) {
  const cfg = INDUSTRY_CONFIG[industry];
  const addCustomer = useStore((s) => s.addCustomer);
  const updateCustomer = useStore((s) => s.updateCustomer);
  const medical = industry === 'clinic' || industry === 'hospital';
  const [form, setForm] = useState({ name: '', phone: '', email: '', gender: '', age: '', city: 'Lahore', notes: '' });
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setTouched(false);
      setForm(
        existing
          ? {
              name: existing.name,
              phone: existing.phone,
              email: existing.email ?? '',
              gender: existing.gender ?? '',
              age: existing.age ? String(existing.age) : '',
              city: existing.city ?? 'Lahore',
              notes: existing.notes ?? '',
            }
          : { name: '', phone: '', email: '', gender: '', age: '', city: 'Lahore', notes: '' },
      );
    }
  }, [open, existing]);

  const errors = {
    name: form.name.trim().length < 3 ? 'Enter a full name (at least 3 characters).' : null,
    phone: !phoneValid(form.phone) ? 'Enter a valid phone number, e.g. 0300-5551234.' : null,
    email: !emailValid(form.email) ? 'Enter a valid email address.' : null,
    age:
      form.age !== '' && (!/^\d{1,3}$/.test(form.age) || Number(form.age) > 120) ? 'Enter an age between 0 and 120.' : null,
    gender: medical && !form.gender ? 'Select a gender.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const payload = {
      name: form.name.trim().replace(/\s+/g, ' '),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      gender: (form.gender || undefined) as Customer['gender'],
      age: form.age ? Number(form.age) : undefined,
      city: form.city,
      notes: form.notes.trim() || undefined,
    };
    if (existing) {
      updateCustomer(industry, existing.id, payload);
      toast.success(`${cfg.customer} updated`, payload.name);
      onSaved?.({ ...existing, ...payload });
    } else {
      const c = addCustomer(industry, payload);
      toast.success(`${cfg.customer} registered`, `${c.name} · ${c.code}`);
      onSaved?.(c);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? `Edit ${cfg.customer.toLowerCase()}` : `Register new ${cfg.customer.toLowerCase()}`}
      description="Use fictional details only — this is a demo environment."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{existing ? 'Save changes' : `Register ${cfg.customer.toLowerCase()}`}</Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <Field label="Full name" htmlFor="cf-name" required error={touched ? errors.name : null} className="sm:col-span-2">
          <Input id="cf-name" value={form.name} onChange={set('name')} invalid={touched && !!errors.name} autoComplete="off" maxLength={60} />
        </Field>
        <Field label="Phone" htmlFor="cf-phone" required error={touched ? errors.phone : null}>
          <Input id="cf-phone" value={form.phone} onChange={set('phone')} placeholder="0300-5551234" invalid={touched && !!errors.phone} inputMode="tel" />
        </Field>
        <Field label="Email" htmlFor="cf-email" error={touched ? errors.email : null}>
          <Input id="cf-email" type="email" value={form.email} onChange={set('email')} placeholder="name@example.com" invalid={touched && !!errors.email} />
        </Field>
        <Field label="Gender" htmlFor="cf-gender" required={medical} error={touched ? errors.gender : null}>
          <Select id="cf-gender" value={form.gender} onChange={set('gender')}>
            <option value="">Select…</option>
            <option>Female</option>
            <option>Male</option>
            <option>Other</option>
          </Select>
        </Field>
        {industry !== 'grocery' && (
          <Field label="Age" htmlFor="cf-age" error={touched ? errors.age : null}>
            <Input id="cf-age" value={form.age} onChange={set('age')} inputMode="numeric" maxLength={3} invalid={touched && !!errors.age} />
          </Field>
        )}
        <Field label="City" htmlFor="cf-city">
          <Select id="cf-city" value={form.city} onChange={set('city')}>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" htmlFor="cf-notes" className="sm:col-span-2" hint={medical ? 'Billing notes only — do not store clinical information here.' : undefined}>
          <Textarea id="cf-notes" value={form.notes} onChange={set('notes')} maxLength={240} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
