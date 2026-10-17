import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, ChevronsUpDown } from 'lucide-react';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { INDUSTRIES, type Industry } from '@/lib/types';
import { useStore } from '@/store/store';
import { cn } from '@/lib/utils';

export function useSwitchIndustry() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const setActive = useStore((s) => s.setActiveIndustry);
  return (i: Industry) => {
    setActive(i);
    const onModule = Object.values(INDUSTRY_CONFIG).some((c) => pathname.startsWith(c.modulePath));
    if (onModule) navigate(INDUSTRY_CONFIG[i].modulePath);
    else if (pathname.startsWith('/demo/invoices/')) navigate('/demo/invoices');
  };
}

export function IndustrySwitcher({ compact }: { compact?: boolean }) {
  const active = useStore((s) => s.activeIndustry);
  const businesses = useStore((s) => s.settings.businesses);
  const switchTo = useSwitchIndustry();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = INDUSTRY_CONFIG[active];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2.5 rounded-lg border border-ink-200 bg-white text-left shadow-sm transition-colors hover:border-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          compact ? 'h-9 px-2' : 'h-10 pl-2 pr-2.5',
        )}
      >
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-md text-white', cfg.accent.bg)}>
          <cfg.icon className="h-4 w-4" aria-hidden />
        </span>
        {!compact && (
          <span className="hidden min-w-0 sm:block">
            <span className="block text-[11px] font-medium uppercase leading-none tracking-wide text-ink-400">Industry demo</span>
            <span className="mt-0.5 block truncate text-sm font-semibold leading-tight text-ink-900">{cfg.label}</span>
          </span>
        )}
        <ChevronsUpDown className="h-4 w-4 text-ink-400" aria-hidden />
        <span className="sr-only">Switch industry, current: {cfg.label}</span>
      </button>
      {open && (
        <ul role="listbox" aria-label="Choose industry demo" className="absolute right-0 z-30 mt-2 w-[300px] animate-slide-up rounded-xl border border-ink-200 bg-white p-1.5 shadow-pop sm:left-0 sm:right-auto">
          {INDUSTRIES.map((i) => {
            const c = INDUSTRY_CONFIG[i];
            return (
              <li key={i} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onClick={() => {
                    switchTo(i);
                    setOpen(false);
                  }}
                  className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-ink-50', i === active && 'bg-ink-50')}
                >
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-md text-white', c.accent.bg)}>
                    <c.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink-900">{c.label}</span>
                    <span className="block truncate text-xs text-ink-500">{businesses[i].name}</span>
                  </span>
                  {i === active && <Check className="h-4 w-4 text-brand-700" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
