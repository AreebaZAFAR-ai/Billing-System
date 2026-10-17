import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  Package,
  ReceiptText,
  Scissors,
  Settings,
  ShoppingCart,
  Stethoscope,
  Users,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';
import type { Industry } from '@/lib/types';

export interface IndustryConfig {
  id: Industry;
  label: string;
  short: string;
  icon: LucideIcon;
  /** Tailwind classes for the industry accent (kept subtle; brand teal stays primary). */
  accent: { text: string; bg: string; soft: string; ring: string; dot: string };
  modulePath: string;
  moduleLabel: string;
  moduleIcon: LucideIcon;
  customer: string;
  customers: string;
  catalogLabel: string;
  invoiceTerm: string;
  description: string;
  pitch: string;
  highlights: string[];
  guide: { title: string; detail: string; to?: string }[];
}

export const INDUSTRY_CONFIG: Record<Industry, IndustryConfig> = {
  grocery: {
    id: 'grocery',
    label: 'Grocery & Retail',
    short: 'Grocery',
    icon: ShoppingCart,
    accent: { text: 'text-emerald-700', bg: 'bg-emerald-600', soft: 'bg-emerald-50', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
    modulePath: '/demo/grocery',
    moduleLabel: 'Point of Sale',
    moduleIcon: ShoppingCart,
    customer: 'Customer',
    customers: 'Customers',
    catalogLabel: 'Inventory',
    invoiceTerm: 'Receipt',
    description: 'Fast barcode checkout, live stock deduction and daily sales visibility for marts and retail stores.',
    pitch: 'Checkout in seconds and always know what to reorder.',
    highlights: ['Barcode & SKU search', 'Cash change calculation', 'Automatic stock deduction', 'Low-stock alerts'],
    guide: [
      { title: 'Open the Point of Sale', detail: 'Search “rice”, or type the barcode printed under any product and press Enter.', to: '/demo/grocery' },
      { title: 'Build a basket', detail: 'Add a few items, change quantities and apply a 5% discount.' },
      { title: 'Take payment', detail: 'Choose Cash, enter the amount received and see the change instantly.' },
      { title: 'Complete the sale', detail: 'Print the receipt — stock drops and the dashboard updates.' },
      { title: 'Check inventory', detail: 'Review low-stock alerts and receive new stock.', to: '/demo/products' },
    ],
  },
  clinic: {
    id: 'clinic',
    label: 'Clinic',
    short: 'Clinic',
    icon: Stethoscope,
    accent: { text: 'text-sky-700', bg: 'bg-sky-600', soft: 'bg-sky-50', ring: 'ring-sky-200', dot: 'bg-sky-500' },
    modulePath: '/demo/clinic',
    moduleLabel: 'Clinic Desk',
    moduleIcon: Stethoscope,
    customer: 'Patient',
    customers: 'Patients',
    catalogLabel: 'Services & Fees',
    invoiceTerm: 'Invoice',
    description: 'Patient registration, appointments, itemized consultation and lab billing with partial payments.',
    pitch: 'From front desk to final bill in a few clicks.',
    highlights: ['Patient directory', 'Doctor-wise consultations', 'Lab & procedure charges', 'Balance tracking'],
    guide: [
      { title: 'Open the Clinic Desk', detail: 'See today’s appointments and who is checked in.', to: '/demo/clinic' },
      { title: 'Bill a patient', detail: 'Press “Bill” on an appointment, or start a new invoice and pick a patient.' },
      { title: 'Add charges', detail: 'Add the doctor’s consultation plus a lab test such as CBC.' },
      { title: 'Record a part payment', detail: 'Collect only part of the total to leave an outstanding balance.' },
      { title: 'Settle the balance', detail: 'Open the patient’s history and record the remaining payment.', to: '/demo/customers' },
    ],
  },
  hospital: {
    id: 'hospital',
    label: 'Hospital',
    short: 'Hospital',
    icon: Building2,
    accent: { text: 'text-indigo-700', bg: 'bg-indigo-600', soft: 'bg-indigo-50', ring: 'ring-indigo-200', dot: 'bg-indigo-500' },
    modulePath: '/demo/hospital',
    moduleLabel: 'Hospital Billing',
    moduleIcon: Building2,
    customer: 'Patient',
    customers: 'Patients',
    catalogLabel: 'Tariff & Pharmacy',
    invoiceTerm: 'Bill',
    description: 'Outpatient and inpatient billing across departments, with running admission charges and discharge bills.',
    pitch: 'Department-wise billing with clean discharge settlements.',
    highlights: ['OPD & IPD billing', 'Running admission charges', 'Discharge bills', 'Department reports'],
    guide: [
      { title: 'Create an OPD bill', detail: 'Choose a department and doctor, then add lab and radiology charges.', to: '/demo/hospital' },
      { title: 'Admit a patient', detail: 'Open the Inpatients tab and admit a patient to a room.' },
      { title: 'Post charges', detail: 'Add pharmacy and lab charges to the running admission bill.' },
      { title: 'Discharge & bill', detail: 'Room days are calculated automatically on the final bill.' },
      { title: 'Review collections', detail: 'See today’s collections and department-wise billing.' },
    ],
  },
  salon: {
    id: 'salon',
    label: 'Beauty Salon',
    short: 'Salon',
    icon: Scissors,
    accent: { text: 'text-rose-700', bg: 'bg-rose-600', soft: 'bg-rose-50', ring: 'ring-rose-200', dot: 'bg-rose-500' },
    modulePath: '/demo/salon',
    moduleLabel: 'Salon Desk',
    moduleIcon: Scissors,
    customer: 'Client',
    customers: 'Clients',
    catalogLabel: 'Services & Retail',
    invoiceTerm: 'Invoice',
    description: 'Appointments, service packages, staff assignment, commissions and retail product sales.',
    pitch: 'Bookings, billing and staff commissions in one place.',
    highlights: ['Appointment book', 'Service packages', 'Staff commissions', 'Retail add-ons'],
    guide: [
      { title: 'Book an appointment', detail: 'Pick a client, services, a stylist and a time slot.', to: '/demo/salon' },
      { title: 'Check out', detail: 'Press “Check out” on the booking — services and stylist are pre-filled.' },
      { title: 'Upsell retail', detail: 'Add a retail product and apply a package discount.' },
      { title: 'Take payment', detail: 'Record a card or wallet payment and print the invoice.' },
      { title: 'Review commissions', detail: 'See calculated vs paid commission per staff member.' },
    ],
  },
};

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export function navFor(i: Industry): NavItem[] {
  const c = INDUSTRY_CONFIG[i];
  return [
    { to: '/demo/overview', label: 'Overview', icon: LayoutDashboard },
    { to: c.modulePath, label: c.moduleLabel, icon: c.moduleIcon },
    { to: '/demo/invoices', label: i === 'grocery' ? 'Sales history' : `${c.invoiceTerm}s`, icon: ReceiptText },
    { to: '/demo/customers', label: c.customers, icon: Users },
    { to: '/demo/products', label: c.catalogLabel, icon: i === 'grocery' ? Package : ClipboardList },
    { to: '/demo/reports', label: 'Reports', icon: BarChart3 },
    { to: '/demo/settings', label: 'Settings', icon: Settings },
  ];
}

export const MODULE_INDUSTRY: Record<string, Industry> = {
  '/demo/grocery': 'grocery',
  '/demo/clinic': 'clinic',
  '/demo/hospital': 'hospital',
  '/demo/salon': 'salon',
};
