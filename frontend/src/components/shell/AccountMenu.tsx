import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChevronUp, KeyRound, LogOut } from 'lucide-react';
import { useLogout } from '../../api/auth';
import type { User } from '../../api/types';
import { cn } from '../../lib/cn';

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

export function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-small font-semibold text-accent"
    >
      {initials(name)}
    </span>
  );
}

const itemClass =
  'flex w-full min-h-(--control-h) items-center gap-2 rounded-control px-3 text-left text-text no-underline hover:bg-surface-sunk';

/** Change password + Log out. Shared by the sidebar menu and the mobile "More" sheet. */
export function AccountActions({ user, onDone }: { user: User; onDone?: () => void }) {
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <>
      {!user.mustChangePassword && (
        <Link to="/password" className={itemClass} onClick={onDone}>
          <KeyRound aria-hidden className="size-4" /> Change password
        </Link>
      )}
      <button
        type="button"
        className={itemClass}
        onClick={async () => {
          onDone?.();
          await logout();
          navigate('/login', { replace: true });
        }}
      >
        <LogOut aria-hidden className="size-4" /> Log out
      </button>
    </>
  );
}

/** Sidebar foot: avatar, name and role; opens a menu upwards. `collapsed` shows the avatar only. */
export function AccountMenu({ user, collapsed }: { user: User; collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative border-t border-border p-2">
      {open && (
        <div
          id={menuId}
          className={cn(
            'absolute bottom-full z-40 mb-1 rounded-card border border-border bg-surface p-1 shadow-float',
            collapsed ? 'left-2 w-52' : 'inset-x-2',
          )}
        >
          <AccountActions user={user} onDone={() => setOpen(false)} />
        </div>
      )}
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={collapsed ? `Account: ${user.name}` : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-control p-1.5 text-left hover:bg-surface-sunk"
      >
        <Avatar name={user.name} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{user.name}</span>
              <span className="block text-micro text-text-muted capitalize">{user.role}</span>
            </span>
            <ChevronUp aria-hidden className={cn('size-4 text-text-muted', !open && 'rotate-180')} />
          </>
        )}
      </button>
    </div>
  );
}
