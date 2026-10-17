import { outstanding } from '@/lib/billing';
import { formatDate, formatTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Invoice } from '@/lib/types';
import { Table, Td, Th } from '@/components/ui/Table';
import { StatusBadge } from './StatusBadge';

/** Compact invoice list used on dashboards and detail panels. */
export function InvoiceMiniTable({ invoices, onOpen, showCustomer = true }: { invoices: Invoice[]; onOpen: (inv: Invoice) => void; showCustomer?: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Invoice</Th>
          {showCustomer && <Th>Customer</Th>}
          <Th className="hidden sm:table-cell">Date</Th>
          <Th align="right">Total</Th>
          <Th align="right" className="hidden md:table-cell">
            Balance
          </Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((inv) => (
          <tr key={inv.id} className="cursor-pointer hover:bg-ink-50/70" onClick={() => onOpen(inv)}>
            <Td>
              <button
                type="button"
                className="whitespace-nowrap font-mono text-[13px] font-medium text-brand-700 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(inv);
                }}
              >
                {inv.number}
              </button>
            </Td>
            {showCustomer && <Td className="max-w-[180px] truncate text-ink-900">{inv.customerName}</Td>}
            <Td className="hidden whitespace-nowrap text-ink-500 sm:table-cell">
              {formatDate(inv.createdAt)} <span className="text-ink-400">{formatTime(inv.createdAt)}</span>
            </Td>
            <Td align="right" className="font-medium text-ink-900">
              {formatMoney(inv.total)}
            </Td>
            <Td align="right" className="hidden md:table-cell">
              {outstanding(inv) > 0 ? <span className="text-amber-700">{formatMoney(outstanding(inv))}</span> : <span className="text-ink-400">—</span>}
            </Td>
            <Td>
              <StatusBadge invoice={inv} />
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
