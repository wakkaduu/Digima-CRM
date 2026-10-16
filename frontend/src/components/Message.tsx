import { useEffect, useRef, type ReactNode } from 'react';

type MessageType = 'error' | 'ok' | 'info';

interface Props {
  type?: MessageType;
  /** Move keyboard focus here (use after a submit so screen readers announce the result). */
  focus?: boolean;
  children: ReactNode;
}

/** Messages carry words, not just colour: errors are prefixed with "Error:". */
export function Message({ type = 'error', focus = false, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focus && ref.current) {
      ref.current.focus();
      ref.current.scrollIntoView({ block: 'nearest' });
    }
  }, [focus, children]);

  return (
    <div ref={ref} tabIndex={-1} className={`msg msg-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {type === 'error' ? 'Error: ' : null}
      {children}
    </div>
  );
}
