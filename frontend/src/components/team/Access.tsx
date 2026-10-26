import type { TeamMember } from '../../api/types';
import { dateShort } from '../../lib/format';
import { StatusDot } from '../ui/StatusBadge';

/** Where a person stands: deactivated, signed up (linked), waiting on an invite, or the invite ran out. */
export function Access({ member }: { member: TeamMember }) {
  if (!member.active) return <StatusDot tone="danger">Deactivated</StatusDot>;
  if (member.linked) return <StatusDot tone="success">Linked to QuickBooks</StatusDot>;
  if (member.invitePending && member.inviteExpiresAt) {
    return new Date(member.inviteExpiresAt) > new Date()
      ? <StatusDot tone="warning">Invite pending · expires {dateShort(member.inviteExpiresAt)}</StatusDot>
      : <StatusDot tone="danger">Invite expired</StatusDot>;
  }
  return <StatusDot tone="neutral">Not invited yet</StatusDot>;
}
