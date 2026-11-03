import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { Report, ReportGroup } from './types';

export const REPORTS_KEY = ['reports'] as const;

/** The SuperAdmin report for a Manila date range. The previous answer stays on screen while a new range loads. */
export const useReport = ({ from, to, group }: { from: string; to: string; group?: ReportGroup }) =>
  useQuery({
    queryKey: [...REPORTS_KEY, from, to, group ?? 'auto'],
    queryFn: () => {
      const q = new URLSearchParams({ from, to, ...(group ? { group } : {}) });
      return api<Report>(`/api/reports?${q}`);
    },
    placeholderData: keepPreviousData,
  });
