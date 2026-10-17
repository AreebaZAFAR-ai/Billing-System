import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Card({ className, children, as: As = 'section' }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' }) {
  return <As className={cn('min-w-0 rounded-xl border border-ink-200/80 bg-white shadow-card', className)}>{children}</As>;
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  change,
  tone = 'default',
  hint,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  change?: number | null;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  hint?: string;
}) {
  const toneCls = {
    default: 'bg-brand-50 text-brand-700',
    success: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
  }[tone];
  return (
    <Card className="p-4 sm:p-5" as="div">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-500" title={hint}>
          {label}
        </p>
        {Icon && (
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', toneCls)}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-ink-900 tabular-nums sm:text-2xl">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
        {change !== undefined && change !== null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              change >= 0 ? 'text-emerald-700' : 'text-red-700',
            )}
          >
            {change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
            {Math.abs(change).toFixed(1)}%
            <span className="sr-only">{change >= 0 ? 'increase' : 'decrease'} vs previous period</span>
          </span>
        )}
        {sub}
      </div>
    </Card>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Badge({
  tone = 'neutral',
  children,
  className,
  dot,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'violet';
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  const cls = {
    neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
    success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    warning: 'bg-amber-50 text-amber-800 ring-amber-200',
    danger: 'bg-red-50 text-red-700 ring-red-200',
    info: 'bg-sky-50 text-sky-800 ring-sky-200',
    brand: 'bg-brand-50 text-brand-800 ring-brand-200',
    violet: 'bg-violet-50 text-violet-800 ring-violet-200',
  }[tone];
  const dotCls = {
    neutral: 'bg-ink-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-sky-500',
    brand: 'bg-brand-500',
    violet: 'bg-violet-500',
  }[tone];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', cls, className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotCls)} aria-hidden />}
      {children}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const palette = ['bg-brand-100 text-brand-800', 'bg-sky-100 text-sky-800', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800', 'bg-violet-100 text-violet-800', 'bg-emerald-100 text-emerald-800'];
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
  const ini = name
    .replace(/^Dr\.\s*/, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  return (
    <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold', palette[idx], className)} aria-hidden>
      {ini}
    </span>
  );
}

export function SampleTag({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded border border-dashed border-amber-300 bg-amber-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800', className)}>
      Sample data
    </span>
  );
}
