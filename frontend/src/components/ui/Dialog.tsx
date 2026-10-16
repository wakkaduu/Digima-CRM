import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './Button';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Sticky action row (buttons). */
  footer?: ReactNode;
  /** Fill the whole screen under 640px (pickers with a keyboard open). */
  fullScreen?: boolean;
}

/**
 * Native <dialog> (focus trap, Esc and focus return come from the browser).
 * Under 640px it is a bottom sheet with a drag handle; from 640px up a centred dialog.
 */
export function Dialog({ open, onClose, title, children, footer, fullScreen }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [drag, setDrag] = useState<number | null>(null);
  const startY = useRef(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);

  // Scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const onHandleDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    setDrag(0);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (drag !== null) setDrag(Math.max(0, e.clientY - startY.current));
  };
  const onHandleUp = () => {
    if (drag !== null && drag > 80) onClose();
    setDrag(null);
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault(); // state is owned by `open`; let the parent decide
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()} // scrim click
      style={drag ? { transform: `translateY(${drag}px)` } : undefined}
      className={cn(
        cn('fixed inset-0 z-50 m-0 mt-auto w-full max-w-none flex-col overflow-hidden bg-surface p-0 text-text shadow-float rounded-t-sheet', fullScreen ? 'h-dvh max-h-dvh rounded-none sm:h-auto sm:max-h-[90dvh] sm:rounded-card' : 'max-h-[90dvh]'),
        'sm:m-auto sm:max-w-lg sm:rounded-card',
        'open:flex backdrop:bg-black/40',
      )}
    >
      {!fullScreen && (
      <div
        aria-hidden
        className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center sm:hidden"
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={() => setDrag(null)}
      >
        <span className="h-1 w-10 rounded-full bg-border-strong" />
      </div>
      )}
      <header className={cn('flex items-center justify-between gap-3 px-4 pb-2 sm:pt-4', fullScreen && 'pt-3')}>
        <h2 id={titleId} className="text-[1.0625rem] font-semibold">
          {title}
        </h2>
        <Button variant="ghost" size="sm" aria-label="Close" onClick={onClose} className="px-2">
          <X aria-hidden className="size-4" />
        </Button>
      </header>
      <div className="overflow-y-auto px-4 py-2">{children}</div>
      {footer && (
        <footer className="flex flex-col-reverse gap-2 border-t border-border bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
          {footer}
        </footer>
      )}
    </dialog>
  );
}
