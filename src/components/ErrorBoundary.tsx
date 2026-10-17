import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { clearPersisted } from '@/store/persistence';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Billora UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto my-16 max-w-md rounded-xl border border-ink-200 bg-white p-6 text-center shadow-card" role="alert">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-3 text-base font-semibold text-ink-900">This screen ran into a problem</h2>
        <p className="mt-1 text-sm text-ink-500">Try reloading. If it keeps happening, restore the original sample data.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" className="h-9 rounded-lg border border-ink-200 px-4 text-sm font-medium hover:bg-ink-50" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button
            type="button"
            className="h-9 rounded-lg bg-brand-700 px-4 text-sm font-medium text-white hover:bg-brand-800"
            onClick={() => {
              clearPersisted();
              window.location.assign('/demo/overview');
            }}
          >
            Restore sample data
          </button>
        </div>
      </div>
    );
  }
}
