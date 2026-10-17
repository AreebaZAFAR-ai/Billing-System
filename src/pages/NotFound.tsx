import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Logo } from '@/components/layout/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6 text-center">
      <Logo />
      <span className="mt-10 flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        <Compass className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-semibold text-ink-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500">The page you’re looking for doesn’t exist or has moved.</p>
      <div className="mt-6 flex gap-2">
        <ButtonLink to="/" variant="secondary">
          Home
        </ButtonLink>
        <ButtonLink to="/demo">Open live demo</ButtonLink>
      </div>
    </div>
  );
}
