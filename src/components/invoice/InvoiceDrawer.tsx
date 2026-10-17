import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Printer, Wallet } from 'lucide-react';
import { outstanding } from '@/lib/billing';
import type { Industry } from '@/lib/types';
import { useStore } from '@/store/store';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Modal';
import { InvoiceDocument, ThermalReceipt } from './InvoiceDocument';
import { PaymentModal } from './PaymentModal';
import { printInvoice } from './Print';
import { StatusBadge } from './StatusBadge';

export function InvoiceDrawer({
  industry,
  invoiceId,
  onClose,
  receipt,
}: {
  industry: Industry;
  invoiceId: string | null;
  onClose: () => void;
  receipt?: boolean;
}) {
  const data = useStore((s) => s.data[industry]);
  const business = useStore((s) => s.settings.businesses[industry]);
  const [paying, setPaying] = useState(false);
  const invoice = invoiceId ? data.invoices.find((i) => i.id === invoiceId) : undefined;
  if (!invoice) return null;
  const balance = outstanding(invoice);
  return (
    <>
      <Drawer
        open={!!invoice}
        onClose={onClose}
        width="max-w-3xl"
        title={invoice.number}
        description={
          <span className="flex items-center gap-2">
            {invoice.customerName} <StatusBadge invoice={invoice} />
          </span>
        }
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Link
              to={`/demo/invoices/${invoice.id}`}
              onClick={onClose}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-600 hover:bg-ink-100"
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> Full page
            </Link>
            <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={() => printInvoice(industry, invoice.id, receipt ? 'thermal' : undefined)}>
              Print
            </Button>
            {balance > 0 && (
              <Button icon={<Wallet className="h-4 w-4" />} onClick={() => setPaying(true)}>
                Record payment
              </Button>
            )}
          </>
        }
      >
        <div className="bg-ink-100/70 p-3 sm:p-6">
          <div className="overflow-hidden rounded-lg bg-white p-5 shadow-card sm:p-8">
            {receipt ? (
              <ThermalReceipt invoice={invoice} business={business} data={data} />
            ) : (
              <InvoiceDocument invoice={invoice} business={business} data={data} />
            )}
          </div>
        </div>
      </Drawer>
      <PaymentModal invoice={invoice} open={paying} onClose={() => setPaying(false)} />
    </>
  );
}
