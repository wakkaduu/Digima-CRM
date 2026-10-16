import type { LucideIcon } from 'lucide-react';
import { ClipboardCheck, Plug, ReceiptText, Send } from 'lucide-react';
import { useCounts } from '../../api/payments';
import type { Role, User } from '../../api/types';

export interface NavItem {
  to: string;
  label: string;
  /** Short label under the tab-bar icon. */
  short: string;
  icon: LucideIcon;
  roles: Role[];
  group: 'Work' | 'Sales' | 'Finance' | 'Admin';
  /** Which live count to show on the item. */
  badge?: 'pending' | 'unseen';
  /** Rendered as the raised centre action in the tab bar. */
  primary?: boolean;
  /** Stay active on child routes (e.g. /admin/:id). */
  matchChildren?: boolean;
}

// Only screens that exist are listed (D10): modules appear here the day they ship.
export const NAV: NavItem[] = [
  { to: '/payments/new', label: 'Submit payment', short: 'Submit', icon: Send, roles: ['sales'], group: 'Finance', primary: true },
  { to: '/payments', label: 'My payments', short: 'Payments', icon: ReceiptText, roles: ['sales'], group: 'Finance', badge: 'unseen' },
  { to: '/admin', label: 'Approvals', short: 'Review', icon: ClipboardCheck, roles: ['admin'], group: 'Finance', badge: 'pending', matchChildren: true },
  { to: '/setup', label: 'QuickBooks', short: 'QuickBooks', icon: Plug, roles: ['admin'], group: 'Admin' },
];

export const navFor = (user: User) => (user.mustChangePassword ? [] : NAV.filter((n) => n.roles.includes(user.role)));

/** Live counts for nav badges, refreshed every 60s from a tiny endpoint (not the full lists). */
export function useNavCounts(user: User): Record<'pending' | 'unseen', number> {
  const { data } = useCounts(!user.mustChangePassword);
  return { pending: data?.pending ?? 0, unseen: data?.unseen ?? 0 };
}
