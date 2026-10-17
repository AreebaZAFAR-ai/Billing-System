import { create } from 'zustand';
import {
  amountPaid,
  computeTotals,
  formatInvoiceNumber,
  outstanding,
  validateDiscount,
  validateLines,
  validatePayment,
} from '@/lib/billing';
import { addDays, daysBetween } from '@/lib/dates';
import { configureMoney, formatMoney, percentOf } from '@/lib/money';
import type {
  Activity,
  ActivityType,
  Admission,
  Appointment,
  AppointmentStatus,
  BusinessProfile,
  CatalogItem,
  Customer,
  Discount,
  GlobalSettings,
  Industry,
  IndustryData,
  Invoice,
  InvoiceMeta,
  LineItem,
  Payment,
  PaymentMethod,
  Settings,
  Staff,
} from '@/lib/types';
import { INDUSTRIES } from '@/lib/types';
import { uid } from '@/lib/utils';
import { defaultSettings, seedAll, seedIndustry } from '@/data/seed';
import {
  SCHEMA_VERSION,
  clearPersisted,
  loadPersisted,
  saveIndustry,
  saveMeta,
  storageAvailable,
  type WriteResult,
} from './persistence';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface PaymentInput {
  amount: number;
  method: PaymentMethod;
  reference?: string;
  tendered?: number;
  note?: string;
}

export interface InvoiceDraft {
  customerId?: string;
  customerName?: string;
  items: LineItem[];
  discount: Discount;
  taxRate: number;
  taxEnabled: boolean;
  notes?: string;
  meta?: InvoiceMeta;
  dueDays?: number;
  payment?: PaymentInput;
  /** Prevents a double-submitted checkout from creating two invoices. */
  idempotencyKey?: string;
}

export type PersistStatus = 'ok' | 'unavailable' | 'quota';

interface State {
  ready: boolean;
  seededAt: string;
  activeIndustry: Industry;
  settings: Settings;
  data: Record<Industry, IndustryData>;
  persistStatus: PersistStatus;
  restoredFromCorrupt: boolean;

  setActiveIndustry: (i: Industry) => void;
  updateGlobal: (patch: Partial<GlobalSettings>) => void;
  updateBusiness: (i: Industry, patch: Partial<BusinessProfile>) => void;

  createInvoice: (i: Industry, draft: InvoiceDraft) => Result<Invoice>;
  recordPayment: (i: Industry, invoiceId: string, p: PaymentInput) => Result<Invoice>;

  addCustomer: (i: Industry, c: Omit<Customer, 'id' | 'code' | 'createdAt' | 'industry'>) => Customer;
  updateCustomer: (i: Industry, id: string, patch: Partial<Customer>) => void;

  upsertCatalogItem: (i: Industry, item: CatalogItem) => void;
  adjustStock: (i: Industry, itemId: string, delta: number, reason: string) => Result<CatalogItem>;

  updateStaff: (i: Industry, id: string, patch: Partial<Staff>) => void;

  addAppointment: (i: Industry, a: Omit<Appointment, 'id' | 'industry'>) => Appointment;
  setAppointmentStatus: (i: Industry, id: string, status: AppointmentStatus) => void;

  admitPatient: (a: Pick<Admission, 'patientId' | 'departmentId' | 'doctorId' | 'roomType' | 'roomRate'>) => Admission;
  addAdmissionCharge: (admissionId: string, item: LineItem) => void;
  removeAdmissionCharge: (admissionId: string, lineId: string) => void;
  dischargeAdmission: (
    admissionId: string,
    opts: { extraItems: LineItem[]; discount: Discount; payment?: PaymentInput; notes?: string },
  ) => Result<Invoice>;

  recordPayout: (staffId: string, amount: number, note?: string) => Result<void>;

  resetDemo: () => void;
  resetIndustry: (i: Industry) => void;
}

const usedKeys = new Set<string>();

function activity(type: ActivityType, message: string, link?: string): Activity {
  return { id: uid('act'), type, message, at: new Date().toISOString(), link };
}

function pushActivity(d: IndustryData, a: Activity): Activity[] {
  return [a, ...d.activities].slice(0, 60);
}

function nextInvoiceNumber(d: IndustryData, prefix: string, now: Date): { seq: number; number: string } {
  const existing = new Set(d.invoices.map((x) => x.number));
  let seq = d.invoiceSeq + 1;
  let number = formatInvoiceNumber(prefix, seq, now);
  while (existing.has(number)) {
    seq += 1;
    number = formatInvoiceNumber(prefix, seq, now);
  }
  return { seq, number };
}

function buildPayment(p: PaymentInput, total: number, at: Date): Payment {
  const change = p.method === 'cash' && p.tendered !== undefined ? p.tendered - p.amount : undefined;
  return {
    id: uid('pay'),
    amount: p.amount,
    method: p.method,
    date: at.toISOString(),
    reference: p.reference?.trim() || undefined,
    tendered: p.method === 'cash' ? p.tendered : undefined,
    change: change !== undefined && change >= 0 ? change : undefined,
    note: p.note?.trim() || (p.amount < total ? 'Part payment' : undefined),
  };
}

function initial() {
  const persisted = loadPersisted();
  const status: PersistStatus = storageAvailable() ? 'ok' : 'unavailable';
  if (persisted) {
    return {
      seededAt: persisted.meta.seededAt,
      activeIndustry: persisted.meta.activeIndustry,
      settings: persisted.meta.settings,
      data: persisted.data,
      persistStatus: status,
      restoredFromCorrupt: false,
    };
  }
  const hadSomething = (() => {
    try {
      return Object.keys(window.localStorage).some((k) => k.startsWith('billora:'));
    } catch {
      return false;
    }
  })();
  clearPersisted();
  const settings = defaultSettings();
  return {
    seededAt: new Date().toISOString(),
    activeIndustry: 'grocery' as Industry,
    settings,
    data: seedAll(settings),
    persistStatus: status,
    restoredFromCorrupt: hadSomething,
  };
}

export const useStore = create<State>()((set, get) => {
  const init = initial();

  /** Apply a mutation to one industry slice. */
  const mutate = (i: Industry, fn: (d: IndustryData) => IndustryData) =>
    set((s) => ({ data: { ...s.data, [i]: fn(s.data[i]) } }));

  return {
    ready: true,
    ...init,

    setActiveIndustry: (i) => set({ activeIndustry: i }),

    updateGlobal: (patch) => set((s) => ({ settings: { ...s.settings, global: { ...s.settings.global, ...patch } } })),

    updateBusiness: (i, patch) =>
      set((s) => ({
        settings: {
          ...s.settings,
          businesses: { ...s.settings.businesses, [i]: { ...s.settings.businesses[i], ...patch } },
        },
      })),

    createInvoice: (i, draft) => {
      if (draft.idempotencyKey && usedKeys.has(draft.idempotencyKey)) {
        return { ok: false, error: 'This transaction was already completed.' };
      }
      const lines = validateLines(draft.items);
      if (!lines.ok) return { ok: false, error: lines.errors[0] };
      const totals = computeTotals({ items: draft.items, discount: draft.discount, taxRate: draft.taxRate, taxEnabled: draft.taxEnabled });
      const discErr = validateDiscount(draft.discount, totals.subtotal);
      if (discErr) return { ok: false, error: discErr };

      const state = get();
      const d = state.data[i];
      // Stock check for tracked products, aggregated by item.
      const need = new Map<string, number>();
      draft.items.forEach((l) => l.refId && need.set(l.refId, (need.get(l.refId) ?? 0) + l.quantity));
      for (const [refId, qty] of need) {
        const c = d.catalog.find((x) => x.id === refId);
        if (c?.trackStock && (c.stock ?? 0) < qty) {
          return { ok: false, error: `Insufficient stock for ${c.name}: ${c.stock ?? 0} available, ${qty} requested.` };
        }
      }
      if (draft.payment) {
        const err = validatePayment(totals.total, draft.payment.amount);
        if (err && !(totals.total === 0 && draft.payment.amount === 0)) return { ok: false, error: err };
        if (draft.payment.method === 'cash' && draft.payment.tendered !== undefined && draft.payment.tendered < draft.payment.amount) {
          return { ok: false, error: 'Cash received is less than the amount being paid.' };
        }
      }

      const biz = state.settings.businesses[i];
      const now = new Date();
      const { seq, number } = nextInvoiceNumber(d, biz.invoicePrefix, now);
      const customer = draft.customerId ? d.customers.find((c) => c.id === draft.customerId) : undefined;
      const id = uid('inv');
      const inv: Invoice = {
        id,
        number,
        industry: i,
        businessId: i,
        customerId: customer?.id,
        customerName: customer?.name ?? draft.customerName?.trim() ?? 'Walk-in customer',
        createdAt: now.toISOString(),
        dueDate: (() => {
          const x = addDays(now, draft.dueDays ?? biz.paymentTermsDays);
          x.setHours(23, 59, 59, 0);
          return x.toISOString();
        })(),
        items: draft.items.map((l) => ({ ...l, id: l.id || uid('li') })),
        discount: draft.discount,
        taxRate: draft.taxEnabled ? draft.taxRate : 0,
        taxLabel: biz.taxLabel,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        total: totals.total,
        payments: [],
        notes: draft.notes?.trim() || undefined,
        meta: draft.meta,
        simulated: true,
      };
      if (draft.payment && draft.payment.amount > 0) inv.payments.push(buildPayment(draft.payment, inv.total, now));
      if (draft.idempotencyKey) usedKeys.add(draft.idempotencyKey);

      mutate(i, (prev) => {
        let catalog = prev.catalog;
        if (need.size) {
          catalog = prev.catalog.map((c) =>
            c.trackStock && need.has(c.id) ? { ...c, stock: Math.max(0, (c.stock ?? 0) - need.get(c.id)!) } : c,
          );
        }
        let acts = pushActivity(prev, activity('invoice', `Invoice ${number} created for ${inv.customerName} — ${formatMoney(inv.total)}`, `/demo/invoices/${id}`));
        if (inv.payments.length) {
          acts = [activity('payment', `Simulated payment of ${formatMoney(amountPaid(inv))} recorded on ${number}`, `/demo/invoices/${id}`), ...acts];
        }
        const lowNow = catalog.filter((c) => c.trackStock && need.has(c.id) && (c.stock ?? 0) <= (c.reorderLevel ?? 0));
        lowNow.forEach((c) => {
          acts = [activity('stock', `Low stock: ${c.name} (${c.stock} left)`, '/demo/products'), ...acts];
        });
        let appointments = prev.appointments;
        if (draft.meta?.appointmentId) {
          appointments = prev.appointments.map((a) =>
            a.id === draft.meta!.appointmentId ? { ...a, status: 'completed', invoiceId: id } : a,
          );
        }
        return { ...prev, catalog, appointments, invoices: [inv, ...prev.invoices], invoiceSeq: seq, activities: acts.slice(0, 60) };
      });
      return { ok: true, value: inv };
    },

    recordPayment: (i, invoiceId, p) => {
      const inv = get().data[i].invoices.find((x) => x.id === invoiceId);
      if (!inv) return { ok: false, error: 'Invoice not found.' };
      const err = validatePayment(outstanding(inv), p.amount);
      if (err) return { ok: false, error: err };
      if (p.method === 'cash' && p.tendered !== undefined && p.tendered < p.amount) {
        return { ok: false, error: 'Cash received is less than the payment amount.' };
      }
      const updated: Invoice = { ...inv, payments: [...inv.payments, buildPayment(p, outstanding(inv), new Date())] };
      mutate(i, (prev) => ({
        ...prev,
        invoices: prev.invoices.map((x) => (x.id === invoiceId ? updated : x)),
        activities: pushActivity(
          prev,
          activity('payment', `Simulated payment of ${formatMoney(p.amount)} recorded on ${inv.number}`, `/demo/invoices/${inv.id}`),
        ),
      }));
      return { ok: true, value: updated };
    },

    addCustomer: (i, c) => {
      const d = get().data[i];
      const prefix = { grocery: 'LC', clinic: 'MRN', hospital: 'MR', salon: 'CL' }[i];
      const seq = d.customerSeq + 1;
      const customer: Customer = {
        ...c,
        id: uid('cus'),
        industry: i,
        code: `${prefix}-${1000 + seq}`,
        createdAt: new Date().toISOString(),
      };
      mutate(i, (prev) => ({
        ...prev,
        customers: [customer, ...prev.customers],
        customerSeq: seq,
        activities: pushActivity(prev, activity('customer', `New ${i === 'clinic' || i === 'hospital' ? 'patient' : 'customer'} registered: ${customer.name} (${customer.code})`)),
      }));
      return customer;
    },

    updateCustomer: (i, id, patch) =>
      mutate(i, (prev) => ({ ...prev, customers: prev.customers.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

    upsertCatalogItem: (i, item) =>
      mutate(i, (prev) => {
        const exists = prev.catalog.some((c) => c.id === item.id);
        return {
          ...prev,
          catalog: exists ? prev.catalog.map((c) => (c.id === item.id ? item : c)) : [item, ...prev.catalog],
          activities: exists ? prev.activities : pushActivity(prev, activity('stock', `Catalog item added: ${item.name}`, '/demo/products')),
        };
      }),

    adjustStock: (i, itemId, delta, reason) => {
      const item = get().data[i].catalog.find((c) => c.id === itemId);
      if (!item || !item.trackStock) return { ok: false, error: 'Item does not track stock.' };
      if (!Number.isInteger(delta) || delta === 0) return { ok: false, error: 'Enter a whole number other than zero.' };
      const next = (item.stock ?? 0) + delta;
      if (next < 0) return { ok: false, error: `Cannot remove more than the ${item.stock ?? 0} units in stock.` };
      const updated = { ...item, stock: next };
      mutate(i, (prev) => ({
        ...prev,
        catalog: prev.catalog.map((c) => (c.id === itemId ? updated : c)),
        activities: pushActivity(prev, activity('stock', `Stock ${delta > 0 ? 'received' : 'adjusted'}: ${item.name} ${delta > 0 ? '+' : ''}${delta} (${reason})`, '/demo/products')),
      }));
      return { ok: true, value: updated };
    },

    updateStaff: (i, id, patch) =>
      mutate(i, (prev) => ({ ...prev, staff: prev.staff.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),

    addAppointment: (i, a) => {
      const appt: Appointment = { ...a, id: uid('apt'), industry: i };
      const d = get().data[i];
      const cust = d.customers.find((c) => c.id === a.customerId);
      mutate(i, (prev) => ({
        ...prev,
        appointments: [...prev.appointments, appt],
        activities: pushActivity(prev, activity('appointment', `Appointment booked for ${cust?.name ?? 'customer'} on ${a.date} at ${a.time}`)),
      }));
      return appt;
    },

    setAppointmentStatus: (i, id, status) =>
      mutate(i, (prev) => ({ ...prev, appointments: prev.appointments.map((a) => (a.id === id ? { ...a, status } : a)) })),

    admitPatient: (a) => {
      const d = get().data.hospital;
      const seq = d.admissionSeq + 1;
      const adm: Admission = {
        ...a,
        id: uid('adm'),
        number: `IPD-${5000 + seq}`,
        admittedAt: new Date().toISOString(),
        status: 'admitted',
        charges: [],
      };
      const p = d.customers.find((c) => c.id === a.patientId);
      mutate('hospital', (prev) => ({
        ...prev,
        admissions: [adm, ...prev.admissions],
        admissionSeq: seq,
        activities: pushActivity(prev, activity('admission', `${p?.name ?? 'Patient'} admitted (${adm.number}, ${a.roomType})`, '/demo/hospital')),
      }));
      return adm;
    },

    addAdmissionCharge: (admissionId, item) =>
      mutate('hospital', (prev) => ({
        ...prev,
        admissions: prev.admissions.map((a) =>
          a.id === admissionId && a.status === 'admitted' ? { ...a, charges: [...a.charges, { ...item, id: uid('li') }] } : a,
        ),
      })),

    removeAdmissionCharge: (admissionId, lineId) =>
      mutate('hospital', (prev) => ({
        ...prev,
        admissions: prev.admissions.map((a) =>
          a.id === admissionId ? { ...a, charges: a.charges.filter((c) => c.id !== lineId) } : a,
        ),
      })),

    dischargeAdmission: (admissionId, opts) => {
      const state = get();
      const d = state.data.hospital;
      const adm = d.admissions.find((a) => a.id === admissionId);
      if (!adm || adm.status !== 'admitted') return { ok: false, error: 'Admission not found or already discharged.' };
      const patient = d.customers.find((c) => c.id === adm.patientId);
      const days = Math.max(1, daysBetween(adm.admittedAt, new Date()));
      const room: LineItem = {
        id: uid('li'),
        kind: 'room',
        description: `${adm.roomType} (${days} day${days > 1 ? 's' : ''})`,
        category: 'Room Charges',
        quantity: days,
        unitPrice: adm.roomRate,
        unitCost: percentOf(adm.roomRate, 35),
        departmentId: adm.departmentId,
      };
      const biz = state.settings.businesses.hospital;
      const res = get().createInvoice('hospital', {
        customerId: adm.patientId,
        customerName: patient?.name,
        items: [room, ...adm.charges, ...opts.extraItems],
        discount: opts.discount,
        taxRate: biz.taxRate,
        taxEnabled: biz.taxEnabled,
        notes: opts.notes,
        meta: { visitType: 'IPD', admissionId: adm.id, departmentId: adm.departmentId, doctorId: adm.doctorId },
        dueDays: biz.paymentTermsDays,
        payment: opts.payment,
      });
      if (!res.ok) return res;
      mutate('hospital', (prev) => ({
        ...prev,
        admissions: prev.admissions.map((a) =>
          a.id === admissionId ? { ...a, status: 'discharged', dischargedAt: new Date().toISOString(), invoiceId: res.value.id } : a,
        ),
        activities: pushActivity(prev, activity('admission', `${patient?.name ?? 'Patient'} discharged — final bill ${res.value.number}`, `/demo/invoices/${res.value.id}`)),
      }));
      return res;
    },

    recordPayout: (staffId, amount, note) => {
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Enter a payout amount above zero.' };
      const staff = get().data.salon.staff.find((s) => s.id === staffId);
      mutate('salon', (prev) => ({
        ...prev,
        payouts: [{ id: uid('po'), staffId, amount, date: new Date().toISOString(), note }, ...prev.payouts],
        activities: pushActivity(prev, activity('payout', `Commission payout of ${formatMoney(amount)} recorded for ${staff?.name ?? 'staff'} (simulated)`)),
      }));
      return { ok: true, value: undefined };
    },

    resetDemo: () => {
      usedKeys.clear();
      clearPersisted();
      const settings = defaultSettings();
      set({
        seededAt: new Date().toISOString(),
        settings,
        data: seedAll(settings),
        restoredFromCorrupt: false,
        activeIndustry: get().activeIndustry,
      });
    },

    resetIndustry: (i) => {
      const s = get();
      mutate(i, () => seedIndustry(i, s.settings));
    },
  };
});

// ───────────── Persistence subscription: write only the slices that changed ─────────────
let lastData: Record<Industry, IndustryData> | null = null;
let lastMetaSig = '';

function persist() {
  const s = useStore.getState();
  configureMoney(s.settings.global.currency, s.settings.global.locale);
  const results: WriteResult[] = [];
  const meta = { version: SCHEMA_VERSION, seededAt: s.seededAt, activeIndustry: s.activeIndustry, settings: s.settings };
  const sig = JSON.stringify(meta);
  if (sig !== lastMetaSig) {
    results.push(saveMeta(meta));
    lastMetaSig = sig;
  }
  for (const i of INDUSTRIES) {
    if (!lastData || s.data[i] !== lastData[i]) results.push(saveIndustry(i, s.data[i]));
  }
  lastData = s.data;
  const status: PersistStatus = results.includes('unavailable') ? 'unavailable' : results.includes('quota') ? 'quota' : s.persistStatus;
  if (status !== s.persistStatus) useStore.setState({ persistStatus: status });
}

persist();
useStore.subscribe(persist);

export const useActiveIndustry = () => useStore((s) => s.activeIndustry);
export const useIndustryData = (i?: Industry) => {
  const active = useStore((s) => s.activeIndustry);
  return useStore((s) => s.data[i ?? active]);
};
export const useBusiness = (i?: Industry) => {
  const active = useStore((s) => s.activeIndustry);
  return useStore((s) => s.settings.businesses[i ?? active]);
};
