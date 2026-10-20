import { Link } from 'react-router';
import { Bell, Search, Send } from 'lucide-react';
import type { User } from '../../api/types';
import { cn } from '../../lib/cn';
import { buttonClass } from '../ui/Button';
import { CountChip } from '../ui/StatusBadge';

/** Shortcut to what needs the user next: admins their review queue, sales their payment updates. */
export function AlertsLink({ user, counts }: { user: User; counts: Record<'pending' | 'unseen', number> }) {
  const admin = user.role === 'admin';
  const count = admin ? counts.pending : counts.unseen;
  const label = admin ? 'Payments awaiting review' : 'Payment updates';
  return (
    <Link
      to={admin ? '/payments/review' : '/payments'}
      aria-label={count > 0 ? `${label}: ${count}` : label}
      className="relative inline-flex min-h-(--control-h) min-w-(--control-h) items-center justify-center rounded-control text-text no-underline hover:bg-surface-sunk"
    >
      <Bell aria-hidden className="size-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5">
          <CountChip count={count} label={admin ? 'pending' : 'updates'} />
        </span>
      )}
    </Link>
  );
}

export function SearchButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search"
      aria-haspopup="dialog"
      className={cn('inline-flex min-h-(--control-h) min-w-(--control-h) items-center justify-center rounded-control text-text hover:bg-surface-sunk', className)}
    >
      <Search aria-hidden className="size-5" />
    </button>
  );
}

/** Desktop (>= 1024px) bar above the page: search, alerts and the one action reps need most. */
export function TopBar({ user, counts, onSearch }: { user: User; counts: Record<'pending' | 'unseen', number>; onSearch: () => void }) {
  return (
    <div className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-3 px-6">
        <button
          type="button"
          onClick={onSearch}
          aria-haspopup="dialog"
          className="flex min-h-(--control-h) w-full max-w-md items-center gap-2 rounded-control border border-border-strong bg-surface px-3 text-left text-text-muted hover:bg-surface-sunk"
        >
          <Search aria-hidden className="size-4" />
          <span className="flex-1">Search customers, estimates, pages</span>
          <kbd className="rounded-control border border-border px-1.5 text-micro">Ctrl K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-2">
          <AlertsLink user={user} counts={counts} />
          {user.role === 'sales' && (
            <Link to="/payments/new" className={buttonClass({ variant: 'primary' })}>
              <Send aria-hidden className="size-4" /> Submit payment
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
