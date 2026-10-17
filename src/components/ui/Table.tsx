import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, children, align = 'left', ...rest }: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap border-b border-ink-200 bg-ink-50/70 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-ink-500',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

export function SortTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align,
  className,
}: {
  label: string;
  sortKey: K;
  sort: { key: K; dir: 'asc' | 'desc' };
  onSort: (k: K) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <Th align={align} className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn('inline-flex items-center gap-1 uppercase hover:text-ink-800', align === 'right' && 'flex-row-reverse')}
      >
        {label}
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </button>
    </Th>
  );
}

export function Td({ className, children, align = 'left', ...rest }: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'border-b border-ink-100 px-4 py-3 align-middle text-ink-700',
        align === 'right' ? 'text-right tabular-nums' : align === 'center' ? 'text-center' : 'text-left',
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-ink-500" aria-label="Pagination">
      <span>
        Showing <span className="font-medium text-ink-800">{from.toLocaleString()}</span>–
        <span className="font-medium text-ink-800">{to.toLocaleString()}</span> of{' '}
        <span className="font-medium text-ink-800">{total.toLocaleString()}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white hover:bg-ink-50 disabled:opacity-40"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 tabular-nums">
          {page} / {pages}
        </span>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white hover:bg-ink-50 disabled:opacity-40"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-ink-200', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            '-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            value === t.value ? 'border-brand-600 text-brand-800' : 'border-transparent text-ink-500 hover:text-ink-800',
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', value === t.value ? 'bg-brand-100 text-brand-800' : 'bg-ink-100 text-ink-600')}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
