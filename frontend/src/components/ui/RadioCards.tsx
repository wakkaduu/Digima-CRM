import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface Props {
  name: string;
  legend: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  hint?: ReactNode;
  /** Id of the first radio, so validation can focus it. */
  firstId?: string;
  /** Options that span the full row on phones (e.g. a lone last item). */
  wide?: string[];
  labelFor?: (option: string) => string;
}

/** Real radio inputs styled as cards (>= 56px tall): 2 columns on phones, one row on desktop. */
export function RadioCards({ name, legend, options, value, onChange, error, hint, firstId, wide = [], labelFor }: Props) {
  const errId = `${name}-error`;
  return (
    <fieldset className="mb-4 min-w-0 border-0 p-0" aria-describedby={error ? errId : undefined}>
      <legend className="mb-1 p-0 font-semibold scroll-mb-32">{legend}</legend>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {options.map((o, i) => (
          <label
            key={o}
            className={cn(
              'flex min-h-14 cursor-pointer items-center gap-2 rounded-control border px-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring',
              value === o ? 'border-accent bg-accent-subtle font-semibold text-accent' : 'border-border-strong bg-surface',
              error && !value && 'border-danger',
              wide.includes(o) && 'col-span-2 lg:col-span-1',
            )}
          >
            <input
              type="radio"
              name={name}
              id={i === 0 ? firstId : undefined}
              value={o}
              checked={value === o}
              onChange={() => onChange(o)}
              aria-invalid={error ? true : undefined}
              className="size-5 shrink-0 accent-accent"
            />
            {labelFor ? labelFor(o) : o}
          </label>
        ))}
      </div>
      {hint && <p className="mt-1 text-small text-text-muted">{hint}</p>}
      {error && (
        <p id={errId} className="mt-1 text-small font-semibold text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
