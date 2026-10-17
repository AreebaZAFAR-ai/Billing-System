import { useEffect, useState } from 'react';
import { Building, Database, Download, Globe2, ImagePlus, Percent, RotateCcw, Save, Trash2 } from 'lucide-react';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { BusinessProfile } from '@/lib/types';
import { INDUSTRIES } from '@/lib/types';
import { useStore } from '@/store/store';
import { downloadFile, emailValid } from '@/lib/utils';
import { PageHeader } from '@/components/layout/AppShell';
import { ResetDemoButton } from '@/components/layout/ResetDemoButton';
import { Button } from '@/components/ui/Button';
import { Badge, Card, CardHeader } from '@/components/ui/Card';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Table, Td, Th } from '@/components/ui/Table';
import { toast } from '@/components/ui/Toast';

const CURRENCIES = [
  { code: 'PKR', label: 'Pakistani Rupee (PKR)', locale: 'en-PK' },
  { code: 'USD', label: 'US Dollar (USD)', locale: 'en-US' },
  { code: 'AED', label: 'UAE Dirham (AED)', locale: 'en-AE' },
  { code: 'SAR', label: 'Saudi Riyal (SAR)', locale: 'en-SA' },
  { code: 'GBP', label: 'British Pound (GBP)', locale: 'en-GB' },
];

export default function Settings() {
  const industry = useStore((s) => s.activeIndustry);
  const cfg = INDUSTRY_CONFIG[industry];
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: cfg.label, to: '/demo/overview' }, { label: 'Settings' }]}
        title="Settings"
        description="Configure the demo business, invoices and regional preferences. Settings are stored in this browser only."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <BusinessForm key={industry} />
          {industry === 'salon' && <CommissionSettings />}
        </div>
        <div className="space-y-5">
          <RegionalSettings />
          <DemoData />
        </div>
      </div>
    </>
  );
}

function BusinessForm() {
  const industry = useStore((s) => s.activeIndustry);
  const saved = useStore((s) => s.settings.businesses[industry]);
  const update = useStore((s) => s.updateBusiness);
  const cfg = INDUSTRY_CONFIG[industry];
  const [f, setF] = useState<BusinessProfile>(saved);
  const [taxRaw, setTaxRaw] = useState(String(saved.taxRate));
  const [termsRaw, setTermsRaw] = useState(String(saved.paymentTermsDays));
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    setF(saved);
    setTaxRaw(String(saved.taxRate));
    setTermsRaw(String(saved.paymentTermsDays));
  }, [saved]);

  const tax = Number(taxRaw);
  const terms = Number(termsRaw);
  const errors = {
    name: f.name.trim().length < 2 ? 'Enter a business name.' : null,
    email: !emailValid(f.email) ? 'Enter a valid email or leave blank.' : null,
    prefix: !/^[A-Z0-9]{2,6}$/.test(f.invoicePrefix) ? 'Use 2–6 capital letters or digits.' : null,
    tax: !Number.isFinite(tax) || tax < 0 || tax > 50 ? 'Tax rate must be between 0 and 50.' : null,
    terms: !/^\d{1,3}$/.test(termsRaw) || terms > 180 ? 'Enter 0–180 days.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const dirty = JSON.stringify({ ...f, taxRate: tax, paymentTermsDays: terms }) !== JSON.stringify(saved);
  const set = (k: keyof BusinessProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const onLogo = (file?: File) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type)) return toast.error('Unsupported image', 'Use PNG, JPG, SVG or WebP.');
    if (file.size > 200 * 1024) return toast.error('Logo too large', 'Please use an image under 200 KB.');
    const reader = new FileReader();
    reader.onload = () => setF((x) => ({ ...x, logoDataUrl: String(reader.result) }));
    reader.onerror = () => toast.error('Could not read the image');
    reader.readAsDataURL(file);
  };

  const save = () => {
    setTouched(true);
    if (!valid) return;
    update(industry, { ...f, name: f.name.trim(), taxRate: Math.round(tax * 100) / 100, paymentTermsDays: terms });
    toast.success('Business profile saved', 'New invoices will use these details.');
  };

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Building className="h-4 w-4 text-ink-400" aria-hidden /> {cfg.label} business profile
          </span>
        }
        description="Shown on invoices and receipts. Leave contact details blank until you have real ones — none are invented for you."
        actions={
          <Button icon={<Save className="h-4 w-4" />} onClick={save} disabled={!dirty}>
            Save changes
          </Button>
        }
      />
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="flex items-center gap-4 sm:col-span-2">
          {f.logoDataUrl ? (
            <img src={f.logoDataUrl} alt="Business logo" className="h-14 w-14 rounded-lg border border-ink-200 object-contain" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-ink-900 text-sm font-bold text-white">{f.logoText || '—'}</span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-800 shadow-sm hover:bg-ink-50 focus-within:ring-2 focus-within:ring-brand-500">
              <ImagePlus className="h-4 w-4" aria-hidden /> Upload logo
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" onChange={(e) => onLogo(e.target.files?.[0])} />
            </label>
            {f.logoDataUrl && (
              <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setF((x) => ({ ...x, logoDataUrl: undefined }))}>
                Remove
              </Button>
            )}
            <p className="w-full text-xs text-ink-500">PNG, JPG, SVG or WebP under 200 KB. Without a logo, initials are used.</p>
          </div>
        </div>
        <Field label="Business name" htmlFor="b-name" required error={touched ? errors.name : null}>
          <Input id="b-name" value={f.name} onChange={set('name')} maxLength={60} />
        </Field>
        <Field label="Logo initials" htmlFor="b-initials">
          <Input id="b-initials" value={f.logoText} onChange={(e) => setF((x) => ({ ...x, logoText: e.target.value.toUpperCase().slice(0, 3) }))} />
        </Field>
        <Field label="Phone" htmlFor="b-phone">
          <Input id="b-phone" value={f.phone} onChange={set('phone')} placeholder="Not set" maxLength={30} />
        </Field>
        <Field label="Email" htmlFor="b-email" error={touched ? errors.email : null}>
          <Input id="b-email" value={f.email} onChange={set('email')} placeholder="Not set" maxLength={60} />
        </Field>
        <Field label="Address" htmlFor="b-addr" className="sm:col-span-2">
          <Input id="b-addr" value={f.address} onChange={set('address')} placeholder="Not set" maxLength={120} />
        </Field>
      </div>
      <div className="border-t border-ink-100 p-5">
        <h3 className="mb-4 text-sm font-semibold text-ink-900">Invoices & tax</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Invoice prefix" htmlFor="b-prefix" error={touched ? errors.prefix : null} hint={`Next: ${f.invoicePrefix}-YYMM-00001`}>
            <Input id="b-prefix" value={f.invoicePrefix} onChange={(e) => setF((x) => ({ ...x, invoicePrefix: e.target.value.toUpperCase() }))} maxLength={6} />
          </Field>
          <Field label="Payment terms (days)" htmlFor="b-terms" error={touched ? errors.terms : null} hint="0 = due on receipt">
            <Input id="b-terms" value={termsRaw} onChange={(e) => setTermsRaw(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Tax label" htmlFor="b-taxlabel">
            <Input id="b-taxlabel" value={f.taxLabel} onChange={set('taxLabel')} maxLength={20} />
          </Field>
          <div className="sm:col-span-2">
            <Checkbox label="Apply tax by default" description="Can still be toggled per invoice. Rate is a sample setting — confirm the correct rate for your business." checked={f.taxEnabled} onChange={(v) => setF((x) => ({ ...x, taxEnabled: v }))} />
          </div>
          <Field label="Default tax rate (%)" htmlFor="b-tax" error={touched ? errors.tax : null}>
            <Input id="b-tax" value={taxRaw} onChange={(e) => setTaxRaw(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Invoice footer note" htmlFor="b-footer" className="sm:col-span-3">
            <Input id="b-footer" value={f.footerNote} onChange={set('footerNote')} maxLength={120} />
          </Field>
          <Field label="Payment instructions" htmlFor="b-instr" className="sm:col-span-3">
            <Textarea id="b-instr" value={f.paymentInstructions} onChange={set('paymentInstructions')} maxLength={240} className="min-h-[56px]" />
          </Field>
        </div>
      </div>
    </Card>
  );
}

function RegionalSettings() {
  const global = useStore((s) => s.settings.global);
  const update = useStore((s) => s.updateGlobal);
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Globe2 className="h-4 w-4 text-ink-400" aria-hidden /> Regional & receipts
          </span>
        }
      />
      <div className="space-y-4 p-5">
        <Field label="Display currency" htmlFor="g-cur" hint={`Preview: ${formatMoney(125050)}. Only changes formatting — amounts are not converted.`}>
          <Select
            id="g-cur"
            value={global.currency}
            onChange={(e) => {
              const c = CURRENCIES.find((x) => x.code === e.target.value)!;
              update({ currency: c.code, locale: c.locale });
              toast.success('Currency updated', c.label);
            }}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Grocery receipt format" htmlFor="g-rcpt">
          <Select id="g-rcpt" value={global.receiptFormat} onChange={(e) => update({ receiptFormat: e.target.value as 'a4' | 'thermal' })}>
            <option value="thermal">80 mm thermal receipt</option>
            <option value="a4">A4 invoice</option>
          </Select>
        </Field>
        <Field label="Salon commission basis" htmlFor="g-comm">
          <Select id="g-comm" value={global.commissionBasis} onChange={(e) => update({ commissionBasis: e.target.value as 'gross' | 'net' })}>
            <option value="gross">Service price before invoice discount</option>
            <option value="net">Service price after invoice discount</option>
          </Select>
        </Field>
      </div>
    </Card>
  );
}

function CommissionSettings() {
  const staff = useStore((s) => s.data.salon.staff);
  const updateStaff = useStore((s) => s.updateStaff);
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(staff.map((s) => [s.id, String(s.commissionRate ?? '')])));
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-ink-400" aria-hidden /> Staff commission rates
          </span>
        }
        description="New rates apply to new invoices; past invoices keep the rate at the time of billing."
      />
      <Table>
        <thead>
          <tr>
            <Th>Staff</Th>
            <Th>Role</Th>
            <Th align="right">Rate (%)</Th>
          </tr>
        </thead>
        <tbody>
          {staff
            .filter((s) => s.commissionRate !== undefined)
            .map((s) => {
              const v = draft[s.id] ?? '';
              const n = Number(v);
              const bad = v === '' || !Number.isFinite(n) || n < 0 || n > 60;
              return (
                <tr key={s.id}>
                  <Td className="font-medium text-ink-900">{s.name}</Td>
                  <Td>{s.role}</Td>
                  <Td align="right">
                    <label htmlFor={`rate-${s.id}`} className="sr-only">
                      Commission rate for {s.name}
                    </label>
                    <Input
                      id={`rate-${s.id}`}
                      className="ml-auto h-8 w-20 text-right"
                      inputMode="decimal"
                      value={v}
                      invalid={bad}
                      onChange={(e) => setDraft((d) => ({ ...d, [s.id]: e.target.value }))}
                      onBlur={() => {
                        if (bad) {
                          toast.error('Invalid rate', 'Use a value between 0 and 60.');
                          setDraft((d) => ({ ...d, [s.id]: String(s.commissionRate) }));
                        } else if (n !== s.commissionRate) {
                          updateStaff('salon', s.id, { commissionRate: Math.round(n * 100) / 100 });
                          toast.success('Commission rate updated', `${s.name}: ${n}%`);
                        }
                      }}
                    />
                  </Td>
                </tr>
              );
            })}
        </tbody>
      </Table>
    </Card>
  );
}

function DemoData() {
  const industry = useStore((s) => s.activeIndustry);
  const all = useStore((s) => s.data);
  const seededAt = useStore((s) => s.seededAt);
  const status = useStore((s) => s.persistStatus);
  const settings = useStore((s) => s.settings);
  const resetIndustry = useStore((s) => s.resetIndustry);
  const [confirm, setConfirm] = useState(false);
  const cfg = INDUSTRY_CONFIG[industry];
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Database className="h-4 w-4 text-ink-400" aria-hidden /> Demo data
          </span>
        }
        description="Simulated records stored in this browser (localStorage). Not a secure database."
      />
      <div className="space-y-4 p-5">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Storage</dt>
            <dd>
              <Badge tone={status === 'ok' ? 'success' : 'warning'}>{status === 'ok' ? 'Saving locally' : status === 'quota' ? 'Storage full' : 'Not available'}</Badge>
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-500">Sample data generated</dt>
            <dd className="text-right text-ink-800">{formatDateTime(seededAt)}</dd>
          </div>
          {INDUSTRIES.map((i) => (
            <div key={i} className="flex justify-between gap-3">
              <dt className="text-ink-500">{INDUSTRY_CONFIG[i].label}</dt>
              <dd className="tabular-nums text-ink-800">
                {all[i].invoices.length.toLocaleString()} invoices · {all[i].customers.length} {INDUSTRY_CONFIG[i].customers.toLowerCase()}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          <ResetDemoButton variant="secondary" label="Reset all demo data" />
          <Button variant="secondary" size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirm(true)}>
            Reset {cfg.short} only
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            onClick={() => downloadFile(`billora-demo-backup.json`, JSON.stringify({ settings, data: all }, null, 2), 'application/json')}
          >
            Download JSON
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Reset ${cfg.label} data?`}
        description={`All ${cfg.label.toLowerCase()} invoices, ${cfg.customers.toLowerCase()} and stock changes made in this browser will be replaced by the original sample data. Other industries and settings are kept.`}
        confirmLabel="Reset"
        onConfirm={() => {
          resetIndustry(industry);
          toast.success(`${cfg.label} data restored`);
        }}
      />
    </Card>
  );
}
