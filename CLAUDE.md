# CLAUDE.md

Billora: a multi-industry billing demo SPA (grocery POS, clinic, hospital, salon). Frontend only,
with no backend. Data is simulated and persisted to localStorage.

## Commands
- `npm run dev` — dev server (Vite, port 5173)
- `npm run build` — `tsc -b` + `vite build` (must pass before deploy)
- `npm run lint` — ESLint (flat config, typescript-eslint, react-hooks)
- `npm test` — Vitest (`src/**/*.test.ts`)

## Stack
React 18 + TypeScript (strict) + Vite 5, Tailwind CSS 3, react-router-dom 6, Zustand 4,
Recharts 2, lucide-react. Path alias `@/` → `src/`. Deployed as a static SPA on Vercel (`vercel.json`
rewrites to `index.html`).

## Layout
- `src/lib/` — pure logic: `billing.ts` (single source of invoice math), `analytics.ts` (all
  report aggregations), `money.ts` (minor-unit formatting/parsing), `dates.ts`, `types.ts`, `utils.ts`
- `src/data/` — fictional catalogs (`catalog.ts`) and the deterministic seed generator (`seed.ts`)
- `src/store/` — `store.ts` (Zustand store and all mutations), `persistence.ts` (versioned
  localStorage I/O), `ui.ts` (shared date range)
- `src/config/` — `brand.ts` (rebranding, contact CTA), `industries.ts` (terminology, nav, accents,
  guided steps per industry)
- `src/components/` — `ui/` primitives, `layout/` (AppShell, IndustrySwitcher, DemoGuide),
  `invoice/` (InvoiceComposer, InvoiceDocument, Print, PaymentModal…), `customers/`,
  `appointments/`, `charts/`
- `src/modules/<industry>/` — industry workflow screens
- `src/pages/` — shared routes (Landing, DemoHub, Overview, Invoices, Customers, Products, Reports, Settings)

## Conventions / rules
- **Money is always integer minor units.** Never use float math for amounts. Parse input with
  `toMinor`, display with `formatMoney`. Discounts, tax and commission go through `billing.ts`
  (rounded to whole units via `roundToUnit`).
- Never duplicate invoice calculations in screens. Use `computeTotals`, `outstanding`,
  `invoiceStatus`, `validatePayment`, and `analytics.ts` for reporting.
- All writes go through store actions. They validate input (stock, payment ≤ balance, idempotency
  key for checkout) and append an activity entry.
- Reports must derive from stored invoices and payments only. Billed uses the invoice date;
  collected uses the payment date.
- Any change to persisted data shape requires bumping `SCHEMA_VERSION` in `store/persistence.ts`.
- Keep demo honesty: label simulated payments, use no invented contact details, testimonials or
  claims, and use only fictional people.
- UI: Tailwind tokens `brand-*` (teal) and `ink-*` (neutral). Use the `Card`, `Button`, `Field`
  and `Modal` primitives. Chart colors come from `SERIES` in `components/charts/Charts.tsx`
  (validated categorical order). Avoid horizontal overflow: grid children need `min-w-0`.
- Printing: call `printInvoice(industry, id, format)`, which renders into `#print-root`.
