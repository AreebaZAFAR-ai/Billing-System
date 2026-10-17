import { useId, useMemo, useRef, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import type { Customer, Industry } from '@/lib/types';
import { useStore } from '@/store/store';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { customerBalance } from '@/lib/analytics';
import { formatMoney } from '@/lib/money';
import { Avatar, Badge } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Field';
import { CustomerFormModal } from './CustomerForm';
import { cn } from '@/lib/utils';

export function matchCustomer(c: Customer, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s) || c.phone.replace(/\D/g, '').includes(s.replace(/\D/g, '') || '###');
}

export function CustomerPicker({
  industry,
  value,
  onChange,
  allowWalkIn,
  locked,
}: {
  industry: Industry;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  allowWalkIn?: boolean;
  locked?: boolean;
}) {
  const cfg = INDUSTRY_CONFIG[industry];
  const data = useStore((s) => s.data[industry]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = value ? data.customers.find((c) => c.id === value) : undefined;
  const results = useMemo(() => data.customers.filter((c) => matchCustomer(c, q)).slice(0, 8), [data.customers, q]);
  const balance = useMemo(() => (selected ? customerBalance(data.invoices, selected.id) : null), [selected, data.invoices]);

  if (selected) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-ink-50/50 p-3">
        <Avatar name={selected.name} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900">{selected.name}</p>
          <p className="truncate text-xs text-ink-500">
            {selected.code} · {selected.phone}
            {selected.age ? ` · ${selected.age}y` : ''}
            {selected.gender ? ` · ${selected.gender}` : ''}
          </p>
          {balance && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge tone="neutral">{balance.invoices.length} visits</Badge>
              {balance.outstanding > 0 ? (
                <Badge tone="warning">Balance {formatMoney(balance.outstanding)}</Badge>
              ) : (
                <Badge tone="success">No balance due</Badge>
              )}
            </div>
          )}
        </div>
        {!locked && (
          <IconButton label={`Change ${cfg.customer.toLowerCase()}`} onClick={() => onChange(undefined)}>
            <X className="h-4 w-4" />
          </IconButton>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <SearchInput
          ref={inputRef}
          wrapperClassName="flex-1"
          label={`Search ${cfg.customers.toLowerCase()}`}
          placeholder={`Search ${cfg.customers.toLowerCase()} by name, ID or phone`}
          value={q}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter' && results[active]) {
              e.preventDefault();
              onChange(results[active].id);
              setQ('');
            }
          }}
        />
        <Button variant="secondary" icon={<UserPlus className="h-4 w-4" />} onClick={() => setRegistering(true)}>
          <span className="hidden sm:inline">New</span>
        </Button>
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-ink-200 bg-white py-1 shadow-pop">
          {allowWalkIn && (
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-ink-600 hover:bg-ink-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
              >
                Walk-in customer (no record)
              </button>
            </li>
          )}
          {results.length === 0 && <li className="px-3 py-3 text-sm text-ink-500">No matches. Register a new {cfg.customer.toLowerCase()}.</li>}
          {results.map((c, idx) => (
            <li key={c.id} role="option" aria-selected={idx === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c.id);
                  setQ('');
                  setOpen(false);
                }}
                className={cn('flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink-50', idx === active && 'bg-ink-50')}
              >
                <Avatar name={c.name} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-900">{c.name}</span>
                  <span className="block truncate text-xs text-ink-500">
                    {c.code} · {c.phone}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <CustomerFormModal
        industry={industry}
        open={registering}
        onClose={() => setRegistering(false)}
        onSaved={(c) => onChange(c.id)}
      />
    </div>
  );
}
