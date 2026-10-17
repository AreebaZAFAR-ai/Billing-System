import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { formatMoney, formatMoneyCompact } from '@/lib/money';
import { formatMonth, formatShortDate, fromDateKey } from '@/lib/dates';
import type { DayPoint } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/** Validated categorical order (see dataviz reference palette). */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const GRID = '#e8ebee';
const AXIS = '#6b7580';

function MoneyTooltip({ active, payload, label, labelFormat }: TooltipProps<number, string> & { labelFormat: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-medium text-ink-900">{labelFormat(String(label))}</p>
      {payload.map((p) => (
        <div key={p.dataKey as string} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-600">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
            {p.name}
          </span>
          <span className="font-medium tabular-nums text-ink-900">{p.dataKey === 'count' ? p.value : formatMoney(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; value?: string }[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-600', className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
          {i.value && <span className="font-medium tabular-nums text-ink-900">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

export function RevenueTrend({ data, monthly, height = 260 }: { data: DayPoint[]; monthly?: boolean; height?: number }) {
  const fmtLabel = (k: string) => (monthly ? formatMonth(k) : formatShortDate(fromDateKey(k)));
  const dense = data.length > 45;
  return (
    <div style={{ height }} role="img" aria-label="Billed revenue and collected payments over time">
      <ResponsiveContainer width="100%" height="100%">
        {monthly || data.length <= 14 ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="key" tickFormatter={fmtLabel} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis tickFormatter={(v) => formatMoneyCompact(v)} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={64} />
            <Tooltip cursor={{ fill: 'rgba(16,24,40,0.04)' }} content={<MoneyTooltip labelFormat={fmtLabel} />} />
            <Bar dataKey="billed" name="Billed" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="collected" name="Collected" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="billedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.18} />
                <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="key"
              tickFormatter={fmtLabel}
              tick={{ fontSize: 11, fill: AXIS }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              interval={dense ? Math.ceil(data.length / 8) : 'preserveStartEnd'}
              minTickGap={16}
            />
            <YAxis tickFormatter={(v) => formatMoneyCompact(v)} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={64} />
            <Tooltip cursor={{ stroke: AXIS, strokeDasharray: '3 3' }} content={<MoneyTooltip labelFormat={fmtLabel} />} />
            <Area type="monotone" dataKey="billed" name="Billed" stroke={SERIES[0]} strokeWidth={2} fill="url(#billedFill)" activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
            <Area type="monotone" dataKey="collected" name="Collected" stroke={SERIES[1]} strokeWidth={2} strokeDasharray="5 4" fill="none" activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function CountBars({ data, height = 200 }: { data: DayPoint[]; height?: number }) {
  const fmtLabel = (k: string) => formatShortDate(fromDateKey(k));
  return (
    <div style={{ height }} role="img" aria-label="Invoices per day">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="key" tickFormatter={fmtLabel} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={32} />
          <Tooltip cursor={{ fill: 'rgba(16,24,40,0.04)' }} content={<MoneyTooltip labelFormat={fmtLabel} />} />
          <Bar dataKey="count" name="Invoices" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface Slice {
  label: string;
  value: number;
  color: string;
  display?: string;
}

export function Donut({ slices, centerLabel, centerValue, height = 180 }: { slices: Slice[]; centerLabel: string; centerValue: string; height?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative shrink-0" style={{ height, width: height }} role="img" aria-label={`${centerLabel}: ${slices.map((s) => `${s.label} ${s.display ?? s.value}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius="66%" outerRadius="100%" paddingAngle={slices.length > 1 ? 2 : 0} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
              {slices.map((s) => (
                <Cell key={s.label} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs shadow-pop">
                    <p className="font-medium text-ink-900">{payload[0].name}</p>
                    <p className="tabular-nums text-ink-600">
                      {(payload[0].payload as Slice).display ?? payload[0].value} · {total ? Math.round((Number(payload[0].value) / total) * 100) : 0}%
                    </p>
                  </div>
                ) : null
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-ink-500">{centerLabel}</span>
          <span className="text-sm font-semibold tabular-nums text-ink-900">{centerValue}</span>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex min-w-0 items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 truncate text-ink-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              {s.label}
            </span>
            <span className="shrink-0 whitespace-nowrap tabular-nums text-ink-900">
              {s.display ?? s.value}
              <span className="ml-2 text-xs text-ink-400">{total ? Math.round((s.value / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal magnitude bars (single hue) with direct value labels. */
export function BarList({ rows, color = SERIES[0], format = formatMoney }: { rows: { label: string; value: number; sub?: string }[]; color?: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-700" title={r.label}>
              {r.label}
              {r.sub && <span className="ml-1.5 text-xs text-ink-400">{r.sub}</span>}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-ink-900">{format(r.value)}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-ink-100">
            <div className="h-1.5 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
