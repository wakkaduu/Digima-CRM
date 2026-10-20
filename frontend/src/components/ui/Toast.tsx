import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, Info, OctagonAlert, TriangleAlert, X } from 'lucide-react';
import { cn } from '../../lib/cn';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface ToastInput {
  type?: ToastType;
  /** Short headline in bold above the text; worth setting for errors and warnings, so the kind of problem reads at a glance. */
  title?: string;
  text: string;
  /** How long it stays, in ms (default 5 s). Errors and warnings stay until dismissed. Use longer for a timed Undo. */
  durationMs?: number;
  /** Optional action, e.g. Undo or "View submission". */
  action?: { label: string; onClick: () => void };
}
interface ToastItem extends ToastInput {
  id: number;
  type: ToastType;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

// Tinted surface + strong border + icon in a solid chip. Status colours come only from the tokens, and the
// icon and headline say the same thing as the colour.
const STYLE: Record<ToastType, { box: string; chip: string; icon: LucideIcon; label: string }> = {
  success: { box: 'border-success bg-success-bg', chip: 'bg-success text-white', icon: CheckCircle2, label: 'Success' },
  info: { box: 'border-info bg-info-bg', chip: 'bg-info text-white', icon: Info, label: 'Note' },
  warning: { box: 'border-warning bg-warning-bg', chip: 'bg-warning text-white', icon: TriangleAlert, label: 'Warning' },
  error: { box: 'border-danger bg-danger-bg', chip: 'bg-danger text-white', icon: OctagonAlert, label: 'Error' },
};
const STAYS: ToastType[] = ['error', 'warning'];

/** Transient messages. Errors and warnings persist until dismissed; the rest close after 5s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      const type = t.type ?? 'success';
      setItems((l) => [...l, { ...t, id, type }]);
      if (!STAYS.includes(type)) setTimeout(() => dismiss(id), t.durationMs ?? 5000);
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);

  return (
    <ToastContext value={value}>
      {children}
      {/* Phones: just above the tab bar, in thumb reach. Desktop: top right under the top bar, where the eye already is. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+0.5rem)] z-60 flex flex-col gap-3 lg:inset-x-auto lg:top-[4.5rem] lg:right-6 lg:bottom-auto lg:w-[26rem]">
        {items.map((t) => {
          const s = STYLE[t.type];
          const loud = STAYS.includes(t.type);
          return (
            <div
              key={t.id}
              role={loud ? 'alert' : 'status'}
              className={cn('toast-in pointer-events-auto flex items-start gap-3 rounded-card border-2 p-3 shadow-float', s.box)}
            >
              <span aria-hidden className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full', s.chip)}>
                <s.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1 py-0.5">
                <p className="font-semibold">
                  <span className="sr-only">{s.label}: </span>
                  {t.title ?? (loud ? s.label : undefined)}
                </p>
                <p className={cn('text-text', !t.title && !loud && 'font-semibold')}>{t.text}</p>
                {t.action && (
                  <button
                    type="button"
                    className="mt-2 inline-flex min-h-(--control-h) items-center rounded-control border border-current bg-surface px-3 font-semibold text-text hover:bg-surface-sunk"
                    onClick={() => {
                      t.action!.onClick();
                      dismiss(t.id);
                    }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-control text-text hover:bg-surface/60 pointer-coarse:size-11"
                onClick={() => dismiss(t.id)}
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}
