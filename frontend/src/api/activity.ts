import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './client';
import type { ActivityCategory, ActivityEvent } from './types';

export const ACTIVITY_KEY = ['activity'] as const;

export interface ActivityFilters {
  category?: ActivityCategory;
  actor?: string;
  failed?: boolean;
  page: number;
  pageSize: number;
}

/** The SuperAdmin activity log, newest first. The previous page stays on screen while the next one loads. */
export const useActivity = (f: ActivityFilters) =>
  useQuery({
    queryKey: [...ACTIVITY_KEY, f],
    queryFn: () => {
      const q = new URLSearchParams({ page: String(f.page), pageSize: String(f.pageSize) });
      if (f.category) q.set('category', f.category);
      if (f.actor) q.set('actor', f.actor);
      if (f.failed) q.set('failed', 'true');
      return api<{ items: ActivityEvent[]; total: number; page: number; pageSize: number }>(`/api/activity?${q}`);
    },
    placeholderData: keepPreviousData,
  });
