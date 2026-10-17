/**
 * Reporting derived ONLY from stored invoices/payments, so every card, chart and table agrees.
 * - Billed revenue: invoice totals by invoice date
 * - Collected: payments by payment date
 * - Outstanding: unpaid balance of invoices in scope
 * - Estimated gross profit: net sales (ex-tax) − estimated item cost − calculated commission
 */
import {
  amountPaid,
  estimatedCost,
  invoiceCommission,
  invoiceStatus,
  lineCommission,
  lineTotal,
  netSales,
  outstanding,
} from './billing';
import { daysBetween, eachDay, inRange, toDateKey, toMonthKey } from './dates';
import type {
  CommissionPayout,
  Department,
  Invoice,
  InvoiceStatus,
  Money,
  PaymentMethod,
  Staff,
} from './types';

export interface Range {
  from: string;
  to: string;
}

export const inScope = (invoices: Invoice[], range: Range) => invoices.filter((i) => inRange(i.createdAt, range));

export interface Summary {
  billed: Money;
  collected: Money;
  outstanding: Money;
  overdueAmount: Money;
  invoiceCount: number;
  avgInvoice: Money;
  netSales: Money;
  tax: Money;
  discounts: Money;
  estCost: Money;
  commission: Money;
  estProfit: Money;
  status: Record<InvoiceStatus, number>;
}

export function summarize(all: Invoice[], range: Range, basis: 'gross' | 'net' = 'gross', now = new Date()): Summary {
  const scoped = inScope(all, range);
  const status: Record<InvoiceStatus, number> = { paid: 0, partial: 0, unpaid: 0, overdue: 0 };
  let billed = 0;
  let out = 0;
  let overdueAmount = 0;
  let ns = 0;
  let tax = 0;
  let discounts = 0;
  let cost = 0;
  let commission = 0;
  for (const inv of scoped) {
    billed += inv.total;
    const bal = outstanding(inv);
    out += bal;
    const st = invoiceStatus(inv, now);
    status[st]++;
    if (st === 'overdue') overdueAmount += bal;
    ns += netSales(inv);
    tax += inv.taxAmount;
    discounts += inv.discountAmount;
    cost += estimatedCost(inv);
    commission += invoiceCommission(inv, basis);
  }
  let collected = 0;
  for (const inv of all) for (const p of inv.payments) if (inRange(p.date, range)) collected += p.amount;
  return {
    billed,
    collected,
    outstanding: out,
    overdueAmount,
    invoiceCount: scoped.length,
    avgInvoice: scoped.length ? Math.round(billed / scoped.length) : 0,
    netSales: ns,
    tax,
    discounts,
    estCost: cost,
    commission,
    estProfit: ns - cost - commission,
    status,
  };
}

export interface DayPoint {
  key: string;
  billed: Money;
  collected: Money;
  count: number;
}

export function dailySeries(all: Invoice[], range: Range): DayPoint[] {
  const map = new Map<string, DayPoint>(eachDay(range).map((k) => [k, { key: k, billed: 0, collected: 0, count: 0 }]));
  for (const inv of all) {
    const k = toDateKey(inv.createdAt);
    const p = map.get(k);
    if (p) {
      p.billed += inv.total;
      p.count++;
    }
    for (const pay of inv.payments) {
      const pk = map.get(toDateKey(pay.date));
      if (pk) pk.collected += pay.amount;
    }
  }
  return [...map.values()];
}

export function monthlySeries(all: Invoice[], range: Range): DayPoint[] {
  const map = new Map<string, DayPoint>();
  for (const day of eachDay(range)) {
    const k = day.slice(0, 7);
    if (!map.has(k)) map.set(k, { key: k, billed: 0, collected: 0, count: 0 });
  }
  for (const inv of all) {
    if (inRange(inv.createdAt, range)) {
      const p = map.get(toMonthKey(inv.createdAt))!;
      p.billed += inv.total;
      p.count++;
    }
    for (const pay of inv.payments) {
      if (inRange(pay.date, range)) map.get(toMonthKey(pay.date))!.collected += pay.amount;
    }
  }
  return [...map.values()];
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank: 'Bank transfer',
  wallet: 'Mobile wallet',
};

export function paymentMethods(all: Invoice[], range: Range) {
  const totals: Record<PaymentMethod, { amount: Money; count: number }> = {
    cash: { amount: 0, count: 0 },
    card: { amount: 0, count: 0 },
    bank: { amount: 0, count: 0 },
    wallet: { amount: 0, count: 0 },
  };
  for (const inv of all)
    for (const p of inv.payments)
      if (inRange(p.date, range)) {
        totals[p.method].amount += p.amount;
        totals[p.method].count++;
      }
  return (Object.keys(totals) as PaymentMethod[])
    .map((m) => ({ method: m, label: METHOD_LABEL[m], ...totals[m] }))
    .filter((x) => x.count > 0);
}

export interface ItemStat {
  key: string;
  name: string;
  category: string;
  quantity: number;
  revenue: Money;
  invoices: number;
}

export function topItems(
  all: Invoice[],
  range: Range,
  filter: (kind: string) => boolean = () => true,
  limit = 10,
): ItemStat[] {
  const map = new Map<string, ItemStat>();
  for (const inv of inScope(all, range)) {
    const seen = new Set<string>();
    for (const l of inv.items) {
      if (!filter(l.kind)) continue;
      const key = l.refId ?? l.description;
      const s = map.get(key) ?? { key, name: l.description, category: l.category ?? '—', quantity: 0, revenue: 0, invoices: 0 };
      s.quantity += l.quantity;
      s.revenue += lineTotal(l);
      if (!seen.has(key)) {
        s.invoices++;
        seen.add(key);
      }
      map.set(key, s);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export function categoryBreakdown(all: Invoice[], range: Range) {
  const map = new Map<string, Money>();
  for (const inv of inScope(all, range))
    for (const l of inv.items) map.set(l.category ?? 'Other', (map.get(l.category ?? 'Other') ?? 0) + lineTotal(l));
  return [...map.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue);
}

/** Department revenue by line item department (gross line totals, before invoice-level discount). */
export function departmentBreakdown(all: Invoice[], range: Range, departments: Department[]) {
  const map = new Map<string, { gross: Money; lines: number; invoices: Set<string> }>();
  for (const inv of inScope(all, range))
    for (const l of inv.items) {
      const dep = l.departmentId ?? inv.meta?.departmentId ?? 'other';
      const s = map.get(dep) ?? { gross: 0, lines: 0, invoices: new Set<string>() };
      s.gross += lineTotal(l);
      s.lines++;
      s.invoices.add(inv.id);
      map.set(dep, s);
    }
  return departments
    .map((d) => ({ id: d.id, name: d.name, code: d.code, gross: map.get(d.id)?.gross ?? 0, invoices: map.get(d.id)?.invoices.size ?? 0 }))
    .sort((a, b) => b.gross - a.gross);
}

export function staffPerformance(
  all: Invoice[],
  range: Range,
  staff: Staff[],
  payouts: CommissionPayout[],
  basis: 'gross' | 'net',
) {
  return staff
    .filter((s) => s.commissionRate !== undefined)
    .map((s) => {
      let revenue = 0;
      let services = 0;
      let commission = 0;
      let lifetimeCommission = 0;
      for (const inv of all) {
        const scoped = inRange(inv.createdAt, range);
        for (const l of inv.items) {
          if (l.staffId !== s.id) continue;
          const c = lineCommission(inv, l, basis);
          lifetimeCommission += c;
          if (scoped) {
            revenue += lineTotal(l);
            services += l.quantity;
            commission += c;
          }
        }
      }
      const paid = payouts.filter((p) => p.staffId === s.id).reduce((a, p) => a + p.amount, 0);
      return {
        staff: s,
        revenue,
        services,
        commission,
        lifetimeCommission,
        paid,
        payable: Math.max(0, lifetimeCommission - paid),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export function doctorBreakdown(all: Invoice[], range: Range, staff: Staff[]) {
  return staff
    .filter((s) => s.role === 'Doctor' || s.role === 'Consultant' || s.role === 'Medical Officer')
    .map((s) => {
      const invs = inScope(all, range).filter((i) => i.meta?.doctorId === s.id);
      return { staff: s, invoices: invs.length, billed: invs.reduce((a, i) => a + i.total, 0) };
    })
    .sort((a, b) => b.billed - a.billed);
}

export function agingBuckets(all: Invoice[], now = new Date()) {
  const buckets = [
    { label: 'Not yet due', amount: 0, count: 0 },
    { label: '1–15 days overdue', amount: 0, count: 0 },
    { label: '16–30 days overdue', amount: 0, count: 0 },
    { label: '30+ days overdue', amount: 0, count: 0 },
  ];
  for (const inv of all) {
    const bal = outstanding(inv);
    if (bal <= 0) continue;
    const late = daysBetween(inv.dueDate, now);
    const idx = late <= 0 ? 0 : late <= 15 ? 1 : late <= 30 ? 2 : 3;
    buckets[idx].amount += bal;
    buckets[idx].count++;
  }
  return buckets;
}

export function customerBalance(all: Invoice[], customerId: string) {
  const invs = all.filter((i) => i.customerId === customerId);
  return {
    invoices: invs,
    billed: invs.reduce((a, i) => a + i.total, 0),
    paid: invs.reduce((a, i) => a + amountPaid(i), 0),
    outstanding: invs.reduce((a, i) => a + outstanding(i), 0),
    lastVisit: invs.reduce<string | undefined>((a, i) => (!a || i.createdAt > a ? i.createdAt : a), undefined),
  };
}

export function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}
