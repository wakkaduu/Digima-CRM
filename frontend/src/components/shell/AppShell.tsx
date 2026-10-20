import { useEffect, useState, type ReactNode } from 'react';
import type { User } from '../../api/types';
import { cn } from '../../lib/cn';
import { useKeyboardOpen, useMediaQuery } from '../../lib/useMediaQuery';
import { ShellContext } from './ShellContext';
import { BrandLockup } from './BrandLockup';
import { CommandPalette } from './CommandPalette';
import { QboBanner } from './QboBanner';
import { useNavCounts } from './nav';
import { SIDEBAR_WIDTH, Sidebar, useSidebarCollapsed } from './Sidebar';
import { TabBar } from './TabBar';
import { AlertsLink, SearchButton, TopBar } from './TopBar';

/**
 * Mobile-first shell: header + content + bottom tab bar under 1024px;
 * from 1024px a left sidebar replaces the tab bar. Only one of the two is mounted.
 */
export function AppShell({ user, children }: { user: User; children: ReactNode }) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  const keyboardOpen = useKeyboardOpen();
  const [collapsed, toggle] = useSidebarCollapsed();
  const counts = useNavCounts(user);
  const [hideTabs, setHideTabs] = useState(false);
  const showTabs = !desktop && !keyboardOpen && !hideTabs;
  const [searchOpen, setSearchOpen] = useState(false);
  const canSearch = !user.mustChangePassword;

  // Ctrl/Cmd+K opens the search from anywhere.
  useEffect(() => {
    if (!canSearch) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canSearch]);

  return (
    <ShellContext value={{ setHideTabs }}>
    <div className={cn('min-h-dvh', desktop && (collapsed ? SIDEBAR_WIDTH.rail : SIDEBAR_WIDTH.open))}>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      {desktop ? (
        <Sidebar user={user} counts={counts} collapsed={collapsed} onToggle={toggle} />
      ) : (
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4 pt-[env(safe-area-inset-top)]">
          <BrandLockup />
          {canSearch && (
            <div className="flex items-center">
              <SearchButton onClick={() => setSearchOpen(true)} />
              <AlertsLink user={user} counts={counts} />
            </div>
          )}
        </header>
      )}
      {desktop && canSearch && <TopBar user={user} counts={counts} onSearch={() => setSearchOpen(true)} />}
      <QboBanner user={user} />
      <main
        id="content"
        tabIndex={-1}
        className={cn(
          'mx-auto w-full max-w-[720px] px-4 py-6 lg:max-w-[1200px] lg:px-6',
          showTabs && 'pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+1.5rem)]',
        )}
      >
        {children}
      </main>
      {showTabs && <TabBar user={user} counts={counts} />}
      {canSearch && <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} user={user} />}
    </div>
    </ShellContext>
  );
}
