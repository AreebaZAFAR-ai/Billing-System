/**
 * Shared billing engine. Every screen that creates, totals or pays an invoice goes through here.
 * All money is integer minor units — never floats.
 */
import { percentOf, sumMoney } from './money';
import type {
  Discount,
  Invoice,
  InvoiceStatus,
  LineItem,
  Money,
  Payment,
} from './types';
import { startOfDay } from './dates';

export interface TotalsInput {
  items: Pick<LineItem, 'quantity' | 'unitPrice'>[];
  discount: Discount;
  taxRate: number;
  taxEnabled?: boolean;
}

export interface Totals {
  subtotal: Money;
  discountAmount: Money;
  taxableAmount: Money;
  taxAmount: Money;
  total: Money;
}

export const MAX_QTY = 9999;

/**
 * Calculated amounts (percentage discounts, tax, commission) are rounded to the nearest whole
 * currency unit — the usual practice for PKR billing — so invoices never show stray paisa.
 */
export const ROUND_UNIT = 100;
export const roundToUnit = (minor: Money) => Math.sign(minor) * Math.round(Math.abs(minor) / ROUND_UNIT) * ROUND_UNIT;

export function lineTotal(item: Pick<LineItem, 'quantity' | 'unitPrice'>): Money {
  return Math.round(item.quantity * item.unitPrice);
}

export function discountAmountFor(subtotal: Money, discount: Discount): Money {
  if (!discount || !Number.isFinite(discount.value) || discount.value <= 0) return 0;
  const raw =
    discount.type === 'percent'
      ? roundToUnit(percentOf(subtotal, Math.min(discount.value, 100)))
      : Math.round(discount.value);
  return Math.max(0, Math.min(raw, subtotal));
}

/**
 * Subtotal = Σ line totals
 * Grand total = Subtotal − Discount + Tax (tax applied to the discounted amount)
 */
export function computeTotals({ items, discount, taxRate, taxEnabled = true }: TotalsInput): Totals {
  const subtotal = sumMoney(items.map(lineTotal));
  const discountAmount = discountAmountFor(subtotal, discount);
  const taxableAmount = subtotal - discountAmount;
  const rate = taxEnabled && Number.isFinite(taxRate) && taxRate > 0 ? taxRate : 0;
  const taxAmount = roundToUnit(percentOf(taxableAmount, rate));
  return { subtotal, discountAmount, taxableAmount, taxAmount, total: taxableAmount + taxAmount };
}

export function amountPaid(inv: Pick<Invoice, 'payments'>): Money {
  return sumMoney(inv.payments.map((p) => p.amount));
}

export function outstanding(inv: Pick<Invoice, 'payments' | 'total'>): Money {
  return Math.max(0, inv.total - amountPaid(inv));
}

export function invoiceStatus(inv: Invoice, now: Date = new Date()): InvoiceStatus {
  const paid = amountPaid(inv);
  if (paid >= inv.total) return 'paid';
  if (new Date(inv.dueDate) < startOfDay(now)) return 'overdue';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  paid: 'Paid',
  partial: 'Partially paid',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
};

export function netSales(inv: Pick<Invoice, 'subtotal' | 'discountAmount'>): Money {
  return inv.subtotal - inv.discountAmount;
}

export function estimatedCost(inv: Pick<Invoice, 'items'>): Money {
  return sumMoney(inv.items.map((i) => Math.round((i.unitCost ?? 0) * i.quantity)));
}

/**
 * Commission on a single line. `gross` uses the line total; `net` shares the invoice discount
 * proportionally before applying the staff rate.
 */
export function lineCommission(inv: Invoice, item: LineItem, basis: 'gross' | 'net'): Money {
  if (!item.staffId || !item.commissionRate) return 0;
  const gross = lineTotal(item);
  let base = gross;
  if (basis === 'net' && inv.subtotal > 0) {
    base = gross - Math.round((inv.discountAmount * gross) / inv.subtotal);
  }
  return roundToUnit(percentOf(base, item.commissionRate));
}

export function invoiceCommission(inv: Invoice, basis: 'gross' | 'net'): Money {
  return sumMoney(inv.items.map((i) => lineCommission(inv, i, basis)));
}

export interface LineValidation {
  ok: boolean;
  errors: string[];
}

export function validateLines(items: LineItem[]): LineValidation {
  const errors: string[] = [];
  if (items.length === 0) errors.push('Add at least one item.');
  items.forEach((i) => {
    if (!Number.isInteger(i.quantity) || i.quantity <= 0)
      errors.push(`"${i.description}": quantity must be a whole number above zero.`);
    else if (i.quantity > MAX_QTY) errors.push(`"${i.description}": quantity is too large.`);
    if (!Number.isFinite(i.unitPrice) || i.unitPrice < 0)
      errors.push(`"${i.description}": price cannot be negative.`);
  });
  return { ok: errors.length === 0, errors };
}

export function validateDiscount(discount: Discount, subtotal: Money): string | null {
  if (!Number.isFinite(discount.value) || discount.value < 0) return 'Discount cannot be negative.';
  if (discount.type === 'percent' && discount.value > 100) return 'Discount cannot exceed 100%.';
  if (discount.type === 'fixed' && discount.value > subtotal) return 'Discount cannot exceed the subtotal.';
  return null;
}

/** Returns an error message or null. Payments must be positive and cannot exceed the balance. */
export function validatePayment(balance: Money, amount: Money): string | null {
  if (!Number.isFinite(amount) || Number.isNaN(amount)) return 'Enter a valid amount.';
  if (amount <= 0) return 'Payment must be greater than zero.';
  if (amount > balance) return 'Payment cannot exceed the outstanding balance.';
  return null;
}

export function applyPayment(inv: Invoice, payment: Payment): Invoice {
  const err = validatePayment(outstanding(inv), payment.amount);
  if (err) throw new Error(err);
  return { ...inv, payments: [...inv.payments, payment] };
}

export function formatInvoiceNumber(prefix: string, seq: number, date: Date = new Date()): string {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${prefix}-${yy}${mm}-${String(seq).padStart(5, '0')}`;
}

/** Recompute stored totals from items — used when building and when repairing stored data. */
export function withTotals<T extends Omit<Invoice, 'subtotal' | 'discountAmount' | 'taxAmount' | 'total'>>(
  inv: T,
): T & Totals {
  const t = computeTotals({ items: inv.items, discount: inv.discount, taxRate: inv.taxRate });
  return { ...inv, ...t };
}
