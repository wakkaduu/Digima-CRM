import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Role, TeamMember } from './types';

export const TEAM_KEY = ['team'] as const;

/** The one-time link, returned only when it is created: it cannot be fetched again. */
export interface InviteResult {
  user: TeamMember;
  inviteUrl: string;
  inviteExpiresAt: string;
}

/** SuperAdmin only: every account, active or not. */
export const useTeam = (enabled = true) =>
  useQuery({
    queryKey: TEAM_KEY,
    enabled,
    queryFn: async () => (await api<{ users: TeamMember[] }>('/api/users')).users,
  });

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; email: string; role: Role }) =>
      api<InviteResult>('/api/users', { method: 'POST', json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEAM_KEY }),
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; role?: Role; active?: boolean }) =>
      api<{ user: TeamMember }>(`/api/users/${id}`, { method: 'PATCH', json: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEAM_KEY }),
  });
}

/** A fresh invite link; the old one stops working. */
export function useReinvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<InviteResult>(`/api/users/${id}/invite`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEAM_KEY }),
  });
}
