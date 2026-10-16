import { useEffect, useRef } from 'react';

interface Handlers {
  next: () => void;
  prev: () => void;
  approve: () => void;
  reject: () => void;
  help: () => void;
}

const TYPING = 'input, textarea, select, [contenteditable="true"]';

/**
 * J/K move through the queue, A and R open the approve / reject confirmations, ? lists the keys.
 * Never acts without a confirmation, and stays out of the way while typing or while a dialog is open.
 */
export function useQueueShortcuts(handlers: Handlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest(TYPING) || document.querySelector('dialog[open]')) return;
      const h = ref.current;
      switch (e.key) {
        case 'j':
          return h.next();
        case 'k':
          return h.prev();
        case 'a':
          return h.approve();
        case 'r':
          return h.reject();
        case '?':
          e.preventDefault();
          return h.help();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}
