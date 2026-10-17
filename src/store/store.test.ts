import { beforeEach, describe, expect, it } from 'vitest';
import { computeTotals, invoiceStatus, outstanding } from '@/lib/billing';
import { dailySeries, paymentMethods, summarize } from '@/lib/analytics';
import { rangeFromPreset } from '@/lib/dates';
import { INDUSTRIES } from '@/lib/types';
import { catalogToLine } from '@/components/invoice/InvoiceComposer';
import { useStore } from './store';

const s = () => useStore.getState();

beforeEach(() => s().resetDemo());

describe('seeded demo data', () => {
  it('stores totals that match the billing engine and never over-collects', () => {
    for (const i of INDUSTRIES) {
      const { invoices } = s().data[i];
      expect(invoices.length).toBeGreaterThan(100);
      const numbers = new Set<string>();
      for (const inv of invoices) {
        const t = computeTotals({ items: inv.items, discount: inv.discount, taxRate: inv.taxRate });
        expect(inv.total).toBe(t.total);
        expect(inv.subtotal).toBe(t.subtotal);
        expect(outstanding(inv)).toBeGreaterThanOrEqual(0);
        expect(inv.payments.reduce((a, p) => a + p.amount, 0)).toBeLessThanOrEqual(inv.total);
        expect(numbers.has(inv.number)).toBe(false);
        numbers.add(inv.number);
      }
      expect(s().data[i].catalog.every((c) => !c.trackStock || (c.stock ?? 0) >= 0)).toBe(true);
    }
  });

  it('reports agree with each other', () => {
    const range = rangeFromPreset('30d');
    for (const i of INDUSTRIES) {
      const inv = s().data[i].invoices;
      const sum = summarize(inv, range);
      const days = dailySeries(inv, range);
      expect(days.reduce((a, d) => a + d.billed, 0)).toBe(sum.billed);
      expect(days.reduce((a, d) => a + d.collected, 0)).toBe(sum.collected);
      expect(days.reduce((a, d) => a + d.count, 0)).toBe(sum.invoiceCount);
      expect(paymentMethods(inv, range).reduce((a, m) => a + m.amount, 0)).toBe(sum.collected);
      expect(Object.values(sum.status).reduce((a, n) => a + n, 0)).toBe(sum.invoiceCount);
    }
  });
});

describe('grocery checkout', () => {
  it('creates a paid sale, deducts stock and blocks duplicate submission', () => {
    const product = s().data.grocery.catalog.find((c) => (c.stock ?? 0) > 5)!;
    const before = product.stock!;
    const count = s().data.grocery.invoices.length;
    const draft = {
      items: [{ ...catalogToLine(product), quantity: 3 }],
      discount: { type: 'percent' as const, value: 5 },
      taxRate: 18,
      taxEnabled: true,
      idempotencyKey: 'sale-1',
    };
    const total = computeTotals(draft).total;
    const res = s().createInvoice('grocery', { ...draft, payment: { amount: total, method: 'cash', tendered: total + 50000 } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(invoiceStatus(res.value)).toBe('paid');
    expect(res.value.payments[0].change).toBe(50000);
    expect(s().data.grocery.catalog.find((c) => c.id === product.id)!.stock).toBe(before - 3);
    expect(s().data.grocery.invoices.length).toBe(count + 1);
    const dup = s().createInvoice('grocery', { ...draft, payment: { amount: total, method: 'cash' } });
    expect(dup.ok).toBe(false);
    expect(s().data.grocery.invoices.length).toBe(count + 1);
  });

  it('rejects insufficient stock and short cash', () => {
    const product = s().data.grocery.catalog[0];
    const tooMany = s().createInvoice('grocery', {
      items: [{ ...catalogToLine(product), quantity: (product.stock ?? 0) + 1 }],
      discount: { type: 'percent', value: 0 },
      taxRate: 0,
      taxEnabled: false,
    });
    expect(tooMany.ok).toBe(false);
    const short = s().createInvoice('grocery', {
      items: [catalogToLine(product)],
      discount: { type: 'percent', value: 0 },
      taxRate: 0,
      taxEnabled: false,
      payment: { amount: product.price, method: 'cash', tendered: product.price - 100 },
    });
    expect(short.ok).toBe(false);
  });
});

describe('partial payments', () => {
  it('tracks the balance through part and final payment and rejects overpayment', () => {
    const svc = s().data.clinic.catalog[0];
    const patient = s().data.clinic.customers[0];
    const res = s().createInvoice('clinic', {
      customerId: patient.id,
      items: [catalogToLine(svc)],
      discount: { type: 'percent', value: 0 },
      taxRate: 0,
      taxEnabled: false,
      payment: { amount: 50000, method: 'cash' },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(invoiceStatus(res.value)).toBe('partial');
    expect(outstanding(res.value)).toBe(svc.price - 50000);
    expect(s().recordPayment('clinic', res.value.id, { amount: svc.price, method: 'card' }).ok).toBe(false);
    const done = s().recordPayment('clinic', res.value.id, { amount: svc.price - 50000, method: 'card' });
    expect(done.ok).toBe(true);
    if (done.ok) expect(invoiceStatus(done.value)).toBe('paid');
  });
});

describe('hospital discharge', () => {
  it('bills room days plus posted charges', () => {
    const h = s().data.hospital;
    const patient = h.customers.find((c) => !h.admissions.some((a) => a.patientId === c.id && a.status === 'admitted'))!;
    const adm = s().admitPatient({ patientId: patient.id, departmentId: 'dep_gm', doctorId: 'dr_h1', roomType: 'Private Room', roomRate: 2000000 });
    const lab = h.catalog.find((c) => c.category === 'Laboratory')!;
    s().addAdmissionCharge(adm.id, catalogToLine(lab));
    const res = s().dischargeAdmission(adm.id, { extraItems: [], discount: { type: 'fixed', value: 0 } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.subtotal).toBe(2000000 + lab.price);
    expect(s().data.hospital.admissions.find((a) => a.id === adm.id)!.status).toBe('discharged');
  });
});

describe('reset', () => {
  it('restores the original dataset', () => {
    const before = s().data.grocery.invoices.length;
    const p = s().data.grocery.catalog[0];
    s().createInvoice('grocery', { items: [catalogToLine(p)], discount: { type: 'percent', value: 0 }, taxRate: 0, taxEnabled: false });
    expect(s().data.grocery.invoices.length).toBe(before + 1);
    s().resetDemo();
    expect(s().data.grocery.invoices.length).toBe(before);
  });
});
