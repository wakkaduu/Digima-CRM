import { useState } from 'react';
import { NavLink } from 'react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { User } from '../../api/types';
import { cn } from '../../lib/cn';
import { CountChip } from '../ui/StatusBadge';
import { AccountMenu } from './AccountMenu';
import { BrandLockup } from './BrandLockup';
import { GROUP_ORDER, navFor, type NavItem } from './nav';

const KEY = 'digima.sidebar.collapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

/** Whether the sidebar is collapsed to the 64px rail; remembered per browser. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? '0' : '1');
      } catch {
        /* storage unavailable: the choice just won't persist */
      }
      return !c;
    });
  return [collapsed, toggle] as const;
}

export const SIDEBAR_WIDTH = { open: 'lg:pl-[232px]', rail: 'lg:pl-16' } as const;

function Item({ item, count, collapsed }: { item: NavItem; count: number; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={!item.matchChildren}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex min-h-(--control-h) items-center gap-3 rounded-control px-3 no-underline',
          isActive
            ? 'bg-accent-subtle font-semibold text-accent'
            : 'text-text hover:bg-surface-sunk',
          collapsed && 'justify-center px-0',
        )
      }
    >
      <item.icon aria-hidden className="size-5 shrink-0" />
      {!collapsed && <span className="flex-1">{item.label}</span>}
      {!collapsed ? (
        item.badge && <CountChip count={count} label={item.badge === 'pending' ? 'pending' : 'updates'} />
      ) : (
        <>
          {count > 0 && <span aria-hidden className="absolute top-2 right-2 size-2 rounded-full bg-accent" />}
          <span
            role="tooltip"
            className="pointer-events-none absolute left-full z-40 ml-2 hidden rounded-control bg-text px-2 py-1 text-small whitespace-nowrap text-white group-hover:block group-focus-visible:block"
          >
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );
}

/** Desktop (>= 1024px) navigation: grouped, role-filtered, collapsible to an icon rail. */
export function Sidebar({
  user,
  counts,
  collapsed,
  onToggle,
}: {
  user: User;
  counts: Record<'pending' | 'unseen', number>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const items = navFor(user);
  const groups = GROUP_ORDER.filter((g) => items.some((i) => i.group === g));

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex h-dvh flex-col border-r border-border bg-surface',
        collapsed ? 'w-16' : 'w-[232px]',
      )}
    >
      <div className={cn('flex h-14 items-center border-b border-border px-4', collapsed && 'justify-center px-0')}>
        <BrandLockup collapsed={collapsed} />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-2">
        {groups.map((g) => (
          <div key={g} className="mb-3">
            {!collapsed && <p className="px-3 pb-1 text-micro font-semibold tracking-wide text-text-muted uppercase">{g}</p>}
            <div className="flex flex-col gap-0.5">
              {items
                .filter((i) => i.group === g)
                .map((i) => (
                  <Item key={i.to} item={i} count={i.badge ? counts[i.badge] : 0} collapsed={collapsed} />
                ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-2 pb-1">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex min-h-(--control-h) w-full items-center gap-3 rounded-control px-3 text-text-muted hover:bg-surface-sunk',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <PanelLeftOpen aria-hidden className="size-5" /> : <PanelLeftClose aria-hidden className="size-5" />}
          {!collapsed && 'Collapse'}
        </button>
      </div>
      <AccountMenu user={user} collapsed={collapsed} />
    </aside>
  );
}
