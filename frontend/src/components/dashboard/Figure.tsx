import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '../../lib/cn';
import { Skeleton } from '../ui/States';

/** One container split by 1px dividers into equal columns (2 x 2 on a phone). Figures sit in it without tiles or icons. */
export function FigureStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border', className)}>{children}</div>;
}

/**
 * A figure in the strip: label over value over a note. A link when it has somewhere to go.
 * `lead` sets the screen's answer larger; `tone="danger"` colours the number only, for a figure that needs action.
 */
export function Figure({
  label,
  value,
  note,
  to,
  loading,
  lead,
  tone,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  to?: string;
  loading?: boolean;
  lead?: boolean;
  tone?: 'danger';
}) {
  const body = (
    <>
      <span className="block text-small text-text-muted">{label}</span>
      {loading ? (
        <span role="status" aria-label={`Loading ${label}`} className="block">
          <Skeleton className="mt-1 h-7 w-12" />
          <Skeleton className="mt-1.5 h-4 w-32" />
        </span>
      ) : (
        <>
          {/* The spaces keep the link's accessible name readable ("Active customers 18 ...") whatever the CSS does. */}{' '}
          <span className={cn('mt-1 block font-semibold tabular-nums', lead ? 'text-display leading-9 sm:text-[1.875rem]' : 'text-title', tone === 'danger' && 'text-danger')}>{value ?? '—'}</span>{' '}
          {note && <span className="mt-0.5 block text-small text-text-muted">{note}</span>}
        </>
      )}
    </>
  );
  const cls = 'block bg-surface p-4 text-text no-underline';
  return to ? (
    <Link to={to} className={cn(cls, 'hover:bg-surface-sunk')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
