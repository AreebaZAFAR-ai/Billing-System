import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { useStore } from '@/store/store';
import type { Industry } from '@/lib/types';
import { InvoiceDocument, ThermalReceipt } from './InvoiceDocument';

interface PrintJob {
  industry: Industry;
  invoiceId: string;
  format: 'a4' | 'thermal';
  nonce: number;
}

const usePrintJob = create<{ job: PrintJob | null; set: (j: PrintJob | null) => void }>((set) => ({
  job: null,
  set: (job) => set({ job }),
}));

/** Queue an invoice for browser printing (use "Save as PDF" in the print dialog for a PDF). */
export function printInvoice(industry: Industry, invoiceId: string, format?: 'a4' | 'thermal') {
  const fmt = format ?? (industry === 'grocery' ? useStore.getState().settings.global.receiptFormat : 'a4');
  usePrintJob.getState().set({ industry, invoiceId, format: fmt, nonce: Date.now() });
}

export function PrintHost() {
  const job = usePrintJob((s) => s.job);
  const clear = usePrintJob((s) => s.set);
  const data = useStore((s) => (job ? s.data[job.industry] : null));
  const business = useStore((s) => (job ? s.settings.businesses[job.industry] : null));
  const invoice = job && data ? data.invoices.find((i) => i.id === job.invoiceId) : undefined;

  useEffect(() => {
    if (!job || !invoice) return;
    document.body.classList.add('is-printing', job.format === 'thermal' ? 'print-thermal' : 'print-a4');
    const done = () => {
      document.body.classList.remove('is-printing', 'print-thermal', 'print-a4');
      clear(null);
    };
    window.addEventListener('afterprint', done, { once: true });
    // The portal is committed before effects run, so the document is ready to print.
    window.print();
    return () => window.removeEventListener('afterprint', done);
  }, [job, invoice, clear]);

  const root = typeof document !== 'undefined' ? document.getElementById('print-root') : null;
  if (!job || !invoice || !data || !business || !root) return null;
  return createPortal(
    job.format === 'thermal' ? (
      <ThermalReceipt invoice={invoice} business={business} data={data} />
    ) : (
      <InvoiceDocument invoice={invoice} business={business} data={data} />
    ),
    root,
  );
}
