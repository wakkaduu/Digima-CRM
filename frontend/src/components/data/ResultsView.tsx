import { useState, type ReactNode } from 'react';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { DataList } from './DataList';
import { DataTable, type Column, type Sort } from './DataTable';
import { LoadMore, Pagination, PAGE_SIZES } from './Pagination';

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  /** Names the table / list for assistive tech. */
  label: string;
  /** The phone card for one row; usually a <ListRow />. */
  renderCard: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  selectedId?: string;
  sort: Sort | null;
  onSortChange: (sort: Sort) => void;
  /** Changes whenever the filters change, so paging starts again from the first page. */
  resetKey: string;
}

const compare = (a: string | number, b: string | number) =>
  typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true });

/**
 * One result set, two shapes: a sortable, paged table from 1024px; cards with "Load more" on phones.
 * Sorting and paging happen here in memory (the API returns the whole list today); a server-backed
 * version only has to swap this component's internals.
 */
export function ResultsView<T>({ rows, columns, getRowId, label, renderCard, onRowClick, selectedId, sort, onSortChange, resetKey }: Props<T>) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [size, setSize] = useState<number>(PAGE_SIZES[0]);
  // Paging position is tied to resetKey: a different key means "start again".
  const [pos, setPos] = useState({ key: resetKey, page: 1, loads: 1 });
  const fresh = pos.key === resetKey ? pos : { key: resetKey, page: 1, loads: 1 };

  const col = sort && columns.find((c) => c.id === sort.id);
  const sorted =
    col?.sortValue && sort
      ? [...rows].sort((a, b) => (sort.dir === 'asc' ? 1 : -1) * compare(col.sortValue!(a), col.sortValue!(b)))
      : rows;

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = Math.min(fresh.page, pageCount);

  if (!desktop) {
    const shown = Math.min(total, PAGE_SIZES[0] * fresh.loads);
    return (
      <>
        <DataList rows={sorted.slice(0, shown)} getRowId={getRowId} label={label} onRowClick={onRowClick} selectedId={selectedId}>
          {renderCard}
        </DataList>
        <LoadMore shown={shown} total={total} onMore={() => setPos({ ...fresh, loads: fresh.loads + 1 })} />
      </>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        rows={sorted.slice((page - 1) * size, page * size)}
        getRowId={getRowId}
        caption={label}
        sort={sort}
        onSortChange={onSortChange}
        onRowClick={onRowClick}
        selectedId={selectedId}
      />
      <Pagination
        page={page}
        size={size}
        total={total}
        onPage={(p) => setPos({ ...fresh, page: p })}
        onSize={(s) => {
          setSize(s);
          setPos({ ...fresh, page: 1 });
        }}
      />
    </>
  );
}

/** "created:desc" <-> { id: 'created', dir: 'desc' } for keeping the sort in the URL. */
export function parseSort(value: string, columns: Column<unknown>[] | { id: string }[]): Sort | null {
  const [id, dir] = value.split(':');
  return id && columns.some((c) => c.id === id) ? { id, dir: dir === 'asc' ? 'asc' : 'desc' } : null;
}
export const formatSort = (s: Sort) => `${s.id}:${s.dir}`;
