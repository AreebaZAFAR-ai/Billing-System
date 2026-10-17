import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { INDUSTRIES } from '@/lib/types';
import { useStore } from '@/store/store';
import { cn } from '@/lib/utils';
import { Drawer } from '@/components/ui/Modal';
import { useSwitchIndustry } from './IndustrySwitcher';
import { ResetDemoButton } from './ResetDemoButton';

export function DemoGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const active = useStore((s) => s.activeIndustry);
  const cfg = INDUSTRY_CONFIG[active];
  const switchTo = useSwitchIndustry();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const key = (idx: number) => `${active}:${idx}`;
  const completed = cfg.guide.filter((_, i) => done[key(i)]).length;

  return (
    <Drawer open={open} onClose={onClose} title="Guided demo" description={`${cfg.label} · ${completed}/${cfg.guide.length} steps`} width="max-w-md">
      <div className="space-y-6 p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Switch industry</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {INDUSTRIES.map((i) => {
              const c = INDUSTRY_CONFIG[i];
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => switchTo(i)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors',
                    i === active ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-ink-200 text-ink-700 hover:bg-ink-50',
                  )}
                >
                  <c.icon className="h-4 w-4" aria-hidden />
                  {c.short}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Suggested walkthrough</p>
          <p className="mt-1 text-sm text-ink-600">{cfg.pitch}</p>
          <ol className="mt-3 space-y-2">
            {cfg.guide.map((step, idx) => {
              const isDone = !!done[key(idx)];
              return (
                <li key={idx} className={cn('rounded-lg border p-3 transition-colors', isDone ? 'border-emerald-200 bg-emerald-50/50' : 'border-ink-200')}>
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setDone((d) => ({ ...d, [key(idx)]: !d[key(idx)] }))}
                      aria-label={isDone ? `Mark step ${idx + 1} as not done` : `Mark step ${idx + 1} as done`}
                      className="mt-0.5 text-ink-400 hover:text-emerald-600"
                    >
                      {isDone ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900">
                        {idx + 1}. {step.title}
                      </p>
                      <p className="mt-0.5 text-[13px] text-ink-500">{step.detail}</p>
                      {step.to && (
                        <Link to={step.to} onClick={onClose} className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:text-brand-800">
                          Go there <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rounded-lg bg-ink-50 p-4">
          <p className="text-sm font-medium text-ink-900">Presenting again?</p>
          <p className="mt-0.5 text-[13px] text-ink-500">Reset restores the original sample data for every industry.</p>
          <ResetDemoButton variant="secondary" className="mt-3" />
        </div>
      </div>
    </Drawer>
  );
}
