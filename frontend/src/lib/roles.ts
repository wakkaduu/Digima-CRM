import type { Role } from '../api/types';

export const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: 'sales', label: 'Sales', hint: 'Submits payments and sees their own.' },
  { value: 'admin', label: 'Admin', hint: 'Reviews and approves payments; manages the QuickBooks connection.' },
  { value: 'superadmin', label: 'SuperAdmin', hint: 'Manages accounts and roles; sees reports and all data. Does not approve payments.' },
];

export const roleLabel = (r: Role) => ROLES.find((x) => x.value === r)?.label ?? r;
