import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { User } from './types';

export const ME_KEY = ['me'] as const;

/** The logged-in user, or null. Everything that needs a session reads this one query. */
export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => (await api<{ user: User | null }>('/api/auth/me')).user,
    staleTime: 60_000,
    retry: false,
  });
}

export const homePath = (_user: User) => '/dashboard';

/** Where the browser goes to sign in with QuickBooks (a real navigation: the backend redirects to Intuit and back). */
export const signInUrl = (next?: string | null) =>
  next && safeNext(next) ? `/api/auth/qbo/login?next=${encodeURIComponent(next)}` : '/api/auth/qbo/login';

/**
 * Where a user who is already signed in (by email or QuickBooks) goes to connect or renew their own QuickBooks
 * connection. Same Intuit sign-in, but it attaches to the current account instead of starting a session.
 */
export const connectUrl = (next?: string | null) =>
  `/api/auth/qbo/login?mode=connect${next && safeNext(next) ? `&next=${encodeURIComponent(next)}` : ''}`;

/** Only same-site paths are allowed as a post-login destination (no open redirects). */
export const safeNext = (next: string | null) =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : null;

export function useLogout() {
  const qc = useQueryClient();
  return async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    qc.clear();
    qc.setQueryData(ME_KEY, null);
  };
}
