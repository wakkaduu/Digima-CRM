import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Estimate } from '../api/types';
import { peso } from '../lib/format';

export const remainingOf = (e: Estimate) => Math.max(0, e.totalAmount - e.pendingAmount - e.approvedAmount);
const statusText = (s: string) => (s === 'Closed' ? 'Invoiced (closed in QuickBooks)' : s);
const MAX_RESULTS = 8;

interface Props {
  estimates: Estimate[];
  selected: Estimate | null;
  onSelect: (e: Estimate | null) => void;
  disabled: boolean;
  error?: string | null;
}

/** Type-ahead picker (combobox-style list) followed by a summary of the chosen estimate. */
export function EstimatePicker({ estimates, selected, onSelect, disabled, error }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(true);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      q
        ? estimates.filter(
            (e) => (e.docNumber || '').toLowerCase().includes(q) || (e.customerName || '').toLowerCase().includes(q),
          )
        : [],
    [estimates, q],
  );

  const count = !q
    ? ''
    : matches.length
      ? `${matches.length} found${matches.length > MAX_RESULTS ? `. Showing the first ${MAX_RESULTS}, so type more to narrow the list` : ''}.`
      : 'No estimate matches. Check the spelling or the estimate number.';

  const buttons = () => [...(listRef.current?.querySelectorAll('button') ?? [])];

  function onInputKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      const first = buttons()[0];
      if (first) {
        e.preventDefault();
        first.focus();
      }
    }
    if (e.key === 'Escape') setOpen(false);
  }

  function onListKey(e: KeyboardEvent) {
    const list = buttons();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' && i < list.length - 1) {
      e.preventDefault();
      list[i + 1].focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      (i > 0 ? list[i - 1] : inputRef.current)?.focus();
    }
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.focus();
    }
  }

  if (selected) {
    return (
      <div>
        <dl className="kv">
          <dt>Customer</dt>
          <dd>{selected.customerName}</dd>
          <dt>Estimate no.</dt>
          <dd>{selected.docNumber || selected.id}</dd>
          <dt>Status</dt>
          <dd>{statusText(selected.status)}</dd>
          <dt>Estimate total</dt>
          <dd>{peso(selected.totalAmount)}</dd>
          <dt>Awaiting review</dt>
          <dd>{peso(selected.pendingAmount)}</dd>
          <dt>Already approved</dt>
          <dd>{peso(selected.approvedAmount)}</dd>
          <dt>Estimated remaining</dt>
          <dd>{peso(remainingOf(selected))}</dd>
        </dl>
        <button
          type="button"
          className="btn btn-link"
          onClick={() => {
            onSelect(null);
            setQuery('');
            setOpen(true);
            setTimeout(() => inputRef.current?.focus());
          }}
        >
          Choose a different estimate
        </button>
      </div>
    );
  }

  const describedBy = ['estCount', error ? 'estSearch-error' : ''].filter(Boolean).join(' ');

  return (
    <div className="field">
      <label htmlFor="estSearch">Customer name or estimate number</label>
      <input
        id="estSearch"
        ref={inputRef}
        className="input"
        type="search"
        autoComplete="off"
        disabled={disabled}
        value={query}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onInputKey}
      />
      <p id="estCount" className="hint" aria-live="polite">
        {count}
      </p>
      {error && (
        <p id="estSearch-error" className="field-error">
          {error}
        </p>
      )}
      <ul ref={listRef} className="results" hidden={!open || !matches.length} onKeyDown={onListKey}>
        {matches.slice(0, MAX_RESULTS).map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onSelect(e)}>
              <div>
                #{e.docNumber || e.id} · {e.customerName}
              </div>
              <div className="sub">
                {peso(e.totalAmount)} · {statusText(e.status)}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
