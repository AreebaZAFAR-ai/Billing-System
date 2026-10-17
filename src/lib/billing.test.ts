import { describe, expect, it } from 'vitest';
import {
  computeTotals,
  formatInvoiceNumber,
  invoiceStatus,
  lineCommission,
  outstanding,
  validateDiscount,
  validateLines,
  validatePayment,
} from './billing';
import { percentOf, toMinor } from './money';
import type { Invoice, LineItem } from './types';

const line = (quantity: number, unitPrice: number, extra: Partial<LineItem> = {}): LineItem => ({
  id: Math.random().toString(36),
  kind: 'product',
  description: 'Item',
  quantity,
  unitPrice,
  ...extra,
});

function invoice(partial: Partial<Invoice>): Invoice {
  const items = partial.items ?? [line(1, 100000)];
  const t = computeTotals({ items, discount: partial.discount ?? { type: 'percent', value: 0 }, taxRate: partial.taxRate ?? 0 });
  return {
    id: 'i1',
    number: 'T-1',
    industry: 'clinic',
    businessId: 'clinic',
    customerName: 'Test',
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    items,
    discount: { type: 'percent', value: 0 },
    taxRate: 0,
    taxLabel: 'Tax',
    payments: [],
    simulated: true,
    ...t,
    ...partial,
  } as Invoice;
}

describe('money', () => {
  it('parses major-unit input to integer minor units', () => {
    expect(toMinor('1,250.50')).toBe(125050);
    expect(toMinor('0.1')).toBe(10);
    expect(toMinor('  99 ')).toBe(9900);
    expect(toMinor('1.234')).toBeNaN();
    expect(toMinor('abc')).toBeNaN();
    expect(toMinor('')).toBeNaN();
  });
  it('rounds percentages half away from zero without float drift', () => {
    expect(percentOf(1005, 50)).toBe(503);
    expect(percentOf(33333, 18)).toBe(6000);
    expect(percentOf(10, 12.5)).toBe(1);
  });
});

describe('computeTotals', () => {
  it('sums line totals', () => {
    const t = computeTotals({ items: [line(2, 24500), line(3, 6000)], discount: { type: 'percent', value: 0 }, taxRate: 0 });
    expect(t.subtotal).toBe(67000);
    expect(t.total).toBe(67000);
  });
  it('applies percent discount then tax on the discounted amount', () => {
    const t = computeTotals({ items: [line(1, 100000)], discount: { type: 'percent', value: 10 }, taxRate: 18 });
    expect(t.discountAmount).toBe(10000);
    expect(t.taxAmount).toBe(16200);
    expect(t.total).toBe(106200);
  });
  it('clamps fixed discounts to the subtotal', () => {
    const t = computeTotals({ items: [line(1, 5000)], discount: { type: 'fixed', value: 99999 }, taxRate: 0 });
    expect(t.discountAmount).toBe(5000);
    expect(t.total).toBe(0);
  });
  it('ignores tax when disabled', () => {
    const t = computeTotals({ items: [line(1, 10000)], discount: { type: 'percent', value: 0 }, taxRate: 18, taxEnabled: false });
    expect(t.taxAmount).toBe(0);
  });
  it('keeps every intermediate value an integer', () => {
    const t = computeTotals({ items: [line(3, 3300), line(7, 1900)], discount: { type: 'percent', value: 7.5 }, taxRate: 16 });
    for (const v of Object.values(t)) expect(Number.isInteger(v)).toBe(true);
    expect(t.discountAmount % 100).toBe(0);
    expect(t.taxAmount % 100).toBe(0);
    expect(t.total).toBe(t.subtotal - t.discountAmount + t.taxAmount);
  });
});

describe('validation', () => {
  it('rejects empty, zero, negative and fractional quantities', () => {
    expect(validateLines([]).ok).toBe(false);
    expect(validateLines([line(0, 100)]).ok).toBe(false);
    expect(validateLines([line(-1, 100)]).ok).toBe(false);
    expect(validateLines([line(1.5, 100)]).ok).toBe(false);
    expect(validateLines([line(2, 100)]).ok).toBe(true);
  });
  it('rejects invalid discounts', () => {
    expect(validateDiscount({ type: 'percent', value: 101 }, 1000)).not.toBeNull();
    expect(validateDiscount({ type: 'fixed', value: 2000 }, 1000)).not.toBeNull();
    expect(validateDiscount({ type: 'percent', value: -1 }, 1000)).not.toBeNull();
    expect(validateDiscount({ type: 'percent', value: 10 }, 1000)).toBeNull();
  });
  it('rejects zero, negative and over-balance payments', () => {
    expect(validatePayment(10000, 0)).not.toBeNull();
    expect(validatePayment(10000, -5)).not.toBeNull();
    expect(validatePayment(10000, 10001)).not.toBeNull();
    expect(validatePayment(10000, NaN)).not.toBeNull();
    expect(validatePayment(10000, 10000)).toBeNull();
  });
});

describe('invoice status', () => {
  it('derives paid, partial, unpaid and overdue', () => {
    const base = invoice({});
    expect(invoiceStatus(base)).toBe('unpaid');
    const partial = invoice({ payments: [{ id: 'p', amount: 40000, method: 'cash', date: new Date().toISOString() }] });
    expect(invoiceStatus(partial)).toBe('partial');
    expect(outstanding(partial)).toBe(60000);
    const paid = invoice({ payments: [{ id: 'p', amount: 100000, method: 'card', date: new Date().toISOString() }] });
    expect(invoiceStatus(paid)).toBe('paid');
    const overdue = invoice({ dueDate: new Date(Date.now() - 3 * 86400000).toISOString(), payments: partial.payments });
    expect(invoiceStatus(overdue)).toBe('overdue');
  });
});

describe('commission', () => {
  it('supports gross and net (discount-shared) bases', () => {
    const items = [line(1, 100000, { kind: 'service', staffId: 's1', commissionRate: 10 }), line(1, 100000, { kind: 'service' })];
    const inv = invoice({ items, discount: { type: 'fixed', value: 20000 } });
    expect(lineCommission(inv, items[0], 'gross')).toBe(10000);
    expect(lineCommission(inv, items[0], 'net')).toBe(9000);
    expect(lineCommission(inv, items[1], 'gross')).toBe(0);
  });
});

describe('invoice numbers', () => {
  it('formats prefix, year-month and zero-padded sequence', () => {
    expect(formatInvoiceNumber('CLN', 42, new Date(2026, 9, 5))).toBe('CLN-2610-00042');
  });
});
