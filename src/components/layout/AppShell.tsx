import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Compass,
  FlaskConical,
  Menu,
  X,
} from 'lucide-react';
import { INDUSTRY_CONFIG, MODULE_INDUSTRY, navFor } from '@/config/industries';
import { relativeTime } from '@/lib/dates';
import { useStore } from '@/store/store';
import { cn } from '@/lib/utils';
import { Button, IconButton } from '@/components/ui/Button';
import { IndustrySwitcher } from './IndustrySwitcher';
import { Logo } from './Logo';
import { DemoGuide } from './DemoGuide';
import { ResetDemoButton } from './ResetDemoButton';

function readCollapsed() {
  try {
    return window.localStorage.getItem('billora:ui:sidebar') === 'collapsed';
  } catch {
    return false;
  }
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const active = useStore((s) => s.activeIndustry);
  const items = navFor(active);
  const cfg = INDUSTRY_CONFIG[active];
  return (
    <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {!collapsed && <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{cfg.label}</p>}
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            cn(
              'group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
              collapsed && 'justify-center px-0',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-brand-700' : 'text-ink-400 group-hover:text-ink-600')} aria-hidden />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {collapsed && <span className="sr-only">{item.label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function Notifications() {
  const active = useStore((s) => s.activeIndustry);
  const activities = useStore((s) => s.data[active].activities);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string | null>(null);
  const unread = activities.filter((a) => !seen || a.at > seen).length;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <div className="relative">
      <IconButton
        label="Notifications"
        className="relative h-9 w-9"
        onClick={() => {
          setOpen((o) => !o);
          setSeen(activities[0]?.at ?? null);
        }}
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && !open && seen !== null && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" aria-hidden />}
      </IconButton>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-30 mt-2 w-[min(360px,calc(100vw-2rem))] animate-slide-up rounded-xl border border-ink-200 bg-white shadow-pop">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">Recent activity</p>
              <span className="text-xs text-ink-400">{INDUSTRY_CONFIG[active].label}</span>
            </div>
            <ul className="max-h-96 divide-y divide-ink-100 overflow-y-auto">
              {activities.slice(0, 12).map((a) => (
                <li key={a.id}>
                  {a.link ? (
                    <Link to={a.link} onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-ink-50">
                      <p className="text-[13px] text-ink-700">{a.message}</p>
                      <p className="mt-0.5 text-[11px] text-ink-400">{relativeTime(a.at)}</p>
                    </Link>
                  ) : (
                    <div className="px-4 py-2.5">
                      <p className="text-[13px] text-ink-700">{a.message}</p>
                      <p className="mt-0.5 text-[11px] text-ink-400">{relativeTime(a.at)}</p>
                    </div>
                  )}
                </li>
              ))}
              {activities.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-500">No activity yet.</li>}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function StorageNotice() {
  const status = useStore((s) => s.persistStatus);
  const recovered = useStore((s) => s.restoredFromCorrupt);
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || (status === 'ok' && !recovered)) return null;
  const msg =
    status === 'unavailable'
      ? 'Browser storage is unavailable (private mode or blocked). The demo works, but changes will be lost on refresh.'
      : status === 'quota'
        ? 'Browser storage is full. Recent changes may not survive a refresh — reset the demo to free space.'
        : 'Saved demo data was outdated or unreadable, so the original sample dataset was loaded.';
  return (
    <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[13px] text-amber-900 no-print" role="status">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">{msg}</p>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss" className="rounded p-0.5 hover:bg-amber-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const setActive = useStore((s) => s.setActiveIndustry);
  const active = useStore((s) => s.activeIndustry);
  const currency = useStore((s) => s.settings.global.currency);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Module routes imply an industry — keep the switcher in sync with deep links.
  useEffect(() => {
    const match = Object.entries(MODULE_INDUSTRY).find(([p]) => pathname.startsWith(p));
    if (match && match[1] !== active) setActive(match[1]);
  }, [pathname, active, setActive]);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        window.localStorage.setItem('billora:ui:sidebar', c ? 'expanded' : 'collapsed');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const cfg = INDUSTRY_CONFIG[active];

  return (
    <div className="min-h-screen bg-ink-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-pop">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-ink-200 bg-white transition-[width] duration-200 lg:flex no-print',
          collapsed ? 'w-[72px]' : 'w-[248px]',
        )}
      >
        <div className={cn('flex h-16 items-center border-b border-ink-100', collapsed ? 'justify-center' : 'px-5')}>
          <Logo collapsed={collapsed} />
        </div>
        <SidebarNav collapsed={collapsed} />
        <div className="space-y-2 border-t border-ink-100 p-3">
          {!collapsed && (
            <div className={cn('rounded-lg p-3', cfg.accent.soft)}>
              <p className={cn('text-xs font-semibold', cfg.accent.text)}>Presenting {cfg.short}</p>
              <p className="mt-0.5 text-xs text-ink-600">Follow the guided steps to show a full workflow.</p>
              <Button size="xs" variant="secondary" className="mt-2" icon={<Compass className="h-3.5 w-3.5" />} onClick={() => setGuideOpen(true)}>
                Open demo guide
              </Button>
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-500 hover:bg-ink-100 hover:text-ink-800', collapsed && 'justify-center')}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="relative flex h-full w-72 animate-slide-up flex-col bg-white shadow-pop">
            <div className="flex h-16 items-center justify-between border-b border-ink-100 px-5">
              <Logo />
              <IconButton label="Close menu" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </IconButton>
            </div>
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-ink-100 p-3">
              <ResetDemoButton />
            </div>
          </aside>
        </div>
      )}

      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-[248px]')}>
        <div className="flex items-center justify-center gap-2 bg-ink-900 px-4 py-1.5 text-center text-xs text-ink-100 no-print">
          <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
          <span>
            <strong className="font-semibold text-white">Demo Mode</strong>
            <span className="hidden sm:inline"> — fictional sample data. Payments and messages are simulated; nothing is charged or sent.</span>
          </span>
        </div>
        <StorageNotice />
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/95 px-4 backdrop-blur sm:px-6 no-print">
          <IconButton label="Open menu" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </IconButton>
          <div className="lg:hidden">
            <Logo collapsed />
          </div>
          <IndustrySwitcher />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" icon={<Compass className="h-4 w-4" />} onClick={() => setGuideOpen(true)} className="hidden sm:inline-flex">
              Demo guide
            </Button>
            <IconButton label="Demo guide" className="h-9 w-9 sm:hidden" onClick={() => setGuideOpen(true)}>
              <Compass className="h-[18px] w-[18px]" />
            </IconButton>
            <Notifications />
            <ResetDemoButton className="hidden md:inline-flex" label="Reset demo" />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8" key={currency}>
          <Outlet />
        </main>
      </div>
      <DemoGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: { label: string; to?: string }[];
}) {
  const crumbs = useMemo(() => breadcrumbs ?? [], [breadcrumbs]);
  return (
    <div className="mb-6">
      {crumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-500">
            {crumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {c.to ? (
                  <Link to={c.to} className="hover:text-ink-800">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-ink-700">
                    {c.label}
                  </span>
                )}
                {i < crumbs.length - 1 && <ChevronRight className="h-3 w-3" aria-hidden />}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
