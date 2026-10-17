import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PrintHost } from '@/components/invoice/Print';
import { Toaster } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const Landing = lazy(() => import('@/pages/Landing'));
const DemoHub = lazy(() => import('@/pages/DemoHub'));
const Overview = lazy(() => import('@/pages/Overview'));
const GroceryPOS = lazy(() => import('@/modules/grocery/GroceryPOS'));
const ClinicDesk = lazy(() => import('@/modules/clinic/ClinicDesk'));
const HospitalBilling = lazy(() => import('@/modules/hospital/HospitalBilling'));
const SalonDesk = lazy(() => import('@/modules/salon/SalonDesk'));
const Invoices = lazy(() => import('@/pages/Invoices'));
const InvoiceDetail = lazy(() => import('@/pages/InvoiceDetail'));
const Customers = lazy(() => import('@/pages/Customers'));
const Products = lazy(() => import('@/pages/Products'));
const Reports = lazy(() => import('@/pages/Reports'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-ink-400" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

const page = (el: ReactNode) => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>{el}</Suspense>
  </ErrorBoundary>
);

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={page(<Landing />)} />
        <Route path="/demo" element={page(<DemoHub />)} />
        <Route element={<AppShell />}>
          <Route path="/demo/overview" element={page(<Overview />)} />
          <Route path="/demo/grocery" element={page(<GroceryPOS />)} />
          <Route path="/demo/clinic" element={page(<ClinicDesk />)} />
          <Route path="/demo/hospital" element={page(<HospitalBilling />)} />
          <Route path="/demo/salon" element={page(<SalonDesk />)} />
          <Route path="/demo/invoices" element={page(<Invoices />)} />
          <Route path="/demo/invoices/:id" element={page(<InvoiceDetail />)} />
          <Route path="/demo/customers" element={page(<Customers />)} />
          <Route path="/demo/products" element={page(<Products />)} />
          <Route path="/demo/reports" element={page(<Reports />)} />
          <Route path="/demo/settings" element={page(<SettingsPage />)} />
          <Route path="/demo/*" element={<Navigate to="/demo/overview" replace />} />
        </Route>
        <Route path="*" element={page(<NotFound />)} />
      </Routes>
      <PrintHost />
      <Toaster />
    </>
  );
}
