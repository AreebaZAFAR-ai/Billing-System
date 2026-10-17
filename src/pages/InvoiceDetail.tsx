import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileQuestion, Printer, Receipt, Wallet } from 'lucide-react';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { METHOD_LABEL } from '@/lib/analytics';
import { amountPaid, outstanding } from '@/lib/billing';
import { formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { INDUSTRIES } from '@/lib/types';
import { useStore } from '@/store/store';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Badge, Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { InvoiceDocument } from '@/components/invoice/InvoiceDocument';
import { PaymentModal } from '@/components/invoice/PaymentModal';
import { printInvoice } from '@/components/invoice/Print';
import { StatusBadge } from '@/components/invoice/StatusBadge';

export default function InvoiceDetail() {
  const { id } = useParams();
  const all = useStore((s) => s.data);
  const settings = useStore((s) => s.settings);
  const [paying, setPaying] = useState(false);
  const industry = INDUSTRIES.find((i) => all[i].invoices.some((x) => x.id === id));
  const invoice = industry ? all[industry].invoices.find((x) => x.id === id) : undefined;
  const active = useStore((s) => s.activeIndustry);
  const setActive = useStore((s) => s.setActiveIndustry);
  // Deep links to another industry's invoice switch the demo context to match.
  useEffect(() => {
    if (industry && industry !== active) setActive(industry);
  }, [industry, active, setActive]);

  if (!industry || !invoice) {
    return (
      <Card>
        <EmptyState
          icon={FileQuestion}
          title="Invoice not found"
          description="It may have been removed by a demo reset."
          action={<ButtonLink to="/demo/invoices">Back to invoices</ButtonLink>}
        />
      </Card>
    );
  }
  const cfg = INDUSTRY_CONFIG[industry];
  const data = all[industry];
  const biz = settings.businesses[industry];
  const balance = outstanding(invoice);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: cfg.label, to: '/demo/overview' },
          { label: industry === 'grocery' ? 'Sales history' : `${cfg.invoiceTerm}s`, to: '/demo/invoices' },
          { label: invoice.number },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{invoice.number}</span> <StatusBadge invoice={invoice} />
          </span>
        }
        description={`${invoice.customerName} · ${formatDateTime(invoice.createdAt)}`}
        actions={
          <>
            {industry === 'grocery' && (
              <Button variant="secondary" icon={<Receipt className="h-4 w-4" />} onClick={() => printInvoice(industry, invoice.id, 'thermal')}>
                Print receipt
              </Button>
            )}
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => printInvoice(industry, invoice.id, 'a4')}>
              Print / Save PDF
            </Button>
            {balance > 0 && (
              <Button icon={<Wallet className="h-4 w-4" />} onClick={() => setPaying(true)}>
                Record payment
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="bg-ink-100/60 p-3 sm:p-6">
            <div className="rounded-lg bg-white p-5 shadow-card sm:p-10">
              <InvoiceDocument invoice={invoice} business={biz} data={data} />
            </div>
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Balance" />
            <dl className="space-y-2 p-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Total</dt>
                <dd className="font-medium tabular-nums">{formatMoney(invoice.total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Paid</dt>
                <dd className="tabular-nums text-emerald-700">{formatMoney(amountPaid(invoice))}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-100 pt-2">
                <dt className="font-medium text-ink-900">Outstanding</dt>
                <dd className={balance > 0 ? 'font-semibold tabular-nums text-amber-700' : 'font-semibold tabular-nums text-ink-900'}>{formatMoney(balance)}</dd>
              </div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Payment history" description="Simulated payments" />
            {invoice.payments.length === 0 ? (
              <EmptyState title="No payments yet" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {invoice.payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{formatMoney(p.amount)}</p>
                      <p className="text-xs text-ink-500">{formatDateTime(p.date)}</p>
                      {p.reference && <p className="text-xs text-ink-500">Ref {p.reference}</p>}
                      {p.change ? <p className="text-xs text-ink-500">Cash {formatMoney(p.tendered ?? 0)} · change {formatMoney(p.change)}</p> : null}
                    </div>
                    <Badge>{METHOD_LABEL[p.method]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {invoice.customerId && (
            <Link to="/demo/customers" className="block text-center text-sm font-medium text-brand-700 hover:text-brand-800">
              View {cfg.customers.toLowerCase()} directory
            </Link>
          )}
        </div>
      </div>
      <PaymentModal invoice={invoice} open={paying} onClose={() => setPaying(false)} />
    </>
  );
}
