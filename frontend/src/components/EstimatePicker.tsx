import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { useEstimateSearch } from '../api/payments';
import type { Estimate } from '../api/types';
import { peso } from '../lib/format';
import { useDebounced } from '../lib/useDebounced';
import { useMediaQuery } from '../lib/useMediaQuery';
import { Button } from './ui/Button';
import { Input } from './ui/controls';
import { Dialog } from './ui/Dialog';
import { NeutralBadge } from './ui/StatusBadge';

export const remainingOf = (e: Estimate) => Math.max(0, e.totalAmount - e.pendingAmount - e.approvedAmount);
const statusText = (s: string) => (s === 'Closed' ? 'Invoiced (closed in QuickBooks)' : s);
const MAX_RESULTS = 8;
const MAX_SHEET_RESULTS = 30;

interface Props {
  selected: Estimate | null;
  onSelect: (e: Estimate | null) => void;
  disabled: boolean;
  error?: string | null;
  /** Recently used estimates, shown first in the phone search sheet. */
  recents?: Estimate[];
}

/** Server-side search: the browser never downloads the whole estimate list. Returns what to show and how to word it. */
function useMatches(query: string, limit: number) {
  const q = useDebounced(query.trim());
  const search = useEstimateSearch(q, limit);
  const typing = query.trim() !== q; // still waiting for the pause in typing
  const hasQuery = query.trim().length > 0;
  return {
    matches: hasQuery ? (search.data?.estimates ?? []) : [],
    total: hasQuery ? (search.data?.total ?? 0) : 0,
    searching: hasQuery && (typing || search.isFetching),
    failed: hasQuery ? search.error?.message : undefined,
    settled: hasQuery && !typing && !search.isFetching && !!search.data,
  };
}

function EstimateRow({ e }: { e: Estimate }) {
  return (
    <>
      <div className="font-semibold">
        #{e.docNumber || e.id} · {e.customerName}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-small text-text-muted">
        <span className="tabular-nums">{peso(e.totalAmount)}</span>
        <NeutralBadge>{statusText(e.status)}</NeutralBadge>
      </div>
    </>
  );
}

const labelClass = 'mb-1 block font-semibold scroll-mb-32';
const errorClass = 'mt-1 text-small font-semibold text-danger';

/** Desktop: inline ARIA combobox (focus stays in the input; arrow keys move the active option). */
function EstimateCombobox({ onSelect, disabled, error }: Omit<Props, 'selected' | 'recents'>) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const { matches: shown, total, searching, failed, settled } = useMatches(query, MAX_RESULTS);
  const expanded = open && shown.length > 0;

  const count = !query.trim()
    ? ''
    : failed
      ? `Could not search: ${failed}`
      : searching && !shown.length
        ? 'Searching…'
        : shown.length
          ? `${total} found${total > shown.length ? `. Showing the first ${shown.length}, so type more to narrow the list` : ''}.`
          : settled
            ? 'No estimate matches. Check the spelling or the estimate number.'
            : '';
  const describedBy = ['estCount', error ? 'estSearch-error' : ''].filter(Boolean).join(' ');

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (shown.length ? (i + 1) % shown.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (shown.length ? (i <= 0 ? shown.length - 1 : i - 1) : -1));
    } else if (e.key === 'Enter' && expanded && active >= 0) {
      e.preventDefault();
      onSelect(shown[active]!);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <div className="mb-4">
      <label htmlFor="estSearch" className={labelClass}>
        Customer name or estimate number
      </label>
      <Input
        id="estSearch"
        role="combobox"
        type="search"
        autoComplete="off"
        enterKeyHint="search"
        disabled={disabled}
        value={query}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
      />
      <p id="estCount" className="mt-1 text-small text-text-muted" aria-live="polite">
        {count}
      </p>
      {error && (
        <p id="estSearch-error" className={errorClass}>
          {error}
        </p>
      )}
      <ul
        id={listId}
        role="listbox"
        aria-label="Matching estimates"
        hidden={!expanded}
        className="mt-1 max-h-72 list-none overflow-auto rounded-control border border-border-strong bg-surface p-0 [&>li+li]:border-t [&>li+li]:border-border"
      >
        {shown.map((e, i) => (
          <li
            key={e.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(ev) => ev.preventDefault()} // keep focus in the input
            onClick={() => onSelect(e)}
            className={`cursor-pointer px-3 py-2 hover:bg-accent-subtle ${i === active ? 'bg-accent-subtle' : ''}`}
          >
            <EstimateRow e={e} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Phone: a field that opens a full-screen search sheet (the keyboard covers half the screen, so no dropdown). */
function EstimateSheet({ onSelect, disabled, error, recents = [] }: Omit<Props, 'selected'>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { matches, total, searching: loading, failed, settled } = useMatches(query, MAX_SHEET_RESULTS);
  const searching = query.trim().length > 0;
  const rows = searching ? matches : recents;

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus());
    else setQuery('');
  }, [open]);

  return (
    <div className="mb-4">
      <label htmlFor="estSearch" className={labelClass}>
        Customer or estimate
      </label>
      <button
        id="estSearch"
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-describedby={error ? 'estSearch-error' : undefined}
        aria-invalid={error ? true : undefined}
        onClick={() => setOpen(true)}
        className="flex min-h-(--control-h) w-full items-center gap-2 rounded-control border border-border-strong bg-surface px-2.5 text-left text-text-muted disabled:bg-surface-sunk aria-invalid:border-2 aria-invalid:border-danger"
      >
        <Search aria-hidden className="size-4 shrink-0" />
        Search customer or estimate
      </button>
      {error && (
        <p id="estSearch-error" className={errorClass}>
          {error}
        </p>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="Choose an estimate" fullScreen>
        <div className="sticky top-0 -mx-4 bg-surface px-4 pb-2">
          <Input
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Customer name or estimate number"
            placeholder="Customer name or estimate number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="py-1 text-small text-text-muted" aria-live="polite">
          {searching
            ? failed
              ? `Could not search: ${failed}`
              : loading && !matches.length
                ? 'Searching…'
                : matches.length
                  ? `${total} found${total > matches.length ? `. Showing the first ${matches.length}` : ''}.`
                  : settled
                    ? 'No estimate matches. Check the spelling or the estimate number.'
                    : ''
            : recents.length
              ? 'Recent estimates'
              : 'Type a customer name or estimate number.'}
        </p>
        <ul className="list-none p-0 [&>li+li]:border-t [&>li+li]:border-border">
          {rows.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="block min-h-16 w-full px-1 py-3 text-left"
                onClick={() => {
                  setOpen(false);
                  onSelect(e);
                }}
              >
                <EstimateRow e={e} />
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}

/** Chosen estimate as a summary card with a "Change" action. */
function SelectedEstimate({ selected, onSelect }: { selected: Estimate; onSelect: (e: Estimate | null) => void }) {
  return (
    <div className="mb-4 rounded-control border border-border bg-surface-sunk p-3">
      <p className="font-semibold">{selected.customerName}</p>
      <p className="text-small text-text-muted">
        Estimate #{selected.docNumber || selected.id} · {statusText(selected.status)}
      </p>
      <dl className="my-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 tabular-nums [&_dt]:text-text-muted [&_dd]:text-right">
        <dt>Estimate total</dt>
        <dd>{peso(selected.totalAmount)}</dd>
        <dt>Awaiting review</dt>
        <dd>{peso(selected.pendingAmount)}</dd>
        <dt>Already approved</dt>
        <dd>{peso(selected.approvedAmount)}</dd>
        <dt className="font-semibold text-text">Estimated remaining</dt>
        <dd className="font-semibold">{peso(remainingOf(selected))}</dd>
      </dl>
      <Button
        onClick={() => {
          onSelect(null);
          setTimeout(() => document.getElementById('estSearch')?.focus());
        }}
      >
        Change estimate
      </Button>
    </div>
  );
}

export function EstimatePicker({ selected, ...rest }: Props) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  if (selected) return <SelectedEstimate selected={selected} onSelect={rest.onSelect} />;
  return desktop ? <EstimateCombobox {...rest} /> : <EstimateSheet {...rest} />;
}
