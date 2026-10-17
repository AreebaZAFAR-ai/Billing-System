import { STATUS_LABEL, invoiceStatus } from '@/lib/billing';
import type { Invoice, InvoiceStatus } from '@/lib/types';
import { Badge } from '@/components/ui/Card';

const TONE: Record<InvoiceStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  paid: 'success',
  partial: 'warning',
  unpaid: 'neutral',
  overdue: 'danger',
};

export function StatusBadge({ invoice, status }: { invoice?: Invoice; status?: InvoiceStatus }) {
  const s = status ?? invoiceStatus(invoice!);
  return (
    <Badge tone={TONE[s]} dot>
      {STATUS_LABEL[s]}
    </Badge>
  );
}
