import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/client';
import { ME_KEY } from './api/auth';

// A 401 from anywhere means the session ended: drop the cached user so route guards send us to /login.
// (QBO_REAUTH_REQUIRED is also a 401, but it is about QuickBooks, not the user's session.)
function handleSessionErrors(error: unknown) {
  if (!(error instanceof ApiError)) return;
  if (error.status === 401 && error.code !== 'QBO_REAUTH_REQUIRED') {
    queryClient.setQueryData(ME_KEY, null);
  } else if (error.code === 'MUST_CHANGE_PASSWORD') {
    void queryClient.invalidateQueries({ queryKey: ME_KEY });
  }
}

export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleSessionErrors }),
  mutationCache: new MutationCache({ onError: handleSessionErrors }),
  defaultOptions: {
    // 'always': never park a request while the phone reports "offline". The default ('online') leaves a submit
    // spinning forever at 0%; we want the call to fail at once so the rep sees "Connection lost" and can tap Retry.
    queries: { retry: false, refetchOnWindowFocus: false, networkMode: 'always' },
    mutations: { networkMode: 'always' },
  },
});
