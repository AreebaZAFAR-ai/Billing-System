import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, PackagePlus, Pencil, PackageOpen, Boxes } from 'lucide-react';
import { INDUSTRY_CONFIG } from '@/config/industries';
import { formatMoney, toMajorString, toMinor } from '@/lib/money';
import type { CatalogItem, CatalogKind } from '@/lib/types';
import { useStore } from '@/store/store';
import { downloadFile, formatPercent, toCSV, uid } from '@/lib/utils';
import { toDateKey } from '@/lib/dates';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState, StatCard } from '@/components/ui/Card';
import { Checkbox, Field, Input, MoneyInput, SearchInput, Segmented, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Pagination, Table, Td, Th } from '@/components/ui/Table';
import { toast } from '@/components/ui/Toast';

const PAGE = 20;

function stockState(c: CatalogItem): 'out' | 'low' | 'ok' | 'na' {
  if (!c.trackStock) return 'na';
  if ((c.stock ?? 0) <= 0) return 'out';
  if ((c.stock ?? 0) <= (c.reorderLevel ?? 0)) return 'low';
  return 'ok';
}

export default function Products() {
  const industry = useStore((s) => s.activeIndustry);
  const data = useStore((s) => s.data[industry]);
  const cfg = INDUSTRY_CONFIG[industry];
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'tracked'>('all');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CatalogItem | 'new' | null>(null);
  const [adjusting, setAdjusting] = useState<CatalogItem | null>(null);

  const categories = useMemo(() => Array.from(new Set(data.catalog.map((c) => c.category))), [data.catalog]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.catalog.filter((c) => {
      if (cat && c.category !== cat) return false;
      if (stockFilter === 'tracked' && !c.trackStock) return false;
      if (stockFilter === 'low' && !['low', 'out'].includes(stockState(c))) return false;
      return !s || c.name.toLowerCase().includes(s) || c.sku?.toLowerCase().includes(s) || c.barcode?.includes(s);
    });
  }, [data.catalog, q, cat, stockFilter]);

  const tracked = data.catalog.filter((c) => c.trackStock);
  const low = tracked.filter((c) => stockState(c) === 'low').length;
  const out = tracked.filter((c) => stockState(c) === 'out').length;
  const stockValue = tracked.reduce((a, c) => a + (c.stock ?? 0) * (c.cost ?? 0), 0);
  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);

  const exportCSV = () =>
    downloadFile(
      `${industry}-catalog-${toDateKey(new Date())}.csv`,
      toCSV(
        ['SKU', 'Barcode', 'Name', 'Type', 'Category', 'Price', 'Est. cost', 'Stock', 'Reorder level', 'Active'],
        rows.map((c) => [c.sku ?? '', c.barcode ?? '', c.name, c.kind, c.category, toMajorString(c.price), c.cost !== undefined ? toMajorString(c.cost) : '', c.trackStock ? c.stock : '', c.reorderLevel ?? '', c.active ? 'yes' : 'no']),
      ),
    );

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: cfg.label, to: '/demo/overview' }, { label: cfg.catalogLabel }]}
        title={cfg.catalogLabel}
        description={
          industry === 'grocery'
            ? 'Products, prices and live stock levels. Sales deduct stock automatically.'
            : industry === 'hospital'
              ? 'Department tariff and pharmacy stock. Pharmacy items deduct stock when billed.'
              : industry === 'salon'
                ? 'Services, packages and retail products. Retail sales deduct stock automatically.'
                : 'Consultation, procedure and laboratory fees used when billing patients.'
        }
        actions={
          <>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCSV}>
              Export CSV
            </Button>
            <Button icon={<PackagePlus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              Add item
            </Button>
          </>
        }
      />
      {tracked.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Stock-tracked items" value={tracked.length} icon={Boxes} />
          <StatCard label="Low stock" value={low} icon={AlertTriangle} tone={low ? 'warning' : 'success'} />
          <StatCard label="Out of stock" value={out} icon={PackageOpen} tone={out ? 'danger' : 'success'} />
          <StatCard label="Stock value at cost" value={formatMoney(stockValue)} sub="Estimated" icon={Boxes} />
        </div>
      )}
      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 md:flex-row md:items-center">
          <SearchInput
            wrapperClassName="md:w-72"
            placeholder="Name, SKU or barcode"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <label htmlFor="prod-cat" className="sr-only">
            Category
          </label>
          <Select
            id="prod-cat"
            className="md:w-48"
            value={cat}
            onChange={(e) => {
              setCat(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          {tracked.length > 0 && (
            <Segmented
              label="Stock filter"
              size="sm"
              value={stockFilter}
              onChange={(v) => {
                setStockFilter(v);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All' },
                { value: 'tracked', label: 'Stocked' },
                { value: 'low', label: `Low / out (${low + out})` },
              ]}
            />
          )}
        </div>
        {rows.length === 0 ? (
          <EmptyState title="No items match" description="Adjust the search or filters." />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th className="hidden md:table-cell">Category</Th>
                  <Th align="right">Price</Th>
                  <Th align="right" className="hidden lg:table-cell">
                    Est. margin
                  </Th>
                  <Th align="right">Stock</Th>
                  <Th align="right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((c) => {
                  const st = stockState(c);
                  const margin = c.cost !== undefined && c.price > 0 ? ((c.price - c.cost) / c.price) * 100 : null;
                  return (
                    <tr key={c.id} className={c.active ? '' : 'opacity-60'}>
                      <Td>
                        <p className="font-medium text-ink-900">{c.name}</p>
                        <p className="font-mono text-[11px] text-ink-500">
                          {c.sku}
                          {c.barcode ? ` · ${c.barcode}` : ''}
                          {c.kind === 'package' ? ' · package' : ''}
                          {!c.active ? ' · inactive' : ''}
                        </p>
                      </Td>
                      <Td className="hidden md:table-cell">
                        {c.category}
                        {c.departmentId && <p className="text-xs text-ink-500">{data.departments.find((d) => d.id === c.departmentId)?.name}</p>}
                      </Td>
                      <Td align="right" className="font-medium text-ink-900">
                        {formatMoney(c.price)}
                      </Td>
                      <Td align="right" className="hidden lg:table-cell">
                        {margin !== null ? formatPercent(margin, 0) : '—'}
                      </Td>
                      <Td align="right">
                        {st === 'na' ? (
                          <span className="text-ink-400">Service</span>
                        ) : (
                          <Badge tone={st === 'out' ? 'danger' : st === 'low' ? 'warning' : 'success'}>
                            {st === 'out' ? 'Out' : `${c.stock} ${c.unit ?? ''}`.trim()}
                            {st === 'low' && ' · low'}
                          </Badge>
                        )}
                      </Td>
                      <Td align="right">
                        <div className="flex justify-end gap-1">
                          {c.trackStock && (
                            <Button size="xs" variant="secondary" onClick={() => setAdjusting(c)}>
                              Stock
                            </Button>
                          )}
                          <Button size="xs" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}>
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE} total={rows.length} onPage={setPage} />
          </>
        )}
      </Card>
      {editing && <ItemModal item={editing === 'new' ? undefined : editing} categories={categories} onClose={() => setEditing(null)} />}
      {adjusting && <StockModal item={adjusting} onClose={() => setAdjusting(null)} />}
    </>
  );
}

function ItemModal({ item, categories, onClose }: { item?: CatalogItem; categories: string[]; onClose: () => void }) {
  const industry = useStore((s) => s.activeIndustry);
  const upsert = useStore((s) => s.upsertCatalogItem);
  const catalog = useStore((s) => s.data[industry].catalog);
  const defaultKind: CatalogKind = industry === 'grocery' ? 'product' : 'service';
  const [f, setF] = useState<{
    name: string;
    category: string;
    kind: CatalogKind;
    price: string;
    cost: string;
    sku: string;
    barcode: string;
    stock: string;
    reorder: string;
    trackStock: boolean;
    active: boolean;
  }>({
    name: '',
    category: categories[0] ?? 'General',
    kind: defaultKind,
    price: '',
    cost: '',
    sku: '',
    barcode: '',
    stock: '0',
    reorder: '5',
    trackStock: industry === 'grocery',
    active: true,
  });
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (item)
      setF({
        name: item.name,
        category: item.category,
        kind: item.kind,
        price: toMajorString(item.price),
        cost: item.cost !== undefined ? toMajorString(item.cost) : '',
        sku: item.sku ?? '',
        barcode: item.barcode ?? '',
        stock: String(item.stock ?? 0),
        reorder: String(item.reorderLevel ?? 0),
        trackStock: item.trackStock,
        active: item.active,
      });
  }, [item]);
  const price = toMinor(f.price);
  const cost = f.cost === '' ? undefined : toMinor(f.cost);
  const dupSku = f.sku.trim() && catalog.some((c) => c.id !== item?.id && c.sku?.toLowerCase() === f.sku.trim().toLowerCase());
  const dupBarcode = f.barcode.trim() && catalog.some((c) => c.id !== item?.id && c.barcode === f.barcode.trim());
  const errors = {
    name: f.name.trim().length < 2 ? 'Enter an item name.' : null,
    price: Number.isNaN(price) || price <= 0 ? 'Enter a price above zero.' : null,
    cost: cost !== undefined && (Number.isNaN(cost) || cost < 0) ? 'Enter a valid cost or leave blank.' : null,
    sku: dupSku ? 'This SKU is already used.' : null,
    barcode: dupBarcode ? 'This barcode is already used.' : f.barcode && !/^\d{6,14}$/.test(f.barcode.trim()) ? 'Barcode must be 6–14 digits.' : null,
    stock: f.trackStock && !item && !/^\d+$/.test(f.stock) ? 'Opening stock must be a whole number.' : null,
    reorder: f.trackStock && !/^\d+$/.test(f.reorder) ? 'Reorder level must be a whole number.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const save = () => {
    setTouched(true);
    if (!valid) return;
    const next: CatalogItem = {
      ...(item ?? { id: uid('cat') }),
      name: f.name.trim(),
      category: f.category.trim() || 'General',
      kind: f.kind,
      price,
      cost,
      sku: f.sku.trim() || undefined,
      barcode: f.barcode.trim() || undefined,
      trackStock: f.trackStock,
      stock: f.trackStock ? (item ? item.stock ?? 0 : Number(f.stock)) : undefined,
      reorderLevel: f.trackStock ? Number(f.reorder) : undefined,
      unit: item?.unit ?? (f.trackStock ? 'unit' : undefined),
      active: f.active,
    } as CatalogItem;
    upsert(industry, next);
    toast.success(item ? 'Item updated' : 'Item added', next.name);
    onClose();
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={item ? `Edit ${item.name}` : 'Add catalog item'}
      description="Price changes apply to new invoices only; existing invoices keep their original prices."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{item ? 'Save changes' : 'Add item'}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="it-name" required error={touched ? errors.name : null} className="sm:col-span-2">
          <Input id="it-name" value={f.name} onChange={set('name')} maxLength={80} />
        </Field>
        <Field label="Category" htmlFor="it-cat">
          <Input id="it-cat" list="it-cats" value={f.category} onChange={set('category')} maxLength={40} />
          <datalist id="it-cats">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Type" htmlFor="it-kind">
          <Select id="it-kind" value={f.kind} onChange={(e) => setF((x) => ({ ...x, kind: e.target.value as CatalogKind, trackStock: e.target.value === 'product' ? x.trackStock : false }))}>
            <option value="product">Product</option>
            <option value="service">Service</option>
            <option value="package">Package</option>
          </Select>
        </Field>
        <Field label="Selling price" htmlFor="it-price" required error={touched ? errors.price : null}>
          <MoneyInput id="it-price" value={f.price} onChange={set('price')} />
        </Field>
        <Field label="Estimated unit cost" htmlFor="it-cost" error={touched ? errors.cost : null} hint="Used for gross-profit estimates">
          <MoneyInput id="it-cost" value={f.cost} onChange={set('cost')} />
        </Field>
        <Field label="SKU" htmlFor="it-sku" error={touched ? errors.sku : null}>
          <Input id="it-sku" value={f.sku} onChange={set('sku')} maxLength={20} />
        </Field>
        <Field label="Barcode" htmlFor="it-bc" error={touched ? errors.barcode : null}>
          <Input id="it-bc" value={f.barcode} onChange={set('barcode')} inputMode="numeric" maxLength={14} />
        </Field>
        {f.kind === 'product' && (
          <div className="sm:col-span-2">
            <Checkbox label="Track stock" description="Sales deduct stock and low-stock alerts are shown" checked={f.trackStock} onChange={(v) => setF((x) => ({ ...x, trackStock: v }))} />
          </div>
        )}
        {f.trackStock && !item && (
          <Field label="Opening stock" htmlFor="it-stock" error={touched ? errors.stock : null}>
            <Input id="it-stock" value={f.stock} onChange={set('stock')} inputMode="numeric" />
          </Field>
        )}
        {f.trackStock && (
          <Field label="Reorder level" htmlFor="it-reorder" error={touched ? errors.reorder : null}>
            <Input id="it-reorder" value={f.reorder} onChange={set('reorder')} inputMode="numeric" />
          </Field>
        )}
        <div className="sm:col-span-2">
          <Checkbox label="Active" description="Inactive items are hidden from billing screens" checked={f.active} onChange={(v) => setF((x) => ({ ...x, active: v }))} />
        </div>
      </div>
    </Modal>
  );
}

function StockModal({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  const industry = useStore((s) => s.activeIndustry);
  const adjust = useStore((s) => s.adjustStock);
  const [mode, setMode] = useState<'receive' | 'remove'>('receive');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('Supplier delivery');
  const n = /^\d+$/.test(qty) ? Number(qty) : NaN;
  const err = Number.isNaN(n) || n <= 0 ? 'Enter a whole number above zero.' : mode === 'remove' && n > (item.stock ?? 0) ? `Only ${item.stock} in stock.` : null;
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Adjust stock"
      description={`${item.name} · currently ${item.stock} in stock`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!!err}
            onClick={() => {
              const res = adjust(industry, item.id, mode === 'receive' ? n : -n, reason.trim() || (mode === 'receive' ? 'Received' : 'Adjustment'));
              if (!res.ok) return toast.error('Stock not updated', res.error);
              toast.success('Stock updated', `${item.name}: ${res.value.stock} in stock`);
              onClose();
            }}
          >
            {mode === 'receive' ? 'Receive stock' : 'Remove stock'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          label="Adjustment type"
          className="w-full"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setReason(m === 'receive' ? 'Supplier delivery' : 'Damaged / expired');
          }}
          options={[
            { value: 'receive', label: 'Receive (+)' },
            { value: 'remove', label: 'Remove (−)' },
          ]}
        />
        <Field label="Quantity" htmlFor="st-qty" error={qty ? err : null} hint={!err ? `New stock level: ${(item.stock ?? 0) + (mode === 'receive' ? n : -n)}` : undefined}>
          <Input id="st-qty" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} inputMode="numeric" data-autofocus />
        </Field>
        <Field label="Reason" htmlFor="st-reason">
          <Input id="st-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={60} />
        </Field>
      </div>
    </Modal>
  );
}
