import type { ReactNode } from 'react';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { DataList } from './DataList';
import { DataTable, type Column, type Sort } from './DataTable';
import { Pagination } from './Pagination';

interface Props<T> {
  /** The rows of the current page, already filtered and sorted by the server. */
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  columns: Column<T>[];
  getRowId: (row: T) => string;
  /** Names the table / list for assistive tech. */
  label: string;
  renderCard: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  sort: Sort | null;
  onSortChange: (sort: Sort) => void;
  /** True while a new page is loading (the old rows stay on screen, dimmed). */
  busy?: boolean;
}

/**
 * Server-paged counterpart of ResultsView: the API sorts and pages, this only draws the page.
 * A sortable table with a pager from 1024px; tappable cards with the same pager on phones.
 */
export function ServerResults<T>({ rows, total, page, pageSize, onPage, onPageSize, columns, getRowId, label, renderCard, onRowClick, sort, onSortChange, busy }: Props<T>) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  return (
    <div aria-busy={busy} className={busy ? 'opacity-60' : undefined}>
      {desktop ? (
        <DataTable columns={columns} rows={rows} getRowId={getRowId} caption={label} sort={sort} onSortChange={onSortChange} onRowClick={onRowClick} />
      ) : (
        <DataList rows={rows} getRowId={getRowId} label={label} onRowClick={onRowClick}>
          {renderCard}
        </DataList>
      )}
      <Pagination page={page} size={pageSize} total={total} onPage={onPage} onSize={onPageSize} />
    </div>
  );
}

/** "name:asc" <-> { id: 'name', dir: 'asc' } for sorts the server understands; null when the id is not allowed. */
export function sortFromParam(value: string, allowed: string[]): Sort | null {
  const [id, dir] = value.split(':');
  return id && allowed.includes(id) ? { id, dir: dir === 'desc' ? 'desc' : 'asc' } : null;
}
export const sortToParam = (s: Sort) => `${s.id}:${s.dir}`;
