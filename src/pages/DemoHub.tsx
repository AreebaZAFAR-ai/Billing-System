import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, FlaskConical, LayoutDashboard } from 'lucide-react';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { INDUSTRIES, type Industry } from '@/lib/types';
import { useStore } from '@/store/store';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/layout/Logo';
import { ResetDemoButton } from '@/components/layout/ResetDemoButton';
import { Button, ButtonLink } from '@/components/ui/Button';

export default function DemoHub() {
  const navigate = useNavigate();
  const setActive = useStore((s) => s.setActiveIndustry);
  const businesses = useStore((s) => s.settings.businesses);
  const data = useStore((s) => s.data);

  const start = (i: Industry, path?: string) => {
    setActive(i);
    navigate(path ?? INDUSTRY_CONFIG[i].modulePath);
  };

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <ResetDemoButton label="Reset demo" />
            <ButtonLink to="/" variant="secondary" size="sm">
              Back to site
            </ButtonLink>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Demo mode · fictional data · simulated payments
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">Choose an industry to explore</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-600">
            One billing engine, four industry workflows. Each demo has its own sample business, records and transactions — switch between them at any time from the top bar.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {INDUSTRIES.map((i) => {
            const c = INDUSTRY_CONFIG[i];
            return (
              <article key={i} className="flex flex-col rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-white', c.accent.bg)}>
                      <c.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <h2 className="text-lg font-semibold text-ink-900">{c.label}</h2>
                      <p className="text-[13px] text-ink-500">Sample business: {businesses[i].name}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-600">{data[i].invoices.length.toLocaleString()} sample invoices</span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-ink-600">{c.description}</p>
                <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px] text-ink-700">
                  {c.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
                      {h}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-lg bg-ink-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Try in under a minute</p>
                  <ol className="mt-1.5 space-y-0.5 text-[13px] text-ink-600">
                    {c.guide.slice(0, 3).map((g, idx) => (
                      <li key={g.title}>
                        {idx + 1}. {g.title}
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <Button onClick={() => start(i)} icon={<ArrowRight className="h-4 w-4" />}>
                    Start {c.short} demo
                  </Button>
                  <Button variant="secondary" onClick={() => start(i, '/demo/overview')} icon={<LayoutDashboard className="h-4 w-4" />}>
                    View dashboard
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-10 text-center text-xs text-ink-500">
          All names, records and amounts are fictional. No real money is moved and no messages are sent. Data is stored only in this browser and can be reset at any time.
        </p>
      </main>
    </div>
  );
}
