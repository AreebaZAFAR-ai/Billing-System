export type Industry = 'grocery' | 'clinic' | 'hospital' | 'salon';
export const INDUSTRIES: Industry[] = ['grocery', 'clinic', 'hospital', 'salon'];

/** All money values are integer minor units (paisa for PKR). */
export type Money = number;

export type PaymentMethod = 'cash' | 'card' | 'bank' | 'wallet';
export type InvoiceStatus = 'paid' | 'partial' | 'unpaid' | 'overdue';
export type DiscountType = 'percent' | 'fixed';

export interface Discount {
  type: DiscountType;
  /** percent (e.g. 10 = 10%) or fixed amount in minor units */
  value: number;
}

export type LineKind = 'product' | 'service' | 'package' | 'room';

export interface LineItem {
  id: string;
  refId?: string;
  kind: LineKind;
  description: string;
  category?: string;
  quantity: number;
  unitPrice: Money;
  /** Estimated unit cost used for gross-profit estimates. */
  unitCost?: Money;
  departmentId?: string;
  staffId?: string;
  /** Commission rate snapshot in percent (salon staff). */
  commissionRate?: number;
}

export interface Payment {
  id: string;
  amount: Money;
  method: PaymentMethod;
  date: string; // ISO
  reference?: string;
  /** Cash tendered (POS). */
  tendered?: Money;
  change?: Money;
  note?: string;
}

export interface InvoiceMeta {
  doctorId?: string;
  departmentId?: string;
  visitType?: 'OPD' | 'IPD';
  admissionId?: string;
  appointmentId?: string;
  staffId?: string;
}

export interface Invoice {
  id: string;
  number: string;
  industry: Industry;
  businessId: string;
  customerId?: string;
  customerName: string;
  createdAt: string;
  dueDate: string;
  items: LineItem[];
  discount: Discount;
  taxRate: number; // percent
  taxLabel: string;
  subtotal: Money;
  discountAmount: Money;
  taxAmount: Money;
  total: Money;
  payments: Payment[];
  notes?: string;
  meta?: InvoiceMeta;
  simulated: true;
}

export interface Customer {
  id: string;
  industry: Industry;
  code: string; // MRN / client code
  name: string;
  phone: string;
  email?: string;
  gender?: 'Female' | 'Male' | 'Other';
  age?: number;
  city?: string;
  createdAt: string;
  notes?: string;
}

export interface Staff {
  id: string;
  industry: Industry;
  name: string;
  role: string;
  departmentId?: string;
  specialty?: string;
  commissionRate?: number; // percent
  consultationFee?: Money;
  active: boolean;
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export type CatalogKind = 'product' | 'service' | 'package';

export interface CatalogItem {
  id: string;
  kind: CatalogKind;
  name: string;
  category: string;
  price: Money;
  cost?: Money;
  sku?: string;
  barcode?: string;
  unit?: string;
  trackStock: boolean;
  stock?: number;
  reorderLevel?: number;
  departmentId?: string;
  durationMin?: number;
  includes?: string[];
  active: boolean;
}

export type AppointmentStatus = 'scheduled' | 'checked-in' | 'completed' | 'cancelled' | 'no-show';

export interface Appointment {
  id: string;
  industry: Industry;
  customerId: string;
  staffId: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  serviceIds: string[];
  status: AppointmentStatus;
  invoiceId?: string;
  notes?: string;
}

export interface Admission {
  id: string;
  number: string;
  patientId: string;
  departmentId: string;
  doctorId: string;
  roomType: string;
  roomRate: Money;
  admittedAt: string;
  dischargedAt?: string;
  status: 'admitted' | 'discharged';
  charges: LineItem[];
  invoiceId?: string;
}

export interface CommissionPayout {
  id: string;
  staffId: string;
  amount: Money;
  date: string;
  note?: string;
}

export type ActivityType =
  | 'invoice'
  | 'payment'
  | 'customer'
  | 'stock'
  | 'appointment'
  | 'admission'
  | 'payout'
  | 'system';

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  at: string;
  link?: string;
}

export interface IndustryData {
  customers: Customer[];
  staff: Staff[];
  departments: Department[];
  catalog: CatalogItem[];
  invoices: Invoice[];
  appointments: Appointment[];
  admissions: Admission[];
  payouts: CommissionPayout[];
  activities: Activity[];
  invoiceSeq: number;
  customerSeq: number;
  admissionSeq: number;
}

export interface BusinessProfile {
  name: string;
  phone: string;
  email: string;
  address: string;
  logoText: string;
  logoDataUrl?: string;
  invoicePrefix: string;
  taxRate: number;
  taxLabel: string;
  taxEnabled: boolean;
  paymentTermsDays: number;
  footerNote: string;
  paymentInstructions: string;
}

export interface GlobalSettings {
  currency: string;
  locale: string;
  receiptFormat: 'a4' | 'thermal';
  showGuide: boolean;
  commissionBasis: 'gross' | 'net';
}

export interface Settings {
  global: GlobalSettings;
  businesses: Record<Industry, BusinessProfile>;
}
