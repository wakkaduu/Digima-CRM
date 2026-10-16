import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';

type MessageType = 'error' | 'ok' | 'info' | 'warning';

const TONE: Record<MessageType, string> = {
  error: 'bg-danger-bg border-danger text-danger',
  ok: 'bg-success-bg border-success text-success',
  info: 'bg-info-bg border-info text-info',
  warning: 'bg-warning-bg border-warning text-warning',
};

interface Props {
  type?: MessageType;
  /** Move keyboard focus here (use after a submit so screen readers announce the result). */
  focus?: boolean;
  children: ReactNode;
  className?: string;
}

/** Messages carry words, not just colour: errors are prefixed with "Error:". */
export function Message({ type = 'error', focus = false, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focus && ref.current) {
      ref.current.focus();
      ref.current.scrollIntoView({ block: 'nearest' });
    }
  }, [focus, children]);

  return (
    <div ref={ref} tabIndex={-1} className={cn('mb-4 rounded-control border px-3.5 py-3', TONE[type], className)} role={type === 'error' ? 'alert' : 'status'}>
      {type === 'error' ? 'Error: ' : null}
      {children}
    </div>
  );
}
