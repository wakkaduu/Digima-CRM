import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { BankConfig, Estimate, HistoryPayment, MyPayment, PaymentDetail, PendingPayment, Receiver } from './types';

/** Everything under this key is payment data; invalidate it after a decision. */
export const PAYMENTS_KEY = ['payments'] as const;
export const MINE_KEY = ['payments', 'mine'] as const;
export const PENDING_KEY = ['payments', 'pending'] as const;
export const COUNTS_KEY = ['payments', 'counts'] as const;
export const RECEIVERS_KEY = ['payments', 'receivers'] as const;

export const useMyPayments = (refetchInterval?: number, enabled = true) =>
  useQuery({
    queryKey: MINE_KEY,
    enabled,
    queryFn: () => api<{ payments: MyPayment[]; unseenCount: number }>('/api/payments/mine'),
    refetchInterval,
  });

export const usePendingPayments = (refetchInterval?: number, enabled = true) =>
  useQuery({
    queryKey: PENDING_KEY,
    enabled,
    queryFn: () => api<{ count: number; payments: PendingPayment[] }>('/api/payments/pending'),
    refetchInterval,
  });

/** Navigation badge numbers (admin: `pending`, sales: `unseen`) without downloading the lists. */
export const useCounts = (enabled = true) =>
  useQuery({
    queryKey: COUNTS_KEY,
    enabled,
    queryFn: () => api<{ pending?: number; unseen?: number }>('/api/payments/counts'),
    refetchInterval: 60_000,
  });

export const useReceivers = (enabled = true) =>
  useQuery({
    queryKey: RECEIVERS_KEY,
    enabled,
    queryFn: async () => (await api<{ receivers: Receiver[] }>('/api/payments/receivers')).receivers,
  });

/* ── Server-side history (UI-5.1) ── */

export interface HistoryParams {
  status?: string;
  q?: string;
  rep?: string;
  bank?: string;
  /** Submitted on or after / on or before this day (YYYY-MM-DD, Manila). */
  from?: string;
  to?: string;
  sort?: string;
  page: number;
  pageSize: number;
}

export function usePaymentsList(params: HistoryParams, enabled = true) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'list', qs.toString()],
    enabled,
    queryFn: () => api<{ items: HistoryPayment[]; total: number; page: number; pageSize: number }>(`/api/payments?${qs}`),
    placeholderData: keepPreviousData, // keep the old page on screen while the next one loads
  });
}

export const usePaymentDetail = (id: string | undefined, enabled = true) =>
  useQuery({
    queryKey: [...PAYMENTS_KEY, 'detail', id],
    enabled: enabled && !!id,
    queryFn: async () => (await api<{ payment: PaymentDetail }>(`/api/payments/${id}`)).payment,
  });

/* ── Config (UI-5.3) ── */

/** Used until the API answers (or if it cannot), so the form never breaks on a config hiccup. */
export const FALLBACK_BANK_CONFIG: BankConfig = {
  banks: ['BDO', 'UnionBank', 'Digima', 'Happy Med', 'Cash'].map((label) => ({
    id: label,
    key: label.replace(/\s/g, ''),
    label,
    referenceNumber: label === 'Cash' ? 'none' : 'optional',
  })),
  defaultFeePercent: 1.5,
};

export function useBankConfig(enabled = true) {
  const q = useQuery({
    queryKey: ['config', 'banks'],
    enabled,
    queryFn: () => api<BankConfig>('/api/config/banks'),
    staleTime: 60 * 60_000,
  });
  return q.data ?? FALLBACK_BANK_CONFIG;
}

/* ── Estimates (UI-5.8) ── */

const ESTIMATES_KEY = ['qbo', 'estimates'] as const;

/** Cheap call that also tells us whether QuickBooks is reachable and warms the server's estimate cache. */
export const useEstimateProbe = () =>
  useQuery({
    queryKey: [...ESTIMATES_KEY, 'probe'],
    queryFn: () => api<{ total: number; estimates: Estimate[] }>('/api/qbo/estimates?limit=1'),
    retry: false,
  });

/** The estimates this rep submitted for most recently. */
export const useRecentEstimates = (enabled = true) =>
  useQuery({
    queryKey: [...PAYMENTS_KEY, 'recent-estimates'],
    enabled,
    queryFn: async () => (await api<{ estimates: Estimate[] }>('/api/payments/recent-estimates')).estimates,
    retry: false,
  });

/** Server-side estimate search; the caller debounces `query`. Matches are capped at `limit`, `total` counts them all. */
export function useEstimateSearch(query: string, limit: number) {
  const q = query.trim();
  return useQuery({
    queryKey: [...ESTIMATES_KEY, 'search', q, limit],
    enabled: q.length > 0,
    queryFn: () => api<{ total: number; estimates: Estimate[] }>(`/api/qbo/estimates?q=${encodeURIComponent(q)}&limit=${limit}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
