import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface Props<T> {
  rows: T[];
  getRowId: (row: T) => string;
  /** Accessible name of the list. */
  label: string;
  onRowClick?: (row: T) => void;
  selectedId?: string;
  children: (row: T) => ReactNode;
}

/** The phone pattern: one tappable card (>= 64px) per row. Whole card is the target. */
export function DataList<T>({ rows, getRowId, label, onRowClick, selectedId, children }: Props<T>) {
  return (
    <ul aria-label={label} className="space-y-2">
      {rows.map((r) => {
        const id = getRowId(r);
        const cls = cn(
          'block min-h-16 w-full rounded-card border p-3 text-left',
          id === selectedId ? 'border-accent bg-accent-subtle' : 'border-border bg-surface',
        );
        return (
          <li key={id}>
            {onRowClick ? (
              <button type="button" onClick={() => onRowClick(r)} className={cls}>
                {children(r)}
              </button>
            ) : (
              <div className={cls}>{children(r)}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Standard card body: title and amount on one line, a muted meta line, then a badge row. Inline elements only (it sits in a button). */
export function ListRow({ title, amount, meta, badge, note }: { title: ReactNode; amount?: ReactNode; meta?: ReactNode; badge?: ReactNode; note?: ReactNode }) {
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 font-semibold">{title}</span>
        {amount && <span className="shrink-0 font-semibold tabular-nums">{amount}</span>}
      </span>
      {meta && <span className="mt-0.5 block text-small text-text-muted">{meta}</span>}
      {badge && <span className="mt-2 block">{badge}</span>}
      {note && <span className="mt-1 block text-small text-text-muted">{note}</span>}
    </>
  );
}
