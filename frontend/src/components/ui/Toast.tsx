import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, TriangleAlert, X } from 'lucide-react';
import { cn } from '../../lib/cn';

type ToastType = 'success' | 'error' | 'info';
interface ToastInput {
  type?: ToastType;
  text: string;
  /** How long it stays, in ms (default 5 s; errors stay until dismissed). Use longer for a timed Undo. */
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

/** Transient confirmations. Errors persist until dismissed; others close after 5s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (t: ToastInput) => {
      const id = nextId.current++;
      const type = t.type ?? 'success';
      setItems((l) => [...l, { ...t, id, type }]);
      if (type !== 'error') setTimeout(() => dismiss(id), t.durationMs ?? 5000);
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);

  return (
    <ToastContext value={value}>
      {children}
      {/* Above the tab bar on phones (never under it); bottom-right on desktop. */}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+0.5rem)] z-60 flex flex-col gap-2 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-card border bg-surface px-3 py-3 shadow-float',
              t.type === 'error' ? 'border-danger' : 'border-border',
            )}
          >
            {t.type === 'error' ? (
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
            ) : (
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
            )}
            <p className="flex-1">{t.text}</p>
            {t.action && (
              <button
                type="button"
                className="font-semibold text-accent underline"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss" className="text-text-muted" onClick={() => dismiss(t.id)}>
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
