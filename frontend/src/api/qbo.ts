import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { QboStatus } from './types';

/** Cheap status (no call to Intuit). The setup page uses its own `verify=true` query. */
export const QBO_STATUS_KEY = ['qbo', 'status', 'light'] as const;
/** Set to true when an approval fails with QBO_REAUTH_REQUIRED, so the shell can warn on every admin page. */
export const QBO_REAUTH_KEY = ['qbo', 'reauth'] as const;

export const useQboStatus = (enabled = true) =>
  useQuery({
    queryKey: QBO_STATUS_KEY,
    enabled,
    queryFn: () => api<QboStatus>('/api/auth/qbo/status'),
    refetchInterval: 5 * 60_000,
  });

export const useQboReauthFlag = (enabled = true) =>
  useQuery({
    queryKey: QBO_REAUTH_KEY,
    enabled,
    queryFn: async () => false,
    initialData: false,
    staleTime: Infinity,
  }).data;
