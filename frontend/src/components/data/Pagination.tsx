import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Select } from '../ui/controls';

export const PAGE_SIZES = [25, 50] as const;

/** "Showing 1–25 of 132" (or "No results"). */
export const rangeText = (from: number, to: number, total: number) =>
  total === 0 ? 'No results' : `Showing ${from}–${to} of ${total}`;

interface PagesProps {
  page: number;
  size: number;
  total: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}

/** Desktop pager: range text, rows-per-page, previous / next. */
export function Pagination({ page, size, total, onPage, onSize }: PagesProps) {
  const pageCount = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <nav aria-label="Pagination" className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p aria-live="polite" className="text-text-muted tabular-nums">
        {rangeText(from, to, total)}
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 whitespace-nowrap text-text-muted">
          Rows per page
          <Select
            value={size}
            onChange={(e) => onSize(Number(e.target.value))}
            className="w-auto"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </label>
        <Button aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <span className="tabular-nums text-text-muted">
          {page} / {pageCount}
        </span>
        <Button aria-label="Next page" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      </div>
    </nav>
  );
}

/** Phone pager: count plus a "Load more" button. */
export function LoadMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      <p aria-live="polite" className="text-small text-text-muted tabular-nums">
        {rangeText(total === 0 ? 0 : 1, shown, total)}
      </p>
      {shown < total && <Button onClick={onMore}>Load more</Button>}
    </div>
  );
}
