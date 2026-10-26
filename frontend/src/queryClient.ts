import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client';
import { ME_KEY, signInUrl } from './api/auth';

const REAUTH_TRIP_KEY = 'digima.qbo.reauth';
const REAUTH_TRIP_GAP_MS = 30_000;

/**
 * The user's QuickBooks connection is gone or expired: send them through "Sign in with QuickBooks", which renews it,
 * and bring them back to this page. Only for reads, so a half-filled form is never thrown away; a failed write shows
 * its error and the shell banner instead. One automatic trip per 30 s, so a sign-in that cannot fix it shows the
 * error rather than looping.
 */
function signInAgain() {
  try {
    const last = Number(sessionStorage.getItem(REAUTH_TRIP_KEY));
    if (Date.now() - last < REAUTH_TRIP_GAP_MS) return;
    sessionStorage.setItem(REAUTH_TRIP_KEY, String(Date.now()));
  } catch {
    /* storage unavailable: fall through and redirect once */
  }
  window.location.assign(signInUrl(window.location.pathname + window.location.search));
}

// A 401 from anywhere means the session ended: drop the cached user so route guards send us to /login.
// (QBO_REAUTH_REQUIRED is also a 401, but it is about the user's QuickBooks connection, not the session.)
function handleSessionErrors(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 401) return;
  if (error.code !== 'QBO_REAUTH_REQUIRED') queryClient.setQueryData(ME_KEY, null);
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      handleSessionErrors(error);
      if (error instanceof ApiError && error.code === 'QBO_REAUTH_REQUIRED') signInAgain();
    },
  }),
  mutationCache: new MutationCache({ onError: handleSessionErrors }),
  defaultOptions: {
    // 'always': never park a request while the phone reports "offline". The default ('online') leaves a submit
    // spinning forever at 0%; we want the call to fail at once so the rep sees "Connection lost" and can tap Retry.
    queries: { retry: false, refetchOnWindowFocus: false, networkMode: 'always' },
    mutations: { networkMode: 'always' },
  },
});
