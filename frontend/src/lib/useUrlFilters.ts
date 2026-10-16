import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Filter state kept in the URL query (?tab=pending&q=acme), so a view can be linked, survives a refresh and
 * the Back button. Values equal to their default are left out of the URL. `defaults` must be a stable object
 * (define it outside the component). Updates replace the history entry so typing does not flood Back.
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const out = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof T)[]) out[key] = (params.get(key as string) ?? defaults[key]) as T[keyof T];
    return out;
  }, [params, defaults]);

  const set = useCallback(
    (patch: Partial<T>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === '' || value === defaults[key]) next.delete(key);
            else next.set(key, value as string);
          }
          return next;
        },
        { replace: true },
      ),
    [setParams, defaults],
  );

  /** Reset the given keys (default: all of them) to their defaults. */
  const reset = useCallback(
    (keys: (keyof T & string)[] = Object.keys(defaults)) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          keys.forEach((k) => next.delete(k));
          return next;
        },
        { replace: true },
      ),
    [setParams, defaults],
  );

  return { values, set, reset };
}
