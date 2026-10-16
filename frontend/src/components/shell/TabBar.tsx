import { useState } from 'react';
import { NavLink } from 'react-router';
import { Ellipsis } from 'lucide-react';
import type { User } from '../../api/types';
import { cn } from '../../lib/cn';
import { CountChip } from '../ui/StatusBadge';
import { Dialog } from '../ui/Dialog';
import { AccountActions, Avatar } from './AccountMenu';
import { navFor } from './nav';

const MAX_TABS = 4; // plus "More" = 5 slots

/** Phone/tablet (< 1024px) navigation: bottom tab bar with a raised centre action and a "More" sheet. */
export function TabBar({ user, counts }: { user: User; counts: Record<'pending' | 'unseen', number> }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const items = navFor(user);
  const tabs = items.slice(0, MAX_TABS);
  const overflow = items.slice(MAX_TABS);
  // The primary action sits in the middle of the bar.
  const primaryIdx = tabs.findIndex((t) => t.primary);
  if (primaryIdx >= 0) tabs.splice(Math.floor(tabs.length / 2), 0, tabs.splice(primaryIdx, 1)[0]!);

  const slot = 'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-micro no-underline';

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        {tabs.map((t) => {
          const count = t.badge ? counts[t.badge] : 0;
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={!t.matchChildren}
              className={({ isActive }) =>
                cn(slot, isActive ? 'border-t-2 border-accent font-semibold text-accent' : 'border-t-2 border-transparent text-text-muted')
              }
            >
              {t.primary ? (
                <span className="-mt-5 inline-flex size-12 items-center justify-center rounded-full border-2 border-surface bg-accent text-white">
                  <t.icon aria-hidden className="size-5" />
                </span>
              ) : (
                <t.icon aria-hidden className="size-5" />
              )}
              <span>{t.short}</span>
              {count > 0 && (
                <span className="absolute top-1 left-1/2 ml-2">
                  <CountChip count={count} label={t.badge === 'pending' ? 'pending' : 'updates'} />
                </span>
              )}
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          className={cn(slot, 'border-t-2 border-transparent text-text-muted')}
        >
          <Ellipsis aria-hidden className="size-5" />
          <span>More</span>
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="mb-2 flex items-center gap-3 border-b border-border pb-3">
          <Avatar name={user.name} />
          <div>
            <p className="font-semibold">{user.name}</p>
            <p className="text-micro text-text-muted capitalize">{user.role}</p>
          </div>
        </div>
        <div className="flex flex-col pb-2">
          {overflow.map((o) => (
            <NavLink
              key={o.to}
              to={o.to}
              end={!o.matchChildren}
              onClick={() => setMoreOpen(false)}
              className="flex min-h-(--control-h) items-center gap-2 rounded-control px-3 text-text no-underline hover:bg-surface-sunk"
            >
              <o.icon aria-hidden className="size-4" /> {o.label}
            </NavLink>
          ))}
          <AccountActions user={user} onDone={() => setMoreOpen(false)} />
        </div>
      </Dialog>
    </>
  );
}
