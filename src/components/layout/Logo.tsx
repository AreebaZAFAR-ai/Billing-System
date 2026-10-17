import { Link } from 'react-router-dom';
import { BRAND } from '@/config/brand';
import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#185f59" />
      <path
        d="M10 8h7.5a4.5 4.5 0 0 1 2.9 7.94A4.75 4.75 0 0 1 18 24h-8V8Zm3.2 3v3.6h4a1.8 1.8 0 0 0 0-3.6h-4Zm0 6.4V21h4.6a1.8 1.8 0 0 0 0-3.6h-4.6Z"
        fill="#fff"
      />
    </svg>
  );
}

export function Logo({ to = '/', collapsed, light }: { to?: string; collapsed?: boolean; light?: boolean }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-label={`${BRAND.name} home`}>
      <LogoMark />
      {!collapsed && <span className={cn('text-[17px] font-semibold tracking-tight', light ? 'text-white' : 'text-ink-900')}>{BRAND.name}</span>}
    </Link>
  );
}
