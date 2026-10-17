import { create } from 'zustand';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn, uid } from '@/lib/utils';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: string;
  tone: Tone;
  title: string;
  description?: string;
}

const useToasts = create<{ items: ToastItem[]; push: (t: Omit<ToastItem, 'id'>) => void; dismiss: (id: string) => void }>(
  (set) => ({
    items: [],
    push: (t) => set((s) => ({ items: [...s.items.slice(-3), { ...t, id: uid('t') }] })),
    dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  }),
);

export const toast = {
  success: (title: string, description?: string) => useToasts.getState().push({ tone: 'success', title, description }),
  error: (title: string, description?: string) => useToasts.getState().push({ tone: 'error', title, description }),
  info: (title: string, description?: string) => useToasts.getState().push({ tone: 'info', title, description }),
};

function ToastCard({ t }: { t: ToastItem }) {
  const dismiss = useToasts((s) => s.dismiss);
  const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? XCircle : Info;
  return (
    <div
      role={t.tone === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full animate-slide-up items-start gap-3 rounded-xl border border-ink-200 bg-white p-3.5 shadow-pop"
    >
      <Icon
        className={cn('mt-0.5 h-5 w-5 shrink-0', t.tone === 'success' ? 'text-emerald-600' : t.tone === 'error' ? 'text-red-600' : 'text-sky-600')}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900">{t.title}</p>
        {t.description && <p className="mt-0.5 text-[13px] text-ink-500">{t.description}</p>}
      </div>
      <button type="button" aria-label="Dismiss notification" onClick={() => dismiss(t.id)} className="rounded p-0.5 text-ink-400 hover:text-ink-700">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// UI-only auto-dismiss (not business logic).
useToasts.subscribe((s, prev) => {
  const added = s.items.filter((x) => !prev.items.some((p) => p.id === x.id));
  added.forEach((t) => window.setTimeout(() => useToasts.getState().dismiss(t.id), t.tone === 'error' ? 6000 : 4000));
});

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 no-print">
      {items.map((t) => (
        <ToastCard key={t.id} t={t} />
      ))}
    </div>
  );
}
