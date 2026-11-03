import { useSyncExternalStore } from 'react';

export interface MaintenanceInfo {
  /** ISO date-time it is expected back, if the operator set one. */
  until: string | null;
  message: string | null;
}

let current: MaintenanceInfo | null = null;
const listeners = new Set<() => void>();

/** Called by the API client when the server answers 503 MAINTENANCE: the whole app switches to the maintenance page. */
export function reportMaintenance(details: unknown) {
  const d = (details ?? {}) as Partial<MaintenanceInfo>;
  const next = { until: typeof d.until === 'string' ? d.until : null, message: typeof d.message === 'string' ? d.message : null };
  if (current && current.until === next.until && current.message === next.message) return;
  current = next;
  listeners.forEach((l) => l());
}

/** For tests: back to normal. */
export function clearMaintenance() {
  current = null;
  listeners.forEach((l) => l());
}

export function useMaintenance() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
