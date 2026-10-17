import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ClipboardCopy,
  FileText,
  Layers,
  Mail,
  Menu,
  Minus,
  Settings2,
  ShieldCheck,
  Users,
  Wallet,
  X,
  Zap,
  TrendingUp,
  HandCoins,
} from 'lucide-react';
import { BRAND } from '@/config/brand';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { dailySeries, summarize } from '@/lib/analytics';
import { rangeFromPreset } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { INDUSTRIES, type Industry } from '@/lib/types';
import { useStore } from '@/store/store';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/layout/Logo';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { StatCard } from '@/components/ui/Card';
import { Legend, RevenueTrend, SERIES } from '@/components/charts/Charts';
import { InvoiceMiniTable } from '@/components/invoice/InvoiceTable';
import { toast } from '@/components/ui/Toast';

const NAV = [
  { href: '#solutions', label: 'Solutions' },
  { href: '#features', label: 'Features' },
  { href: '#how', label: 'How it works' },
  { href: '#compare', label: 'Compare modules' },
];

const FEATURES = [
  { icon: FileText, title: 'Automated invoicing', body: 'Itemized invoices with automatic numbering, discounts and configurable tax — calculated by one shared billing engine, never by hand.' },
  { icon: Wallet, title: 'Payments & balances', body: 'Record cash, card, bank-transfer and wallet payments. Part payments and outstanding balances are tracked on every invoice.' },
  { icon: Boxes, title: 'Inventory', body: 'Stock is deducted the moment a sale completes. Reorder levels raise low-stock alerts before shelves run empty.' },
  { icon: Users, title: 'Customer & patient records', body: 'Searchable directories with visit history, billing history and balances — for customers, patients or salon clients.' },
  { icon: BarChart3, title: 'Reporting', body: 'Billed revenue, collections, outstanding balances, payment methods and top items — all from the same records, so the numbers agree.' },
  { icon: Settings2, title: 'Configurable per business', body: 'Business profile, logo, invoice prefix, payment terms, tax label and receipt format are set per industry.' },
];

const COMPARE: { label: string; values: Record<Industry, boolean | string> }[] = [
  { label: 'Itemized invoices & printing', values: { grocery: true, clinic: true, hospital: true, salon: true } },
  { label: 'Partial payments & balances', values: { grocery: true, clinic: true, hospital: true, salon: true } },
  { label: 'Barcode / SKU checkout', values: { grocery: true, clinic: false, hospital: false, salon: false } },
  { label: 'Stock deduction & alerts', values: { grocery: true, clinic: false, hospital: 'Pharmacy', salon: 'Retail' } },
  { label: 'Appointments', values: { grocery: false, clinic: true, hospital: false, salon: true } },
  { label: 'Doctor / staff assignment', values: { grocery: false, clinic: true, hospital: true, salon: true } },
  { label: 'Departments & admissions', values: { grocery: false, clinic: false, hospital: true, salon: false } },
  { label: 'Staff commissions', values: { grocery: false, clinic: false, hospital: false, salon: true } },
];

function Section({ id, eyebrow, title, intro, children, className }: { id?: string; eyebrow: string; title: string; intro?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24', className)}>
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold text-brand-700">{eyebrow}</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight text-ink-900 sm:text-[34px] sm:leading-tight">{title}</h2>
        {intro && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-600">{intro}</p>}
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}

function ProductPreview() {
  const data = useStore((s) => s.data.clinic);
  const biz = useStore((s) => s.settings.businesses.clinic);
  const navigate = useNavigate();
  const setActive = useStore((s) => s.setActiveIndustry);
  const range = useMemo(() => rangeFromPreset('30d'), []);
  const s = useMemo(() => summarize(data.invoices, range), [data.invoices, range]);
  const series = useMemo(() => dailySeries(data.invoices, range), [data.invoices, range]);
  return (
    <div className="relative mx-auto mt-14 max-w-6xl">
      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-[0_30px_80px_-30px_rgba(16,24,40,0.35)]">
        <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink-200" />
          <span className="ml-3 truncate text-xs text-ink-500">{biz.name} · Overview · last 30 days</span>
          <span className="ml-auto rounded border border-dashed border-amber-300 bg-amber-50 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Live preview · sample data</span>
        </div>
        <div className="grid gap-4 bg-ink-50/60 p-4 sm:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Billed revenue" value={formatMoney(s.billed)} icon={TrendingUp} />
            <StatCard label="Collected" value={formatMoney(s.collected)} icon={Wallet} tone="success" />
            <StatCard label="Invoices" value={s.invoiceCount.toLocaleString()} sub={`Avg ${formatMoney(s.avgInvoice)}`} icon={FileText} />
            <StatCard label="Outstanding" value={formatMoney(s.outstanding)} icon={HandCoins} tone="warning" />
          </div>
          <div className="grid gap-4 lg:grid-cols-5">
            <div className="rounded-xl border border-ink-200 bg-white p-4 lg:col-span-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-900">Revenue trend</p>
                <Legend items={[{ label: 'Billed', color: SERIES[0] }, { label: 'Collected', color: SERIES[1] }]} />
              </div>
              <RevenueTrend data={series} height={200} />
            </div>
            <div className="hidden overflow-hidden rounded-xl border border-ink-200 bg-white lg:col-span-2 lg:block">
              <p className="border-b border-ink-100 px-4 py-3 text-sm font-semibold text-ink-900">Recent invoices</p>
              <InvoiceMiniTable
                invoices={data.invoices.slice(0, 5)}
                showCustomer={false}
                onOpen={(inv) => {
                  setActive('clinic');
                  navigate(`/demo/invoices/${inv.id}`);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestDemo() {
  const [f, setF] = useState({ name: '', business: '', industry: 'Clinic', contact: '', message: '' });
  const [prepared, setPrepared] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const errors = {
    name: f.name.trim().length < 2 ? 'Please enter your name.' : null,
    business: f.business.trim().length < 2 ? 'Please enter your business name.' : null,
    contact: f.contact.trim().length < 5 ? 'Add an email or phone number so we can reply.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const body = `Demo request\n\nName: ${f.name}\nBusiness: ${f.business}\nIndustry: ${f.industry}\nContact: ${f.contact}\n\n${f.message}`;
  const submit = () => {
    setTouched(true);
    if (!valid) return;
    if (BRAND.contactEmail) {
      window.location.href = `mailto:${BRAND.contactEmail}?subject=${encodeURIComponent(`${BRAND.name} demo request — ${f.business}`)}&body=${encodeURIComponent(body)}`;
    } else {
      setPrepared(body);
    }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <section id="contact" className="scroll-mt-20 bg-ink-950 px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-brand-300">Request a custom demo</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-[34px] sm:leading-tight">See it configured for your business</h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-300">
            Tell us how you bill today. We’ll walk you through a demonstration set up with your services, products and invoice layout.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-ink-200">
            {['Your services, prices and tax settings', 'Your invoice and receipt branding', 'The workflow your front desk or cashier actually uses'].map((x) => (
              <li key={x} className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-brand-300" aria-hidden /> {x}
              </li>
            ))}
          </ul>
          <ButtonLink to="/demo" variant="secondary" className="mt-8" icon={<ArrowRight className="h-4 w-4" />}>
            Or explore the live demo now
          </ButtonLink>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-pop sm:p-8">
          {prepared ? (
            <div>
              <p className="text-base font-semibold text-ink-900">Your request is ready</p>
              <p className="mt-1 text-sm text-ink-500">
                A contact channel hasn’t been configured for this prototype yet, so nothing was sent. Copy the request below and share it directly.
              </p>
              <pre className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-[13px] text-ink-700">{prepared}</pre>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  icon={<ClipboardCopy className="h-4 w-4" />}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(prepared);
                      toast.success('Request copied to clipboard');
                    } catch {
                      toast.error('Copy failed', 'Select the text and copy it manually.');
                    }
                  }}
                >
                  Copy request
                </Button>
                <Button variant="secondary" onClick={() => setPrepared(null)}>
                  Edit
                </Button>
              </div>
            </div>
          ) : (
            <form
              noValidate
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <Field label="Your name" htmlFor="rq-name" required error={touched ? errors.name : null}>
                <Input id="rq-name" value={f.name} onChange={set('name')} autoComplete="name" />
              </Field>
              <Field label="Business name" htmlFor="rq-biz" required error={touched ? errors.business : null}>
                <Input id="rq-biz" value={f.business} onChange={set('business')} autoComplete="organization" />
              </Field>
              <Field label="Industry" htmlFor="rq-ind">
                <Select id="rq-ind" value={f.industry} onChange={set('industry')}>
                  {['Hospital', 'Clinic', 'Beauty salon', 'Grocery / retail', 'Other'].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Email or phone" htmlFor="rq-contact" required error={touched ? errors.contact : null}>
                <Input id="rq-contact" value={f.contact} onChange={set('contact')} autoComplete="email" />
              </Field>
              <Field label="What would you like to see?" htmlFor="rq-msg" className="sm:col-span-2">
                <Textarea id="rq-msg" value={f.message} onChange={set('message')} maxLength={600} placeholder="e.g. We run two clinics and want partial payments and doctor-wise reports." />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" size="lg" className="w-full" icon={<Mail className="h-4 w-4" />}>
                  Request a custom demo
                </Button>
                <p className="mt-2 text-center text-xs text-ink-500">
                  {BRAND.contactEmail ? 'Opens your email app with the request filled in.' : 'Prepares your request to share — nothing is sent automatically.'}
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const setActive = useStore((s) => s.setActiveIndustry);
  const [menu, setMenu] = useState(false);
  const startIndustry = (i: Industry) => {
    setActive(i);
    navigate(INDUSTRY_CONFIG[i].modulePath);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-sm font-medium text-ink-600 hover:text-ink-900">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a href="#contact" className="hidden text-sm font-medium text-ink-600 hover:text-ink-900 sm:block">
              Contact
            </a>
            <ButtonLink to="/demo" size="sm" className="hidden sm:inline-flex">
              Explore Live Demo
            </ButtonLink>
            <button type="button" className="rounded-lg p-2 text-ink-600 hover:bg-ink-100 md:hidden" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
              {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menu && (
          <nav aria-label="Mobile" className="border-t border-ink-100 px-4 py-3 md:hidden">
            {[...NAV, { href: '#contact', label: 'Contact' }].map((n) => (
              <a key={n.href} href={n.href} onClick={() => setMenu(false)} className="block rounded-lg px-2 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50">
                {n.label}
              </a>
            ))}
            <ButtonLink to="/demo" className="mt-2 w-full">
              Explore Live Demo
            </ButtonLink>
          </nav>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[linear-gradient(to_bottom,#f2f8f7,transparent)]" />
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(#d6e4e2_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_60%)] opacity-60" />
          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-600 shadow-sm">
                <Layers className="h-3.5 w-3.5 text-brand-600" aria-hidden /> One billing platform · four industry modules
              </span>
              <h1 className="mt-6 text-[40px] font-semibold leading-[1.08] tracking-tight text-ink-950 sm:text-6xl">
                Billing that runs itself, <span className="text-brand-700">so you can run the business.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-600">
                {BRAND.name} brings invoicing, payments, inventory, customer records and reporting into one system — tailored for hospitals, clinics, salons and grocery stores.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <ButtonLink to="/demo" size="lg" icon={<Zap className="h-4 w-4" />}>
                  Explore Live Demo
                </ButtonLink>
                <a href="#solutions" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-ink-200 bg-white px-5 text-[15px] font-medium text-ink-800 shadow-sm hover:bg-ink-50">
                  Explore Solutions <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
              <p className="mt-4 text-xs text-ink-500">No sign-up needed · runs on fictional sample data</p>
            </div>
            <ProductPreview />
          </div>
        </section>

        {/* Industries */}
        <Section id="solutions" eyebrow="Solutions" title="Built around how each business actually bills" intro="A shared billing engine keeps every calculation consistent. Each industry gets the screens, terminology and workflow it needs.">
          <div className="grid gap-5 sm:grid-cols-2">
            {INDUSTRIES.map((i) => {
              const c = INDUSTRY_CONFIG[i];
              return (
                <article key={i} className="group flex flex-col rounded-2xl border border-ink-200 bg-white p-6 transition-shadow hover:shadow-pop">
                  <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl', c.accent.soft, c.accent.text)}>
                    <c.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-ink-900">{i === 'grocery' ? 'Grocery marts & retail' : i === 'salon' ? 'Beauty parlours & salons' : `${c.label}s`}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{c.description}</p>
                  <ul className="mt-4 space-y-1.5 text-[13px] text-ink-700">
                    {c.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-brand-600" aria-hidden /> {h}
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => startIndustry(i)} className="mt-6 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-brand-700 hover:text-brand-800">
                    Try the {c.short.toLowerCase()} demo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </button>
                </article>
              );
            })}
          </div>
        </Section>

        {/* Features */}
        <Section id="features" eyebrow="Features" title="Everything between the sale and the report" className="bg-ink-50">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-ink-200 bg-ink-200 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white p-6">
                <f.icon className="h-5 w-5 text-brand-700" aria-hidden />
                <h3 className="mt-4 text-[15px] font-semibold text-ink-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* How it works */}
        <Section id="how" eyebrow="How it works" title="From setup to reports in four steps">
          <ol className="grid gap-6 md:grid-cols-4">
            {[
              { t: 'Configure', d: 'Add your business profile, services or products, prices, tax and invoice numbering.' },
              { t: 'Bill', d: 'Use the screen built for your industry — POS, clinic desk, hospital billing or salon checkout.' },
              { t: 'Collect', d: 'Record full or part payments by cash, card, transfer or wallet. Balances update instantly.' },
              { t: 'Review', d: 'Dashboards and reports update from the same records — revenue, collections, stock and staff.' },
            ].map((s, idx) => (
              <li key={s.t} className="relative">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-sm font-semibold text-brand-800">{idx + 1}</span>
                <h3 className="mt-4 text-[15px] font-semibold text-ink-900">{s.t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{s.d}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Benefits */}
        <section className="border-y border-ink-100 bg-ink-50 px-4 py-20 sm:px-6">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-brand-700">Why automate billing</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">Less arithmetic. Fewer surprises.</h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-600">
                Manual billing means re-adding totals, chasing who still owes what, and guessing which shelf is empty. Automation removes the repetitive parts so your team can focus on customers and patients.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: ShieldCheck, t: 'Consistent calculations', d: 'Subtotals, discounts and tax use the same rules on every invoice.' },
                { icon: Wallet, t: 'Clear balances', d: 'Know exactly what has been billed, collected and is still outstanding.' },
                { icon: Boxes, t: 'Stock you can trust', d: 'Sales update stock automatically and flag items to reorder.' },
                { icon: BarChart3, t: 'Decisions from data', d: 'See which services, products and staff drive revenue.' },
              ].map((b) => (
                <li key={b.t} className="rounded-xl border border-ink-200 bg-white p-5">
                  <b.icon className="h-5 w-5 text-brand-700" aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-ink-900">{b.t}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{b.d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Compare */}
        <Section id="compare" eyebrow="Compare modules" title="The right features for each industry" intro="Shared foundations, industry-specific workflows. Irrelevant features stay out of the way.">
          <div className="overflow-x-auto rounded-2xl border border-ink-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-ink-50">
                  <th scope="col" className="px-5 py-3 text-left font-medium text-ink-500">
                    Capability
                  </th>
                  {INDUSTRIES.map((i) => (
                    <th key={i} scope="col" className="px-4 py-3 text-center font-semibold text-ink-900">
                      {INDUSTRY_CONFIG[i].short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.label} className="border-t border-ink-100">
                    <th scope="row" className="px-5 py-3 text-left font-normal text-ink-700">
                      {row.label}
                    </th>
                    {INDUSTRIES.map((i) => {
                      const v = row.values[i];
                      return (
                        <td key={i} className="px-4 py-3 text-center">
                          {v === true ? (
                            <Check className="mx-auto h-4 w-4 text-brand-600" aria-label="Included" />
                          ) : v === false ? (
                            <Minus className="mx-auto h-4 w-4 text-ink-300" aria-label="Not applicable" />
                          ) : (
                            <span className="text-xs font-medium text-ink-700">{v}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <RequestDemo />
      </main>

      <footer className="bg-white px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-3 text-sm text-ink-500">{BRAND.tagline} for hospitals, clinics, salons and grocery stores.</p>
          </div>
          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <div>
              <p className="font-semibold text-ink-900">Product</p>
              <ul className="mt-3 space-y-2 text-ink-600">
                <li><a href="#features" className="hover:text-ink-900">Features</a></li>
                <li><a href="#how" className="hover:text-ink-900">How it works</a></li>
                <li><a href="#compare" className="hover:text-ink-900">Compare modules</a></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-ink-900">Live demo</p>
              <ul className="mt-3 space-y-2 text-ink-600">
                {INDUSTRIES.map((i) => (
                  <li key={i}>
                    <button type="button" onClick={() => startIndustry(i)} className="hover:text-ink-900">
                      {INDUSTRY_CONFIG[i].label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-ink-900">Get in touch</p>
              <ul className="mt-3 space-y-2 text-ink-600">
                <li><a href="#contact" className="hover:text-ink-900">Request a custom demo</a></li>
                <li><Link to="/demo" className="hover:text-ink-900">Industry selector</Link></li>
                {BRAND.contactUrl && (
                  <li><a href={BRAND.contactUrl} className="hover:text-ink-900">Book a call</a></li>
                )}
              </ul>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-2 border-t border-ink-100 pt-6 text-xs text-ink-400 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} {BRAND.name}. Product prototype.</p>
          <p>Demo uses fictional data only. No real payments are processed.</p>
        </div>
      </footer>
    </div>
  );
}
