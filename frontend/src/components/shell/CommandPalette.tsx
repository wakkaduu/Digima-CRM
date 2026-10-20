import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import { FileText, Search, Users } from 'lucide-react';
import { useCustomers, useEstimates } from '../../api/crm';
import type { User } from '../../api/types';
import { cn } from '../../lib/cn';
import { peso } from '../../lib/format';
import { useDebounced } from '../../lib/useDebounced';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { Dialog } from '../ui/Dialog';
import { navFor } from './nav';

interface Result {
  id: string;
  label: string;
  detail?: string;
  to: string;
  icon: LucideIcon;
}
interface Group {
  label: string;
  results: Result[];
}

const MIN_CHARS = 2; // QuickBooks is asked only once the query is long enough to mean something

function Palette({ user, onClose }: { user: User; onClose: () => void }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const q = useDebounced(query.trim());
  const searching = q.length >= MIN_CHARS;

  // The dialog opens after this mounts, so focus has to wait a tick.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus());
    return () => clearTimeout(t);
  }, []);

  const customers = useCustomers({ q, page: 1, pageSize: 5 }, searching);
  const estimates = useEstimates({ q, page: 1, pageSize: 5 }, searching);

  const groups = useMemo<Group[]>(() => {
    const needle = query.trim().toLowerCase();
    const pages = navFor(user)
      .filter((n) => !needle || n.label.toLowerCase().includes(needle))
      .map<Result>((n) => ({ id: `page-${n.to}`, label: n.label, to: n.to, icon: n.icon }));
    const out: Group[] = [];
    if (pages.length) out.push({ label: 'Go to', results: pages });
    if (searching) {
      const c = (customers.data?.items ?? []).map<Result>((x) => ({ id: `c-${x.id}`, label: x.name, detail: x.email ?? x.phone ?? undefined, to: `/customers/${x.id}`, icon: Users }));
      const e = (estimates.data?.items ?? []).map<Result>((x) => ({
        id: `e-${x.id}`,
        label: `Estimate #${x.docNumber || x.id}`,
        detail: `${x.customerName ?? ''} · ${peso(x.totalAmount)}`,
        to: `/estimates/${x.id}`,
        icon: FileText,
      }));
      if (c.length) out.push({ label: 'Customers', results: c });
      if (e.length) out.push({ label: 'Estimates', results: e });
    }
    return out;
  }, [user, query, searching, customers.data, estimates.data]);

  const flat = groups.flatMap((g) => g.results);
  const index = Math.min(active, Math.max(0, flat.length - 1));
  const loading = searching && (customers.isFetching || estimates.isFetching);
  const failed = searching && customers.isError && estimates.isError;

  function go(r: Result) {
    onClose();
    navigate(r.to);
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (flat.length) setActive((index + (e.key === 'ArrowDown' ? 1 : flat.length - 1)) % flat.length);
    } else if (e.key === 'Enter' && flat[index]) {
      e.preventDefault();
      go(flat[index]!);
    }
  }

  return (
    <div>
      <label className="flex min-h-(--control-h) items-center gap-2 rounded-control border border-border-strong px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring">
        <Search aria-hidden className="size-4 shrink-0 text-text-muted" />
        <span className="sr-only">Search customers, estimates and pages</span>
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="go"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={flat[index] ? `${listId}-${flat[index]!.id}` : undefined}
          autoComplete="off"
          placeholder="Search customers, estimates, pages"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          className="min-w-0 flex-1 bg-transparent py-2 text-input outline-none"
        />
      </label>

      <div id={listId} role="listbox" aria-label="Results" className="mt-2 pb-2">
        {groups.map((g) => (
          <div key={g.label} role="group" aria-label={g.label}>
            <p aria-hidden className="px-3 pt-2 pb-1 text-micro font-semibold tracking-wide text-text-muted uppercase">
              {g.label}
            </p>
            {g.results.map((r) => {
              const selected = flat[index]?.id === r.id;
              return (
                <div
                  key={r.id}
                  id={`${listId}-${r.id}`}
                  role="option"
                  aria-selected={selected}
                  onClick={() => go(r)}
                  onMouseMove={() => setActive(flat.findIndex((x) => x.id === r.id))}
                  className={cn('flex min-h-(--control-h) cursor-pointer items-center gap-3 rounded-control px-3 py-1', selected && 'bg-accent-subtle')}
                >
                  <r.icon aria-hidden className="size-4 shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{r.label}</span>
                    {r.detail && <span className="block truncate text-small text-text-muted">{r.detail}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
        <p role="status" className="px-3 py-3 text-small text-text-muted">
          {failed
            ? 'Could not search QuickBooks right now. Pages still work.'
            : loading
              ? 'Searching…'
              : flat.length === 0
                ? 'No matches.'
                : !searching && query.trim() === ''
                  ? `Type ${MIN_CHARS} or more letters to search customers and estimates.`
                  : ''}
        </p>
      </div>
    </div>
  );
}

/** Ctrl/⌘+K: jump to a page, or find a customer or estimate. Full screen on phones, a dialog above. */
export function CommandPalette({ open, onClose, user }: { open: boolean; onClose: () => void; user: User }) {
  const wide = useMediaQuery('(min-width: 640px)');
  return (
    <Dialog open={open} onClose={onClose} title="Search" fullScreen={!wide}>
      {open && <Palette user={user} onClose={onClose} />}
    </Dialog>
  );
}
