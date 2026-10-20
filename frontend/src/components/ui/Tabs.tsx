import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface TabDef {
  id: string;
  label: string;
}

/**
 * Page tabs (WAI-ARIA tabs pattern): arrow keys move between tabs, Home/End jump. The caller renders the
 * active panel inside <TabPanel>. Selection lives in the caller (usually the URL) so a tab can be linked.
 */
export function Tabs({ label, tabs, value, onChange }: { label: string; tabs: TabDef[]; value: string; onChange: (id: string) => void }) {
  const base = useId();

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const t = tabs[(next + tabs.length) % tabs.length]!;
    onChange(t.id);
    document.getElementById(`${base}-tab-${t.id}`)?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="mb-4 flex flex-wrap gap-x-1 border-b border-border">
      {tabs.map((t, i) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            id={`${base}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${base}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              '-mb-px min-h-(--control-h) border-b-2 px-4 whitespace-nowrap',
              active ? 'border-accent font-semibold text-accent' : 'border-transparent text-text-muted hover:text-text',
            )}
          >
            {t.label}
          </button>
        );
      })}
      <span id={`${base}-panel`} hidden />
    </div>
  );
}

export function TabPanel({ children }: { children: ReactNode }) {
  return <div role="tabpanel">{children}</div>;
}
