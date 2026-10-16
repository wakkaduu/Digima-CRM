import { useSyncExternalStore } from 'react';

/** Tracks a CSS media query. Falls back to `false` where matchMedia is missing (tests, old browsers). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      if (typeof matchMedia !== 'function') return () => undefined;
      const mq = matchMedia(query);
      mq.addEventListener('change', notify);
      return () => mq.removeEventListener('change', notify);
    },
    () => (typeof matchMedia === 'function' ? matchMedia(query).matches : false),
    () => false,
  );
}

/** True while the on-screen keyboard is open (the visual viewport shrinks well below the layout viewport). */
export function useKeyboardOpen() {
  return useSyncExternalStore(
    (notify) => {
      const vv = window.visualViewport;
      vv?.addEventListener('resize', notify);
      return () => vv?.removeEventListener('resize', notify);
    },
    () => {
      const vv = window.visualViewport;
      return !!vv && window.innerHeight - vv.height > 150;
    },
    () => false,
  );
}
