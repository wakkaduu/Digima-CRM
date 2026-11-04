import { useSyncExternalStore } from 'react';

// Which tour is open, shared by the shell (which shows it) and anything that replays it (Help, the account menu, the
// "Tour this page" button). The welcome tour shows the main screens; a page tour shows the controls of one page.
// `auto` is true when the app offered it by itself rather than the person asking for it.

export type TourKind = { kind: 'main' } | { kind: 'page'; page: string };
type State = { open: false } | ({ open: true; auto: boolean } & TourKind);

let state: State = { open: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** The welcome tour of the main screens. */
export function startTour(auto = false) {
  state = { open: true, auto, kind: 'main' };
  emit();
}

/** The tips for one page. */
export function startPageTour(page: string, auto = false) {
  state = { open: true, auto, kind: 'page', page };
  emit();
}

export function closeTour() {
  state = { open: false };
  emit();
}

export const getTourState = () => state;

export const useTourState = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );

/*
 * "Once per sign-in": each tour is offered by itself right after a sign-in (the welcome tour) or on the first visit to
 * its page after a sign-in (a page tour), not on every page load. The key is the sign-in itself (the server's
 * signedInAt), so signing out and in again, even in the same tab, offers it again, until the person finishes it or asks
 * not to see it again (saved on their account).
 */
const prefix = (userId: string) => `digima.tour.offered.${userId}.`;
const offeredKey = (userId: string, signedInAt: number | null | undefined, which: string) =>
  `${prefix(userId)}${signedInAt ?? 'session'}.${which}`;

export function wasOffered(userId: string, signedInAt: number | null | undefined, which = 'main') {
  try {
    const key = offeredKey(userId, signedInAt, which);
    return localStorage.getItem(key) === '1' || sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function markOffered(userId: string, signedInAt: number | null | undefined, which = 'main') {
  try {
    if (signedInAt) {
      // A known sign-in is remembered across tabs (a second tab does not offer it twice). Marks from earlier sign-ins
      // are dropped so they do not pile up.
      for (const k of Object.keys(localStorage)) if (k.startsWith(prefix(userId)) && !k.startsWith(`${prefix(userId)}${signedInAt}.`)) localStorage.removeItem(k);
      localStorage.setItem(offeredKey(userId, signedInAt, which), '1');
    } else {
      sessionStorage.setItem(offeredKey(userId, signedInAt, which), '1');
    }
  } catch {
    /* storage unavailable: it may be offered again on reload, which is harmless */
  }
}
