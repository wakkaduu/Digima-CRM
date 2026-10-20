import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import { Skeleton } from './States';

interface Props {
  label: string;
  value: ReactNode;
  /** One short line under the figure (a unit, a caveat, a comparison). */
  note?: ReactNode;
  icon?: LucideIcon;
  /** Makes the whole tile a link to where the figure comes from. */
  to?: string;
  /** Draws attention (text goes with it): a queue that is getting old, a connection that is down. */
  tone?: 'default' | 'warning' | 'danger';
  /** The figure is still loading: shows a placeholder bar instead of the value and note. */
  loading?: boolean;
}

const TONE = { default: 'text-accent bg-accent-subtle', warning: 'text-warning bg-warning-bg', danger: 'text-danger bg-danger-bg' } as const;

/** A headline figure: label, big tabular number, optional note. Border only, no shadow. */
export function StatTile({ label, value, note, icon: Icon, to, tone = 'default', loading = false }: Props) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-small text-text-muted">{label}</span>
        {Icon && (
          <span aria-hidden className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-control', TONE[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </span>
      {loading ? (
        <span role="status" aria-label={`Loading ${label}`} className="block">
          <Skeleton className="mt-2 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-28" />
        </span>
      ) : (
        <>
          {/* The spaces keep the link's accessible name readable ("Approved 2 ...") whatever the CSS does. */}{' '}
          <span className="mt-1 block text-display font-semibold tabular-nums">{value}</span>{' '}
          {note && <span className="mt-0.5 block text-small text-text-muted">{note}</span>}
        </>
      )}
    </>
  );
  const cls = 'block rounded-card border border-border bg-surface p-4 text-text no-underline';
  return to ? (
    <Link to={to} className={cn(cls, 'hover:bg-surface-sunk')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
