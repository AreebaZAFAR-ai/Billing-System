/**
 * Deterministic demo-data generator. Produces ~90 days of internally consistent,
 * fictional history relative to the moment the demo is (re)seeded.
 */
import { computeTotals, formatInvoiceNumber, roundToUnit } from '@/lib/billing';
import { addDays, startOfDay, toDateKey } from '@/lib/dates';
import { percentOf } from '@/lib/money';
import type {
  Activity,
  Admission,
  Appointment,
  CatalogItem,
  CommissionPayout,
  Customer,
  Discount,
  Industry,
  IndustryData,
  Invoice,
  LineItem,
  PaymentMethod,
  Settings,
  Staff,
} from '@/lib/types';
import { seededRandom } from '@/lib/utils';
import {
  CITIES,
  FIRST_F,
  FIRST_M,
  LAST,
  ROOM_TYPES,
  clinicCatalog,
  defaultBusinesses,
  groceryCatalog,
  hospitalCatalog,
  hospitalDepartments,
  salonCatalog,
  staffSeed,
} from './catalog';

export const SEED_DAYS = 90;

type Rng = () => number;

const pick = <T,>(rng: Rng, arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const int = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
const chance = (rng: Rng, p: number) => rng() < p;

function weighted<T>(rng: Rng, options: [T, number][]): T {
  const total = options.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [v, w] of options) {
    r -= w;
    if (r <= 0) return v;
  }
  return options[options.length - 1][0];
}

function sample<T>(rng: Rng, arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  return out;
}

export function defaultSettings(): Settings {
  return {
    global: { currency: 'PKR', locale: 'en-PK', receiptFormat: 'a4', showGuide: true, commissionBasis: 'gross' },
    businesses: structuredClone(defaultBusinesses),
  };
}

function makeCustomers(rng: Rng, industry: Industry, count: number, now: Date): Customer[] {
  const prefix = { grocery: 'LC', clinic: 'MRN', hospital: 'MR', salon: 'CL' }[industry];
  const femaleShare = industry === 'salon' ? 0.85 : 0.5;
  const used = new Set<string>();
  const out: Customer[] = [];
  let guard = 0;
  while (out.length < count && guard < count * 10) {
    guard++;
    const female = chance(rng, femaleShare);
    const name = `${pick(rng, female ? FIRST_F : FIRST_M)} ${pick(rng, LAST)}`;
    if (used.has(name)) continue;
    used.add(name);
    const n = out.length + 1;
    out.push({
      id: `${industry.slice(0, 2)}c_${n}`,
      industry,
      code: `${prefix}-${String(1000 + n)}`,
      name,
      // 555-range numbers are reserved for fiction.
      phone: `0300-555${String(1000 + int(rng, 0, 8999)).slice(-4)}`,
      email: chance(rng, 0.4) ? `${name.toLowerCase().replace(/\s+/g, '.')}@example.com` : undefined,
      gender: female ? 'Female' : 'Male',
      age: industry === 'grocery' ? undefined : int(rng, industry === 'clinic' || industry === 'hospital' ? 2 : 18, 72),
      city: pick(rng, CITIES),
      createdAt: addDays(now, -int(rng, 20, 400)).toISOString(),
    });
  }
  return out;
}

const timeOnDay = (rng: Rng, day: Date, openH: number, closeH: number) => {
  const d = new Date(day);
  d.setHours(int(rng, openH, closeH - 1), int(rng, 0, 59), int(rng, 0, 59), 0);
  return d;
};

function line(item: CatalogItem, quantity: number, extra: Partial<LineItem> = {}, idx = 0): LineItem {
  return {
    id: `li_${item.id}_${idx}`,
    refId: item.id,
    kind: item.kind,
    description: item.name,
    category: item.category,
    quantity,
    unitPrice: item.price,
    unitCost: item.cost,
    departmentId: item.departmentId,
    ...extra,
  };
}

interface Ctx {
  rng: Rng;
  industry: Industry;
  settings: Settings;
  seq: number;
  invoices: Invoice[];
}

function makeInvoice(
  ctx: Ctx,
  args: {
    createdAt: Date;
    items: LineItem[];
    customer?: Customer;
    discount?: Discount;
    payPlan: 'full' | 'partial' | 'none';
    method: PaymentMethod;
    meta?: Invoice['meta'];
    termsDays?: number;
    paidAt?: Date;
  },
): Invoice {
  const biz = ctx.settings.businesses[ctx.industry];
  const discount = args.discount ?? { type: 'percent', value: 0 };
  const taxRate = biz.taxEnabled ? biz.taxRate : 0;
  const totals = computeTotals({ items: args.items, discount, taxRate });
  ctx.seq += 1;
  const id = `inv_${ctx.industry.slice(0, 2)}_${ctx.seq}`;
  const terms = args.termsDays ?? biz.paymentTermsDays;
  const inv: Invoice = {
    id,
    number: formatInvoiceNumber(biz.invoicePrefix, ctx.seq, args.createdAt),
    industry: ctx.industry,
    businessId: ctx.industry,
    customerId: args.customer?.id,
    customerName: args.customer?.name ?? 'Walk-in customer',
    createdAt: args.createdAt.toISOString(),
    dueDate: endOfDayIso(addDays(args.createdAt, terms)),
    items: args.items.map((l, i) => ({ ...l, id: `${id}_l${i}` })),
    discount,
    taxRate,
    taxLabel: biz.taxLabel,
    ...totals,
    payments: [],
    meta: args.meta,
    simulated: true,
  };
  const paidAt = args.paidAt ?? args.createdAt;
  if (args.payPlan === 'full') {
    const cash = args.method === 'cash';
    const tendered = cash ? roundUpTender(inv.total) : undefined;
    inv.payments.push({
      id: `${id}_p1`,
      amount: inv.total,
      method: args.method,
      date: paidAt.toISOString(),
      tendered,
      change: tendered !== undefined ? tendered - inv.total : undefined,
    });
  } else if (args.payPlan === 'partial') {
    const share = pick(ctx.rng, [0.3, 0.4, 0.5, 0.6, 0.7]);
    const amount = Math.max(100, Math.round((inv.total * share) / 10000) * 10000);
    if (amount < inv.total) {
      inv.payments.push({ id: `${id}_p1`, amount, method: args.method, date: paidAt.toISOString(), note: 'Advance' });
    }
  }
  ctx.invoices.push(inv);
  return inv;
}

function endOfDayIso(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 0);
  return x.toISOString();
}

/** Typical cash tender: next 500 or 1000 note above the total. */
function roundUpTender(total: number) {
  const step = total > 500000 ? 100000 : 50000;
  return Math.ceil(total / step) * step;
}

function dayCount(rng: Rng, day: Date, base: [number, number], dayIndex: number) {
  const dow = day.getDay();
  const weekend = dow === 0 || dow === 6 ? 1.3 : dow === 5 ? 0.85 : 1;
  const trend = 0.85 + (dayIndex / SEED_DAYS) * 0.25;
  return Math.max(1, Math.round(int(rng, base[0], base[1]) * weekend * trend));
}

function methodMix(rng: Rng, mix: [PaymentMethod, number][]) {
  return weighted(rng, mix);
}

// ───────────────────────── Grocery ─────────────────────────
function seedGrocery(settings: Settings, now: Date): IndustryData {
  const rng = seededRandom(1101);
  const customers = makeCustomers(rng, 'grocery', 28, now);
  const catalog = structuredClone(groceryCatalog);
  const ctx: Ctx = { rng, industry: 'grocery', settings, seq: 0, invoices: [] };
  const popular = catalog.filter((c) => ['Staples', 'Dairy & Eggs', 'Bakery', 'Beverages'].includes(c.category));
  for (let i = SEED_DAYS - 1; i >= 0; i--) {
    const day = startOfDay(addDays(now, -i));
    const n = dayCount(rng, day, [5, 9], SEED_DAYS - i);
    const times = Array.from({ length: n }, () => timeOnDay(rng, day, 9, 22))
      .filter((t) => t <= now)
      .sort((a, b) => a.getTime() - b.getTime());
    for (const t of times) {
      const count = int(rng, 1, 6);
      const chosen = sample(rng, chance(rng, 0.7) ? popular : catalog, count);
      const items = chosen.map((c, idx) => line(c, c.price > 100000 ? 1 : int(rng, 1, 3), {}, idx));
      makeInvoice(ctx, {
        createdAt: t,
        items,
        customer: chance(rng, 0.25) ? pick(rng, customers) : undefined,
        discount: chance(rng, 0.08) ? { type: 'percent', value: 5 } : undefined,
        payPlan: 'full',
        method: methodMix(rng, [['cash', 62], ['card', 24], ['bank', 8], ['wallet', 6]]),
      });
    }
  }
  return finalize({ customers, staff: staffSeed.grocery, departments: [], catalog, invoices: ctx.invoices, seq: ctx.seq });
}

// ───────────────────────── Clinic ─────────────────────────
function seedClinic(settings: Settings, now: Date): IndustryData {
  const rng = seededRandom(2202);
  const customers = makeCustomers(rng, 'clinic', 64, now);
  const catalog = structuredClone(clinicCatalog);
  const staff = staffSeed.clinic;
  const doctors = staff.filter((s) => s.role === 'Doctor');
  const ctx: Ctx = { rng, industry: 'clinic', settings, seq: 0, invoices: [] };
  const appointments: Appointment[] = [];
  const consult = (doc: Staff) =>
    catalog.find((c) =>
      doc.specialty === 'Pediatrician'
        ? c.name === 'Pediatric Consultation'
        : doc.specialty === 'Dermatologist'
          ? c.name === 'Specialist Consultation'
          : c.name === 'General Consultation',
    )!;
  const procedures = catalog.filter((c) => c.category === 'Procedure');
  const labs = catalog.filter((c) => c.category === 'Laboratory');
  const followUp = catalog.find((c) => c.name === 'Follow-up Consultation')!;
  let apptN = 0;

  for (let i = SEED_DAYS - 1; i >= 0; i--) {
    const day = startOfDay(addDays(now, -i));
    if (day.getDay() === 0) continue; // closed Sundays
    const n = dayCount(rng, day, [4, 7], SEED_DAYS - i);
    for (let k = 0; k < n; k++) {
      const t = timeOnDay(rng, day, 10, 20);
      const patient = pick(rng, customers);
      const doc = pick(rng, doctors);
      apptN++;
      const appt: Appointment = {
        id: `ap_cl_${apptN}`,
        industry: 'clinic',
        customerId: patient.id,
        staffId: doc.id,
        date: toDateKey(day),
        time: `${String(t.getHours()).padStart(2, '0')}:${String(Math.floor(t.getMinutes() / 15) * 15).padStart(2, '0')}`,
        serviceIds: [],
        status: 'completed',
      };
      if (t > now) {
        appt.status = 'scheduled';
        appointments.push(appt);
        continue;
      }
      const items: LineItem[] = [line(chance(rng, 0.25) ? followUp : consult(doc), 1, {}, 0)];
      if (chance(rng, 0.3)) items.push(line(pick(rng, procedures), 1, {}, 1));
      if (chance(rng, 0.45)) sample(rng, labs, int(rng, 1, 3)).forEach((l, j) => items.push(line(l, 1, {}, 2 + j)));
      const plan = weighted<'full' | 'partial' | 'none'>(rng, [['full', 84], ['partial', 9], ['none', 7]]);
      const inv = makeInvoice(ctx, {
        createdAt: t,
        items,
        customer: patient,
        discount: chance(rng, 0.07) ? { type: 'percent', value: 10 } : undefined,
        payPlan: plan,
        method: methodMix(rng, [['cash', 55], ['card', 25], ['bank', 12], ['wallet', 8]]),
        meta: { doctorId: doc.id, appointmentId: appt.id },
      });
      appt.serviceIds = items.map((l) => l.refId!).filter(Boolean);
      appt.invoiceId = inv.id;
      appointments.push(appt);
    }
  }
  // Upcoming appointments for today/tomorrow so the desk has work to show.
  for (let d = 0; d <= 2; d++) {
    const day = startOfDay(addDays(now, d));
    const slots = d === 0 ? 7 : 5;
    for (let k = 0; k < slots; k++) {
      const h = 10 + k;
      const at = new Date(day);
      at.setHours(h, k % 2 ? 30 : 0);
      if (d === 0 && at <= now) continue;
      apptN++;
      appointments.push({
        id: `ap_cl_${apptN}`,
        industry: 'clinic',
        customerId: pick(rng, customers).id,
        staffId: pick(rng, doctors).id,
        date: toDateKey(day),
        time: `${String(h).padStart(2, '0')}:${k % 2 ? '30' : '00'}`,
        serviceIds: [],
        status: d === 0 && k < 2 ? 'checked-in' : 'scheduled',
      });
    }
  }
  return finalize({ customers, staff, departments: [], catalog, invoices: ctx.invoices, seq: ctx.seq, appointments });
}

// ───────────────────────── Hospital ─────────────────────────
function seedHospital(settings: Settings, now: Date): IndustryData {
  const rng = seededRandom(3303);
  const customers = makeCustomers(rng, 'hospital', 90, now);
  const catalog = structuredClone(hospitalCatalog);
  const staff = staffSeed.hospital;
  const ctx: Ctx = { rng, industry: 'hospital', settings, seq: 0, invoices: [] };
  const byCat = (cat: string) => catalog.filter((c) => c.category === cat);
  const consults = byCat('Consultation').filter((c) => c.name.startsWith('OPD') || c.name.startsWith('Emergency'));
  const labs = byCat('Laboratory');
  const rads = byCat('Radiology');
  const pharm = byCat('Pharmacy');
  const docFor = (dep?: string) => staff.find((s) => s.departmentId === dep) ?? staff[0];
  const admissions: Admission[] = [];

  // Outpatient visits
  for (let i = SEED_DAYS - 1; i >= 0; i--) {
    const day = startOfDay(addDays(now, -i));
    const n = dayCount(rng, day, [3, 6], SEED_DAYS - i);
    for (let k = 0; k < n; k++) {
      const t = timeOnDay(rng, day, 8, 22);
      if (t > now) continue;
      const c = pick(rng, consults);
      const items: LineItem[] = [line(c, 1, {}, 0)];
      if (chance(rng, 0.5)) sample(rng, labs, int(rng, 1, 2)).forEach((l, j) => items.push(line(l, 1, {}, 1 + j)));
      if (chance(rng, 0.25)) items.push(line(pick(rng, rads), 1, {}, 4));
      if (chance(rng, 0.4)) sample(rng, pharm, int(rng, 1, 3)).forEach((p, j) => items.push(line(p, int(rng, 1, 3), {}, 5 + j)));
      makeInvoice(ctx, {
        createdAt: t,
        items,
        customer: pick(rng, customers),
        payPlan: weighted(rng, [['full', 88], ['partial', 6], ['none', 6]]),
        method: methodMix(rng, [['cash', 45], ['card', 30], ['bank', 20], ['wallet', 5]]),
        meta: { visitType: 'OPD', departmentId: c.departmentId, doctorId: docFor(c.departmentId).id },
      });
    }
  }

  // Inpatient admissions (discharged + currently admitted)
  const ipdDepts = ['dep_gm', 'dep_ped', 'dep_car', 'dep_sur'];
  let admN = 0;
  for (let a = 0; a < 30; a++) {
    const dep = pick(rng, ipdDepts);
    const admitted = timeOnDay(rng, startOfDay(addDays(now, -int(rng, 1, SEED_DAYS - 2))), 8, 22);
    const stay = int(rng, 1, 6);
    const discharged = addDays(admitted, stay);
    const current = discharged > now || a >= 25;
    const room = weighted(rng, [[ROOM_TYPES[0], 45], [ROOM_TYPES[1], 25], [ROOM_TYPES[2], 20], [ROOM_TYPES[3], 10]]);
    const patient = pick(rng, customers);
    const doc = docFor(dep);
    admN++;
    const charges: LineItem[] = [];
    const add = (c: CatalogItem, q: number) => charges.push(line(c, q, {}, charges.length));
    sample(rng, labs, int(rng, 2, 4)).forEach((l) => add(l, 1));
    if (chance(rng, 0.6)) add(pick(rng, rads), 1);
    sample(rng, pharm, int(rng, 2, 4)).forEach((p) => add(p, int(rng, 2, 8)));
    if (dep === 'dep_sur') add(chance(rng, 0.5) ? catalog.find((c) => c.name.startsWith('Appendectomy'))! : catalog.find((c) => c.name.startsWith('Minor Surgical'))!, 1);
    if (dep === 'dep_car' && chance(rng, 0.5)) add(catalog.find((c) => c.name.startsWith('Diagnostic Angio'))!, 1);
    if (dep === 'dep_car') add(catalog.find((c) => c.name === 'Echocardiography')!, 1);

    const adm: Admission = {
      id: `adm_${admN}`,
      number: `IPD-${String(5000 + admN)}`,
      patientId: patient.id,
      departmentId: dep,
      doctorId: doc.id,
      roomType: room.name,
      roomRate: room.rate,
      admittedAt: (current ? addDays(now, -int(rng, 0, 3)) : admitted).toISOString(),
      status: current ? 'admitted' : 'discharged',
      charges,
    };
    if (!current) {
      const days = Math.max(1, stay);
      const visit = catalog.find((c) => c.name.startsWith('Inpatient Doctor'))!;
      const nursing = catalog.find((c) => c.name.startsWith('Nursing Care'))!;
      const items: LineItem[] = [
        { id: 'room', kind: 'room', description: `${room.name} (${days} day${days > 1 ? 's' : ''})`, category: 'Room Charges', quantity: days, unitPrice: room.rate, unitCost: percentOf(room.rate, 35), departmentId: dep },
        line(visit, days, { departmentId: dep }, 90),
        line(nursing, days, { departmentId: dep }, 91),
        ...charges,
      ];
      const plan = weighted<'full' | 'partial' | 'none'>(rng, [['full', 60], ['partial', 30], ['none', 10]]);
      const inv = makeInvoice(ctx, {
        createdAt: discharged,
        items,
        customer: patient,
        discount: chance(rng, 0.15) ? { type: 'fixed', value: 500000 } : undefined,
        payPlan: plan,
        method: methodMix(rng, [['bank', 45], ['card', 35], ['cash', 20]]),
        meta: { visitType: 'IPD', departmentId: dep, doctorId: doc.id, admissionId: adm.id },
        termsDays: 15,
      });
      adm.dischargedAt = discharged.toISOString();
      adm.invoiceId = inv.id;
    }
    admissions.push(adm);
  }
  ctx.invoices.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  renumber(ctx.invoices, settings.businesses.hospital.invoicePrefix);
  return finalize({
    customers,
    staff,
    departments: hospitalDepartments,
    catalog,
    invoices: ctx.invoices,
    seq: ctx.seq,
    admissions,
    admissionSeq: admN,
  });
}

/** Keep invoice numbers chronological when invoices were generated out of order. */
function renumber(invoices: Invoice[], prefix: string) {
  invoices.forEach((inv, i) => {
    inv.number = formatInvoiceNumber(prefix, i + 1, new Date(inv.createdAt));
  });
}

// ───────────────────────── Salon ─────────────────────────
function seedSalon(settings: Settings, now: Date): IndustryData {
  const rng = seededRandom(4404);
  const customers = makeCustomers(rng, 'salon', 56, now);
  const catalog = structuredClone(salonCatalog);
  const staff = staffSeed.salon;
  const ctx: Ctx = { rng, industry: 'salon', settings, seq: 0, invoices: [] };
  const services = catalog.filter((c) => c.kind === 'service');
  const packages = catalog.filter((c) => c.kind === 'package');
  const retail = catalog.filter((c) => c.kind === 'product');
  const staffFor = (svc: CatalogItem): Staff => {
    const male = svc.name.startsWith("Men's") || svc.name.startsWith('Groom');
    if (male) return staff.find((s) => s.id === 'st_s6')!;
    if (svc.category === 'Makeup') return staff.find((s) => s.id === 'st_s4')!;
    if (svc.category === 'Nails') return staff.find((s) => s.id === 'st_s5')!;
    if (svc.category === 'Skin' || svc.category === 'Waxing & Threading' || svc.category === 'Packages')
      return staff.find((s) => s.id === 'st_s3')!;
    return chance(rng, 0.5) ? staff[0] : staff[1];
  };
  const appointments: Appointment[] = [];
  let apptN = 0;
  const weights: [CatalogItem, number][] = services.map((s) => [
    s,
    s.name.includes('Bridal') ? 1 : s.price > 1000000 ? 3 : s.name.includes('Threading') ? 14 : 8,
  ]);

  for (let i = SEED_DAYS - 1; i >= 0; i--) {
    const day = startOfDay(addDays(now, -i));
    const n = dayCount(rng, day, [3, 6], SEED_DAYS - i);
    for (let k = 0; k < n; k++) {
      const t = timeOnDay(rng, day, 11, 21);
      if (t > now) continue;
      const customer = pick(rng, customers);
      const chosen: CatalogItem[] = chance(rng, 0.1) ? [pick(rng, packages)] : [];
      const svcCount = chosen.length ? int(rng, 0, 1) : int(rng, 1, 3);
      for (let s = 0; s < svcCount; s++) {
        const svc = weighted(rng, weights);
        if (!chosen.includes(svc)) chosen.push(svc);
      }
      const items: LineItem[] = chosen.map((c, idx) => {
        const st = staffFor(c);
        return line(c, 1, { staffId: st.id, commissionRate: st.commissionRate }, idx);
      });
      if (chance(rng, 0.18)) items.push(line(pick(rng, retail), 1, {}, 9));
      const lead = items.find((l) => l.staffId)?.staffId ?? staff[0].id;
      apptN++;
      const appt: Appointment = {
        id: `ap_sl_${apptN}`,
        industry: 'salon',
        customerId: customer.id,
        staffId: lead,
        date: toDateKey(day),
        time: `${String(t.getHours()).padStart(2, '0')}:${t.getMinutes() < 30 ? '00' : '30'}`,
        serviceIds: chosen.map((c) => c.id),
        status: 'completed',
      };
      const inv = makeInvoice(ctx, {
        createdAt: t,
        items,
        customer,
        discount: chance(rng, 0.12) ? { type: 'percent', value: pick(rng, [5, 10, 15]) } : undefined,
        payPlan: chosen.some((c) => c.name.includes('Bridal')) ? 'partial' : chance(rng, 0.03) ? 'none' : 'full',
        method: methodMix(rng, [['cash', 40], ['card', 35], ['wallet', 15], ['bank', 10]]),
        meta: { appointmentId: appt.id, staffId: lead },
      });
      appt.invoiceId = inv.id;
      appointments.push(appt);
    }
  }
  // Upcoming appointments
  for (let d = 0; d <= 3; d++) {
    const day = startOfDay(addDays(now, d));
    const slots = d === 0 ? 8 : 6;
    for (let k = 0; k < slots; k++) {
      const h = 11 + k;
      const at = new Date(day);
      at.setHours(h, 0);
      if (d === 0 && at <= now) continue;
      const svc = weighted(rng, weights);
      apptN++;
      appointments.push({
        id: `ap_sl_${apptN}`,
        industry: 'salon',
        customerId: pick(rng, customers).id,
        staffId: staffFor(svc).id,
        date: toDateKey(day),
        time: `${String(h).padStart(2, '0')}:00`,
        serviceIds: [svc.id],
        status: 'scheduled',
      });
    }
  }
  // Commission payouts for previous months — some of last month still pending.
  const payouts: CommissionPayout[] = [];
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const comm = new Map<string, number>();
  ctx.invoices
    .filter((inv) => new Date(inv.createdAt) < firstOfMonth)
    .forEach((inv) =>
      inv.items.forEach((l) => {
        if (l.staffId && l.commissionRate) {
          comm.set(l.staffId, (comm.get(l.staffId) ?? 0) + roundToUnit(percentOf(l.quantity * l.unitPrice, l.commissionRate)));
        }
      }),
    );
  let pn = 0;
  comm.forEach((amount, staffId) => {
    const paid = staffId === 'st_s4' ? Math.round(amount * 0.6) : amount;
    const rounded = Math.floor(paid / 10000) * 10000;
    if (rounded <= 0) return;
    pn++;
    payouts.push({ id: `po_${pn}`, staffId, amount: rounded, date: addDays(firstOfMonth, 2).toISOString(), note: 'Monthly commission settlement' });
  });

  return finalize({ customers, staff, departments: [], catalog, invoices: ctx.invoices, seq: ctx.seq, appointments, payouts });
}

function finalize(p: {
  customers: Customer[];
  staff: Staff[];
  departments: IndustryData['departments'];
  catalog: CatalogItem[];
  invoices: Invoice[];
  seq: number;
  appointments?: Appointment[];
  admissions?: Admission[];
  payouts?: CommissionPayout[];
  admissionSeq?: number;
}): IndustryData {
  const invoices = [...p.invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const activities: Activity[] = invoices.slice(0, 12).map((inv) => {
    const paid = inv.payments.reduce((a, x) => a + x.amount, 0);
    return {
      id: `act_${inv.id}`,
      type: paid > 0 ? 'payment' : 'invoice',
      message: paid > 0 ? `Payment recorded for ${inv.number} — ${inv.customerName}` : `Invoice ${inv.number} issued to ${inv.customerName}`,
      at: inv.createdAt,
      link: `/demo/invoices/${inv.id}`,
    };
  });
  return {
    customers: p.customers,
    staff: structuredClone(p.staff),
    departments: structuredClone(p.departments),
    catalog: p.catalog,
    invoices,
    appointments: p.appointments ?? [],
    admissions: p.admissions ?? [],
    payouts: p.payouts ?? [],
    activities,
    invoiceSeq: p.seq,
    customerSeq: p.customers.length,
    admissionSeq: p.admissionSeq ?? 0,
  };
}

export function seedIndustry(industry: Industry, settings: Settings, now = new Date()): IndustryData {
  switch (industry) {
    case 'grocery':
      return seedGrocery(settings, now);
    case 'clinic':
      return seedClinic(settings, now);
    case 'hospital':
      return seedHospital(settings, now);
    case 'salon':
      return seedSalon(settings, now);
  }
}

export function seedAll(settings: Settings, now = new Date()): Record<Industry, IndustryData> {
  return {
    grocery: seedIndustry('grocery', settings, now),
    clinic: seedIndustry('clinic', settings, now),
    hospital: seedIndustry('hospital', settings, now),
    salon: seedIndustry('salon', settings, now),
  };
}
