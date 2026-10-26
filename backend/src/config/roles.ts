import type { UserRole } from '@prisma/client';

// Roles are strict: a route lists exactly who may use it (see requireRole).
//  sales      submit payments and see their own history
//  admin      review payments (approve / reject) and see everyone's
//  superadmin manage accounts and roles, see reports and everyone's data; does not submit or approve
export const ALL_ROLES: UserRole[] = ['sales', 'admin', 'superadmin'];
// How much payment data a role sees: sales only their own rows, everyone else all of it.
export const dataScope = (role: UserRole): 'sales' | 'admin' => (role === 'sales' ? 'sales' : 'admin');
// Everyone who may browse QuickBooks data (customers, estimates, dashboard).
export const BROWSE_ROLES = ALL_ROLES;
