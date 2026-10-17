import { STATUS_LABEL, amountPaid, invoiceStatus, lineTotal, outstanding } from '@/lib/billing';
import { METHOD_LABEL } from '@/lib/analytics';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { BusinessProfile, Customer, Invoice, IndustryData } from '@/lib/types';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { cn } from '@/lib/utils';

function Logo({ biz, size = 'md' }: { biz: BusinessProfile; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'h-9 w-9 text-xs' : 'h-12 w-12 text-sm';
  if (biz.logoDataUrl) return <img src={biz.logoDataUrl} alt={`${biz.name} logo`} className={cn(dim, 'rounded-lg object-contain')} />;
  return (
    <span className={cn(dim, 'inline-flex items-center justify-center rounded-lg bg-ink-900 font-bold tracking-tight text-white print-keep-bg')}>
      {biz.logoText || biz.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function contactLines(biz: BusinessProfile) {
  return [biz.address, biz.phone && `Tel: ${biz.phone}`, biz.email].filter(Boolean) as string[];
}

interface DocProps {
  invoice: Invoice;
  business: BusinessProfile;
  data: IndustryData;
}

function lookup(data: IndustryData, invoice: Invoice) {
  const customer: Customer | undefined = invoice.customerId ? data.customers.find((c) => c.id === invoice.customerId) : undefined;
  const doctor = invoice.meta?.doctorId ? data.staff.find((s) => s.id === invoice.meta!.doctorId) : undefined;
  const dept = invoice.meta?.departmentId ? data.departments.find((d) => d.id === invoice.meta!.departmentId) : undefined;
  const admission = invoice.meta?.admissionId ? data.admissions.find((a) => a.id === invoice.meta!.admissionId) : undefined;
  const staffName = (id?: string) => (id ? data.staff.find((s) => s.id === id)?.name : undefined);
  return { customer, doctor, dept, admission, staffName };
}

/** A4 invoice — used for screen preview and printing. */
export function InvoiceDocument({ invoice, business, data }: DocProps) {
  const cfg = INDUSTRY_CONFIG[invoice.industry];
  const { customer, doctor, dept, admission, staffName } = lookup(data, invoice);
  const status = invoiceStatus(invoice);
  const paid = amountPaid(invoice);
  const balance = outstanding(invoice);
  const contact = contactLines(business);
  const showStaff = invoice.industry === 'salon';
  const showDept = invoice.industry === 'hospital';

  return (
    <article className="invoice-doc relative mx-auto w-full max-w-[794px] bg-white text-[13px] text-ink-800">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex items-start gap-3">
          <Logo biz={business} />
          <div>
            <p className="text-lg font-semibold text-ink-900">{business.name}</p>
            {contact.length > 0 ? (
              contact.map((l) => (
                <p key={l} className="text-xs text-ink-500">
                  {l}
                </p>
              ))
            ) : (
              <p className="text-xs text-ink-400 no-print">Add address & contact details in Settings</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold uppercase tracking-wide text-ink-900">{cfg.invoiceTerm}</p>
          <p className="mt-1 font-mono text-sm text-ink-700">{invoice.number}</p>
          <p className="mt-2 inline-block rounded border border-ink-300 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-700">
            {STATUS_LABEL[status]}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 border-y border-ink-200 py-4 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Billed to</p>
          <p className="mt-1 font-medium text-ink-900">{invoice.customerName}</p>
          {customer && (
            <>
              <p className="text-xs text-ink-500">
                {cfg.customer} ID: {customer.code}
              </p>
              <p className="text-xs text-ink-500">{customer.phone}</p>
            </>
          )}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Details</p>
          <dl className="mt-1 space-y-0.5 text-xs">
            <div className="flex gap-2">
              <dt className="w-20 text-ink-500">Issued</dt>
              <dd className="text-ink-800">{formatDateTime(invoice.createdAt)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 text-ink-500">Due</dt>
              <dd className="text-ink-800">{formatDate(invoice.dueDate)}</dd>
            </div>
            {invoice.meta?.visitType && (
              <div className="flex gap-2">
                <dt className="w-20 text-ink-500">Visit</dt>
                <dd className="text-ink-800">{invoice.meta.visitType === 'IPD' ? 'Inpatient' : 'Outpatient'}</dd>
              </div>
            )}
          </dl>
        </div>
        <div>
          {(doctor || dept || admission) && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Reference</p>
              <dl className="mt-1 space-y-0.5 text-xs">
                {doctor && (
                  <div className="flex gap-2">
                    <dt className="w-20 text-ink-500">Doctor</dt>
                    <dd className="text-ink-800">{doctor.name}</dd>
                  </div>
                )}
                {dept && (
                  <div className="flex gap-2">
                    <dt className="w-20 text-ink-500">Department</dt>
                    <dd className="text-ink-800">{dept.name}</dd>
                  </div>
                )}
                {admission && (
                  <div className="flex gap-2">
                    <dt className="w-20 text-ink-500">Admission</dt>
                    <dd className="text-ink-800">
                      {admission.number} · {admission.roomType}
                    </dd>
                  </div>
                )}
              </dl>
            </>
          )}
        </div>
      </div>

      <table className="mt-4 w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-ink-300 text-[11px] uppercase tracking-wide text-ink-500">
            <th className="py-2 pr-2 font-semibold">#</th>
            <th className="py-2 pr-2 font-semibold">Description</th>
            <th className="py-2 pr-2 text-right font-semibold">Qty</th>
            <th className="py-2 pr-2 text-right font-semibold">Unit price</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((l, idx) => {
            const deptName = showDept && l.departmentId ? data.departments.find((d) => d.id === l.departmentId)?.code : undefined;
            const staff = showStaff ? staffName(l.staffId) : undefined;
            return (
              <tr key={l.id} className="border-b border-ink-100 align-top">
                <td className="py-2 pr-2 text-ink-400 tabular-nums">{idx + 1}</td>
                <td className="py-2 pr-2">
                  <p className="text-ink-900">{l.description}</p>
                  {(l.category || deptName || staff) && (
                    <p className="text-[11px] text-ink-500">{[l.category, deptName, staff && `by ${staff}`].filter(Boolean).join(' · ')}</p>
                  )}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">{l.quantity}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{formatMoney(l.unitPrice)}</td>
                <td className="py-2 text-right font-medium tabular-nums text-ink-900">{formatMoney(lineTotal(l))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-4 flex flex-col-reverse gap-6 sm:flex-row sm:justify-between">
        <div className="max-w-sm space-y-3 text-xs text-ink-600">
          {invoice.payments.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Payments (simulated)</p>
              <ul className="mt-1 space-y-0.5">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="tabular-nums">
                    {formatDate(p.date)} · {METHOD_LABEL[p.method]}
                    {p.reference ? ` · Ref ${p.reference}` : ''} · {formatMoney(p.amount)}
                    {p.change ? ` (change ${formatMoney(p.change)})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {invoice.notes && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Notes</p>
              <p className="mt-1 whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
          {business.paymentInstructions && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Payment instructions</p>
              <p className="mt-1">{business.paymentInstructions}</p>
            </div>
          )}
        </div>
        <dl className="w-full space-y-1.5 text-[13px] sm:w-72">
          <Row label="Subtotal" value={formatMoney(invoice.subtotal)} />
          {invoice.discountAmount > 0 && (
            <Row
              label={`Discount${invoice.discount.type === 'percent' ? ` (${invoice.discount.value}%)` : ''}`}
              value={`− ${formatMoney(invoice.discountAmount)}`}
            />
          )}
          {invoice.taxAmount > 0 && <Row label={`${invoice.taxLabel} (${invoice.taxRate}%)`} value={formatMoney(invoice.taxAmount)} />}
          <div className="border-t border-ink-300 pt-1.5">
            <Row label="Total" value={formatMoney(invoice.total)} strong />
          </div>
          <Row label="Amount paid" value={formatMoney(paid)} />
          <div className={cn('rounded-md px-2 py-1.5', balance > 0 ? 'bg-amber-50 print-keep-bg' : 'bg-emerald-50 print-keep-bg')}>
            <Row label="Balance due" value={formatMoney(balance)} strong />
          </div>
        </dl>
      </div>

      <footer className="mt-8 border-t border-ink-200 pt-3 text-center text-[11px] text-ink-500">
        {business.footerNote && <p>{business.footerNote}</p>}
        <p className="mt-1 font-medium text-ink-600">
          Demo document generated by a billing prototype — simulated transaction, not a tax invoice and no real payment was processed.
        </p>
      </footer>
    </article>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? 'font-semibold text-ink-900' : 'text-ink-500'}>{label}</dt>
      <dd className={cn('tabular-nums', strong ? 'text-base font-semibold text-ink-900' : 'text-ink-800')}>{value}</dd>
    </div>
  );
}

/** 80 mm thermal-style receipt, for POS. */
export function ThermalReceipt({ invoice, business, data }: DocProps) {
  const paid = amountPaid(invoice);
  const balance = outstanding(invoice);
  const contact = contactLines(business);
  const cashier = data.staff.find((s) => s.role === 'Cashier');
  return (
    <article className="receipt-doc mx-auto w-[300px] bg-white p-4 font-mono text-[11.5px] leading-snug text-ink-900">
      <div className="text-center">
        <p className="text-sm font-bold">{business.name}</p>
        {contact.map((l) => (
          <p key={l}>{l}</p>
        ))}
        <p className="mt-1">SALES RECEIPT</p>
      </div>
      <div className="my-2 border-t border-dashed border-ink-400" />
      <p>No: {invoice.number}</p>
      <p>Date: {formatDateTime(invoice.createdAt)}</p>
      <p>Customer: {invoice.customerName}</p>
      {cashier && <p>Cashier: {cashier.name}</p>}
      <div className="my-2 border-t border-dashed border-ink-400" />
      {invoice.items.map((l) => (
        <div key={l.id} className="mb-1">
          <p className="truncate">{l.description}</p>
          <div className="flex justify-between tabular-nums">
            <span>
              {l.quantity} × {formatMoney(l.unitPrice)}
            </span>
            <span>{formatMoney(lineTotal(l))}</span>
          </div>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-ink-400" />
      <RRow l="Subtotal" v={formatMoney(invoice.subtotal)} />
      {invoice.discountAmount > 0 && <RRow l="Discount" v={`-${formatMoney(invoice.discountAmount)}`} />}
      {invoice.taxAmount > 0 && <RRow l={`${invoice.taxLabel} ${invoice.taxRate}%`} v={formatMoney(invoice.taxAmount)} />}
      <div className="text-sm font-bold">
        <RRow l="TOTAL" v={formatMoney(invoice.total)} />
      </div>
      <div className="my-2 border-t border-dashed border-ink-400" />
      {invoice.payments.map((p) => (
        <div key={p.id}>
          <RRow l={`Paid (${METHOD_LABEL[p.method]})`} v={formatMoney(p.amount)} />
          {p.tendered !== undefined && <RRow l="Cash received" v={formatMoney(p.tendered)} />}
          {p.change !== undefined && <RRow l="Change" v={formatMoney(p.change)} />}
        </div>
      ))}
      {balance > 0 && <RRow l="Balance due" v={formatMoney(balance)} />}
      {paid === 0 && <p>Unpaid</p>}
      <div className="my-2 border-t border-dashed border-ink-400" />
      <p className="text-center">{business.footerNote}</p>
      {business.paymentInstructions && <p className="mt-1 text-center text-[10.5px]">{business.paymentInstructions}</p>}
      <p className="mt-2 text-center text-[10px]">*** DEMO RECEIPT — SIMULATED SALE ***</p>
    </article>
  );
}

function RRow({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 tabular-nums">
      <span>{l}</span>
      <span>{v}</span>
    </div>
  );
}
