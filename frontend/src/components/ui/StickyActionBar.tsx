import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useHideTabs } from '../shell/ShellContext';

/**
 * Primary page action pinned to the bottom of the phone screen (safe-area aware). Replaces the tab bar while
 * mounted so two bars never stack; from 1024px it is an ordinary in-flow block.
 */
export function StickyActionBar({ children }: { children: ReactNode }) {
  useHideTabs();
  useEffect(() => {
    // Toasts anchor above whichever bar is showing.
    document.documentElement.style.setProperty('--tabbar-h', '72px');
    return () => {
      document.documentElement.style.removeProperty('--tabbar-h');
    };
  }, []);
  return (
    <>
      <div aria-hidden className="h-24 lg:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:static lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto max-w-[720px] lg:max-w-none">{children}</div>
      </div>
    </>
  );
}
