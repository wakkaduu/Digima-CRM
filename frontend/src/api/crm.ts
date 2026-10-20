import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { CustomerDetail, CustomerRow, EstimateDetail, EstimateRow, LinkedPayment, PagedResult } from './types';

export const CRM_KEY = ['crm'] as const;

/** `?a=1&b=2` from the defined, non-empty values (so unset filters stay out of the request). */
function qs(params: object) {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') out.set(k, String(v));
  return out.toString();
}

export interface ListParams {
  q?: string;
  status?: string;
  sort?: string;
  page: number;
  pageSize: number;
}

/* ── Customers ── */

export const useCustomers = (params: ListParams, enabled = true) =>
  useQuery({
    enabled,
    queryKey: [...CRM_KEY, 'customers', qs(params)],
    queryFn: () =>
      api<PagedResult<CustomerRow> & { counts: { all: number; active: number; inactive: number } }>(`/api/customers?${qs(params)}`),
    placeholderData: keepPreviousData, // keep the old page on screen while the next one loads
  });

export const useCustomer = (id: string | undefined) =>
  useQuery({
    queryKey: [...CRM_KEY, 'customer', id],
    enabled: !!id,
    queryFn: () => api<{ customer: CustomerDetail; lookbackDays: number }>(`/api/customers/${id}`),
  });

/* ── Estimates ── */

export const useEstimates = (params: ListParams & { customerId?: string }, enabled = true) =>
  useQuery({
    queryKey: [...CRM_KEY, 'estimates', qs(params)],
    enabled,
    queryFn: () =>
      api<PagedResult<EstimateRow> & { counts: Record<string, number>; lookbackDays: number }>(`/api/estimates?${qs(params)}`),
    placeholderData: keepPreviousData,
  });

export const useEstimate = (id: string | undefined) =>
  useQuery({
    queryKey: [...CRM_KEY, 'estimate', id],
    enabled: !!id,
    queryFn: async () => (await api<{ estimate: EstimateDetail }>(`/api/estimates/${id}`)).estimate,
  });

/* ── Payments linked to a customer or an estimate ── */

export const useLinkedPayments = (filter: { customerId?: string; estimateId?: string }, enabled = true) =>
  useQuery({
    queryKey: [...CRM_KEY, 'payments', filter],
    enabled,
    queryFn: () => api<PagedResult<LinkedPayment>>(`/api/payments?${qs({ ...filter, pageSize: 50, page: 1, sort: 'createdAt:desc' })}`),
  });
