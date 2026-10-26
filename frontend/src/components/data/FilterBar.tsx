import { useId, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/controls';
import { Dialog } from '../ui/Dialog';

export interface FilterTab {
  id: string;
  label: string;
  count?: number;
}

export interface FilterDef {
  id: string;
  label: string;
  /** Text of the "no filter" option, e.g. "All banks". */
  allLabel: string;
  value: string;
  options: { value: string; label: string }[];
}

interface Props {
  search: { value: string; onChange: (v: string) => void; label: string; placeholder?: string };
  tabs?: { label: string; items: FilterTab[]; value: string; onChange: (id: string) => void };
  filters?: FilterDef[];
  onFilterChange?: (id: string, value: string) => void;
  /** Clears the search and every dropdown filter (not the tab). */
  onClearAll: () => void;
  className?: string;
}

/**
 * Search + status tabs + dropdown filters, with a chip per active filter and "Clear all".
 * Filters open inline from 1024px and in a bottom sheet on phones. The parent owns the values (see useUrlFilters).
 */
export function FilterBar({ search, tabs, filters = [], onFilterChange, onClearAll, className }: Props) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const active = filters.filter((f) => f.value);
  const hasAny = active.length > 0 || search.value.trim() !== '';
  const labelOf = (f: FilterDef) => f.options.find((o) => o.value === f.value)?.label ?? f.value;

  const selects = (
    <div className={cn('grid gap-2', desktop ? 'grid-cols-2' : 'grid-cols-1')}>
      {filters.map((f) => (
        <label key={f.id} className="block">
          <span className="mb-1 block text-small text-text-muted">{f.label}</span>
          <Select value={f.value} onChange={(e) => onFilterChange?.(f.id, e.target.value)}>
            <option value="">{f.allLabel}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
      ))}
    </div>
  );

  return (
    <div className={cn('mb-4 space-y-2', className)}>
      <div className={cn('flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between', tabs && 'lg:border-b lg:border-border')}>
        {tabs && (
          <div role="group" aria-label={tabs.label} className="-mb-px flex gap-5 overflow-x-auto border-b border-border lg:border-b-0">
            {tabs.items.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tabs.value === t.id}
                onClick={() => tabs.onChange(t.id)}
                className={cn(
                  'min-h-(--control-h) border-b-2 whitespace-nowrap',
                  tabs.value === t.id ? 'border-text font-semibold text-text' : 'border-transparent text-text-muted hover:text-text',
                )}
              >
                {t.label} {t.count !== undefined && <span className="tabular-nums text-text-muted">{t.count}</span>}
              </button>
            ))}
          </div>
        )}

        <div className={cn('flex gap-2', tabs ? 'lg:w-80 lg:pb-2' : 'lg:w-full')}>
          <Input
            type="search"
            enterKeyHint="search"
            aria-label={search.label}
            placeholder={search.placeholder}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
          />
          {filters.length > 0 && (
            <Button aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)} className="shrink-0">
              Filters{active.length ? ` (${active.length})` : ''}
              <ChevronDown aria-hidden className={cn('size-4', open && desktop && 'rotate-180')} />
            </Button>
          )}
        </div>
      </div>

      {desktop && open && <div id={panelId}>{selects}</div>}
      {!desktop && (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Filters"
          footer={
            <>
              <Button
                onClick={() => {
                  onClearAll();
                  setOpen(false);
                }}
                disabled={!hasAny}
              >
                Clear all
              </Button>
              <Button variant="primary" onClick={() => setOpen(false)}>
                Done
              </Button>
            </>
          }
        >
          <div id={panelId}>{selects}</div>
        </Dialog>
      )}

      {hasAny && (
        <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
          {search.value.trim() !== '' && (
            <li>
              <Chip label={`Search: ${search.value.trim()}`} onRemove={() => search.onChange('')} what="search" />
            </li>
          )}
          {active.map((f) => (
            <li key={f.id}>
              <Chip label={`${f.label}: ${labelOf(f)}`} onRemove={() => onFilterChange?.(f.id, '')} what={f.label} />
            </li>
          ))}
          <li>
            <Button variant="link" onClick={onClearAll} className="pointer-coarse:min-h-11">
              Clear all
            </Button>
          </li>
        </ul>
      )}
    </div>
  );
}

function Chip({ label, onRemove, what }: { label: string; onRemove: () => void; what: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-badge border border-border-strong bg-surface py-0.5 pr-1 pl-3 text-small">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${what} filter`}
        className="inline-flex size-6 items-center justify-center rounded-badge hover:bg-surface-sunk pointer-coarse:size-11"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </span>
  );
}
