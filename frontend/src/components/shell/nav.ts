import type { LucideIcon } from 'lucide-react';
import { ClipboardCheck, FileText, LayoutDashboard, Plug, ReceiptText, Send, UserCog, Users } from 'lucide-react';
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
  /** Stay active on child routes (e.g. /payments/review/:id). */
  matchChildren?: boolean;
}

export const GROUP_ORDER: NavItem['group'][] = ['Work', 'Sales', 'Finance', 'Admin'];

// Only screens that exist are listed (D10): modules appear here the day they ship.
// The array order is the tab-bar order on phones; the sidebar regroups by GROUP_ORDER.
export const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', short: 'Home', icon: LayoutDashboard, roles: ['sales', 'admin', 'superadmin'], group: 'Work' },
  { to: '/payments/review', label: 'Approvals', short: 'Review', icon: ClipboardCheck, roles: ['admin'], group: 'Finance', badge: 'pending', matchChildren: true },
  { to: '/customers', label: 'Customers', short: 'Customers', icon: Users, roles: ['sales', 'admin', 'superadmin'], group: 'Sales', matchChildren: true },
  { to: '/payments/new', label: 'Submit payment', short: 'Submit', icon: Send, roles: ['sales'], group: 'Finance', primary: true },
  { to: '/payments', label: 'My payments', short: 'Payments', icon: ReceiptText, roles: ['sales'], group: 'Finance', badge: 'unseen' },
  { to: '/estimates', label: 'Estimates', short: 'Estimates', icon: FileText, roles: ['sales', 'admin', 'superadmin'], group: 'Sales', matchChildren: true },
  { to: '/settings/team', label: 'Team', short: 'Team', icon: UserCog, roles: ['superadmin'], group: 'Admin' },
  { to: '/settings/integrations', label: 'QuickBooks', short: 'QuickBooks', icon: Plug, roles: ['admin', 'superadmin'], group: 'Admin' },
];

export const navFor = (user: User) => NAV.filter((n) => n.roles.includes(user.role));

/** Live counts for nav badges, refreshed every 60s from a tiny endpoint (not the full lists). */
export function useNavCounts(): Record<'pending' | 'unseen', number> {
  const { data } = useCounts();
  return { pending: data?.pending ?? 0, unseen: data?.unseen ?? 0 };
}
