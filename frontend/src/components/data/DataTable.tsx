import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Makes the column sortable. Sorting itself is done by the caller (ResultsView), so it can later be server-side. */
  sortValue?: (row: T) => string | number;
  align?: 'right';
  /** Keep this column visible while the table scrolls sideways (use on the first column). */
  pin?: boolean;
  className?: string;
}

export type SortDir = 'asc' | 'desc';
export interface Sort {
  id: string;
  dir: SortDir;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Accessible name of the table (visually hidden). */
  caption: string;
  sort?: Sort | null;
  onSortChange?: (sort: Sort) => void;
  /** Makes rows clickable and keyboard-activatable (Enter / Space). */
  onRowClick?: (row: T) => void;
  selectedId?: string;
}

const cell = 'px-3 py-2 align-top';

/**
 * Desktop data grid: sticky header, sortable columns (aria-sort), 40px rows, tabular right-aligned money,
 * a pinned first column, and keyboard row navigation (Up/Down/Home/End move, Enter or Space opens).
 */
export function DataTable<T>({ columns, rows, getRowId, caption, sort, onSortChange, onRowClick, selectedId }: Props<T>) {
  const [active, setActive] = useState(0); // roving tabindex: one row is in the tab order
  const row0 = Math.min(active, Math.max(0, rows.length - 1));

  function onRowKey(e: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (e.target !== e.currentTarget) return; // keys inside a button or link inside the row belong to it
    const tr = e.currentTarget;
    const focusRow = (el: Element | null) => (el as HTMLElement | null)?.focus();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        return focusRow(tr.nextElementSibling);
      case 'ArrowUp':
        e.preventDefault();
        return focusRow(tr.previousElementSibling);
      case 'Home':
        e.preventDefault();
        return focusRow(tr.parentElement?.firstElementChild ?? null);
      case 'End':
        e.preventDefault();
        return focusRow(tr.parentElement?.lastElementChild ?? null);
      case 'Enter':
      case ' ':
        if (onRowClick) {
          e.preventDefault();
          onRowClick(row);
        }
    }
  }

  function toggle(col: Column<T>) {
    onSortChange?.({ id: col.id, dir: sort?.id === col.id && sort.dir === 'asc' ? 'desc' : 'asc' });
  }

  return (
    <div className="max-h-[70dvh] overflow-auto rounded-card border border-border bg-surface">
      <table className="w-full border-collapse text-body">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const sorted = sort?.id === c.id ? sort.dir : null;
              return (
                <th
                  key={c.id}
                  scope="col"
                  aria-sort={c.sortValue ? (sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none') : undefined}
                  className={cn(
                    'sticky top-0 border-b border-border bg-surface-sunk p-0 text-left font-semibold whitespace-nowrap',
                    c.align === 'right' && 'text-right',
                    c.pin ? 'left-0 z-[3]' : 'z-[2]',
                  )}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggle(c)}
                      className={cn('flex min-h-10 w-full items-center gap-1 px-3 font-semibold', c.align === 'right' && 'justify-end')}
                    >
                      {c.header}
                      {sorted === 'asc' ? (
                        <ArrowUp aria-hidden className="size-3.5" />
                      ) : sorted === 'desc' ? (
                        <ArrowDown aria-hidden className="size-3.5" />
                      ) : (
                        <ChevronsUpDown aria-hidden className="size-3.5 text-text-muted" />
                      )}
                    </button>
                  ) : (
                    <span className={cn('block px-3 py-2', c.align === 'right' && 'text-right')}>{c.header}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const id = getRowId(r);
            return (
              <tr
                key={id}
                tabIndex={onRowClick ? (i === row0 ? 0 : -1) : undefined}
                aria-current={id === selectedId ? 'true' : undefined}
                onFocus={onRowClick ? () => setActive(i) : undefined}
                onKeyDown={onRowClick ? (e) => onRowKey(e, r) : undefined}
                onClick={
                  onRowClick
                    ? (e) => {
                        if (!(e.target as HTMLElement).closest('a, button, input, select')) onRowClick(r);
                      }
                    : undefined
                }
                className={cn(
                  'group h-10 border-t border-border first:border-t-0',
                  onRowClick && 'cursor-pointer',
                  id === selectedId ? 'bg-accent-subtle' : 'hover:bg-surface-sunk',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.id}
                    className={cn(
                      cell,
                      c.align === 'right' && 'text-right tabular-nums whitespace-nowrap',
                      c.pin && cn('sticky left-0 z-[1]', id === selectedId ? 'bg-accent-subtle' : 'bg-surface group-hover:bg-surface-sunk'),
                      c.className,
                    )}
                  >
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
