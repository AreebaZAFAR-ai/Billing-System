# Billora — Multi-Industry Billing & Business Automation (Prototype)

An interactive frontend prototype of a billing platform with one shared billing engine and
industry-specific modules for **grocery & retail**, **clinics**, **hospitals** and **beauty salons**.
It is built for live client demonstrations: no sign-in, no backend, no paid services.

> **Demo only.** All people, businesses and records are fictional. Payments are simulated, no money
> moves and no messages are sent. Data is kept in the browser's `localStorage`, which is not a secure
> database.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start the Vite dev server                      |
| `npm run build`     | Type-check (`tsc -b`) and build to `dist/`     |
| `npm run preview`   | Serve the production build locally             |
| `npm run typecheck` | TypeScript only                                |
| `npm run lint`      | ESLint                                         |
| `npm test`          | Vitest unit/integration tests (billing + store)|

No environment variables are required.

## Routes

| Route                  | Purpose                                                                    |
| ---------------------- | -------------------------------------------------------------------------- |
| `/`                    | Public landing page with live product preview and "Request a custom demo" |
| `/demo`                | Industry selector ("Start demo" per industry)                              |
| `/demo/overview`       | Dashboard: billed, collected, outstanding, est. profit, trends, activity   |
| `/demo/grocery`        | Point of sale: barcode/SKU search, cart, discount, tax, cash change, receipt |
| `/demo/clinic`         | Appointments, patient billing, part payments, patient directory, daily summary |
| `/demo/hospital`       | OPD billing, admissions with running charges, discharge bills, collections |
| `/demo/salon`          | Appointment book, checkout with staff assignment, packages, commissions    |
| `/demo/invoices`       | Search/filter/sort/paginate invoices, CSV export, payments                 |
| `/demo/invoices/:id`   | Full invoice, payment history, print / save as PDF                         |
| `/demo/customers`      | Customers / patients / clients with history and balances                   |
| `/demo/products`       | Inventory, service catalog, tariff, stock adjustments                      |
| `/demo/reports`        | Sales by day/month, status, methods, top items, aging, stock, commissions  |
| `/demo/settings`       | Business profile & logo, invoice prefix, tax, currency, reset data          |

The industry switcher in the top bar changes navigation labels, terminology, dashboards and records
while keeping each industry's data separate.

## How it works

- **Billing engine** — `src/lib/billing.ts`. All money is integer minor units (paisa).
  `Subtotal = Σ lines`, `Total = Subtotal − Discount + Tax` (tax on the discounted amount).
  Percentage discounts, tax and commissions are rounded to whole rupees. Payments must be positive
  and cannot exceed the outstanding balance. Statuses: paid, partially paid, unpaid, overdue.
- **Analytics** — `src/lib/analytics.ts` derives every report from stored invoices and payments, so
  cards, charts and tables agree. Billed revenue uses the invoice date; collections use the payment
  date. Estimated gross profit = net sales − estimated item cost − calculated commission
  (overheads are excluded).
- **State & persistence** — `src/store/store.ts` (Zustand). Each industry is stored under its own
  `localStorage` key and only changed slices are rewritten. Missing, corrupted or outdated data
  (schema version) falls back to a fresh sample dataset with a visible notice. If storage is
  unavailable the demo still works in memory.
- **Sample data** — `src/data/catalog.ts` (static fictional catalogs, staff, departments) and
  `src/data/seed.ts` (deterministic 90-day history generated relative to the reset time).
- **Printing** — invoices and 80 mm receipts render into `#print-root` with dedicated print CSS.
  Use the browser's **Save as PDF** destination for PDFs.

### Resetting the demo
Use **Reset demo** in the top bar, the demo guide, or Settings. Settings also has a per-industry reset.

### Rebranding
Edit `src/config/brand.ts` (product name, contact email/URL) and `src/components/layout/Logo.tsx`.
Sample business names and invoice settings live in `src/data/catalog.ts` → `defaultBusinesses` and
can also be changed in the app under Settings.

The **Request a custom demo** form opens an email to `BRAND.contactEmail` when it is set. When it is
empty, the form only prepares the request text for copying — nothing is sent anywhere.

## Deploying to Vercel

1. Push this folder to a Git repository (GitHub/GitLab/Bitbucket).
2. In Vercel choose **Add New → Project** and import the repository.
3. Framework preset: **Vite**. Build command `npm run build`, output directory `dist` (the defaults).
4. Deploy. `vercel.json` rewrites all paths to `index.html` so deep links such as `/demo/clinic` work.

Or with the CLI: `npm i -g vercel`, then `vercel` (preview) and `vercel --prod`.

## Known limitations

- Frontend prototype only: no server, authentication, multi-user sync or real payment gateway.
- `localStorage` is per browser and device and holds about 2–3 MB of sample data. Very heavy use
  could hit the browser quota; the app warns you and keeps working in memory.
- No real barcode-scanner integration. Scanners that type into the focused field work with the
  POS search box.
- The hospital module demonstrates billing only. It is not a hospital information system: it has
  no diagnoses, prescriptions or EHR.
- Tax rates in the sample settings are illustrative. Confirm the correct rates for each business.
- Currency switching changes formatting only. Amounts are not converted.
