import { cn } from '../../lib/cn';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { Skeleton } from './States';

// Skeletons that copy the final layout (same card, same row height, same column count), so the page does not
// jump when the data arrives. Widths vary a little so a list does not look like a barcode. Each wrapper is a
// single status region with a label; the grey shapes themselves are hidden from assistive tech.

const WIDTHS = ['w-3/5', 'w-2/5', 'w-1/2', 'w-7/12', 'w-1/3'];
const width = (i: number) => WIDTHS[i % WIDTHS.length];

/** What a tappable list card looks like (see ListRow): title and amount, a muted line, a badge. */
function CardShape({ i }: { i: number }) {
  return (
    <div className="min-h-16 rounded-card border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className={cn('h-4', width(i))} />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className={cn('mt-2 h-3', width(i + 2))} />
      <Skeleton className="mt-3 h-5 w-24 rounded-badge" />
    </div>
  );
}

/** A stack of list cards (phones, side lists). */
export function SkeletonCardList({ label, count = 4 }: { label: string; count?: number }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <CardShape key={i} i={i} />
      ))}
    </div>
  );
}

/** A data table with a header row (desktop). */
export function SkeletonTable({ label, columns = 5, rows = 8 }: { label: string; columns?: number; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex gap-4 border-b border-border bg-surface-sunk px-3 py-2.5">
        {Array.from({ length: columns }, (_, c) => (
          <Skeleton key={c} className={cn('h-4 bg-border!', c === 0 ? 'w-1/4' : 'w-1/6')} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border px-3 py-3 last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-1/4' : 'w-1/6', c === 0 && r % 2 === 1 && 'w-1/5')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** The results of a list page: a table from 1024px, cards below (matches ResultsView / ServerResults). */
export function ResultsSkeleton({ label, columns }: { label: string; columns?: number }) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  return desktop ? <SkeletonTable label={label} columns={columns} /> : <SkeletonCardList label={label} count={5} />;
}

/** The row of headline tiles (see StatTile). */
export function SkeletonTiles({ label, count = 4, className }: { label: string; count?: number; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-8" />
          </div>
          <Skeleton className="mt-2 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Rows inside a dashboard Section (title + detail on the left, amount + badge on the right). */
export function SkeletonRows({ label, count = 3 }: { label: string; count?: number }) {
  return (
    <div role="status" aria-label={label} className="divide-y divide-border">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 px-4 py-2">
          <div className="flex-1 space-y-2">
            <Skeleton className={cn('h-4', width(i))} />
            <Skeleton className={cn('h-3', width(i + 3))} />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-24 rounded-badge" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Title (and optional breadcrumb / description) of a PageHeader. */
export function SkeletonHeader({ breadcrumb = false, description = true }: { breadcrumb?: boolean; description?: boolean }) {
  return (
    <div aria-hidden className="mb-4 space-y-2">
      {breadcrumb && <Skeleton className="h-4 w-24" />}
      <Skeleton className="h-6 w-56" />
      {description && <Skeleton className="h-4 w-72 max-w-full" />}
    </div>
  );
}

/** A bordered card with a heading line and a few text lines. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('space-y-3 rounded-card border border-border bg-surface p-4', className)}>
      <Skeleton className="h-4 w-32" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', i % 2 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** A detail page: header, optional tab row and tiles, then cards. */
export function DetailSkeleton({ label, breadcrumb = true, tabs = false, tiles = 0, cards = 2 }: { label: string; breadcrumb?: boolean; tabs?: boolean; tiles?: number; cards?: number }) {
  return (
    <div role="status" aria-label={label}>
      <SkeletonHeader breadcrumb={breadcrumb} />
      {tabs && (
        <div aria-hidden className="mb-4 flex gap-4 border-b border-border pb-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
        </div>
      )}
      <div className="space-y-4">
        {tiles > 0 && (
          <div aria-hidden className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: tiles }, (_, i) => (
              <div key={i} className="rounded-card border border-border bg-surface p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-7 w-20" />
                <Skeleton className="mt-2 h-3 w-32" />
              </div>
            ))}
          </div>
        )}
        {Array.from({ length: cards }, (_, i) => (
          <SkeletonCard key={i} lines={i === 0 ? 3 : 4} />
        ))}
      </div>
    </div>
  );
}

/** A whole page while its code or session loads: header plus a few cards. Used as the route fallback. */
export function PageSkeleton({ label = 'Loading' }: { label?: string }) {
  return <DetailSkeleton label={label} breadcrumb={false} cards={2} />;
}
