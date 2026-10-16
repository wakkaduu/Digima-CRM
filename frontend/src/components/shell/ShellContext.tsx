import { createContext, useContext, useEffect } from 'react';

/** Lets a page ask the shell to hide the bottom tab bar (pages with their own sticky action bar). */
export const ShellContext = createContext<{ setHideTabs: (hide: boolean) => void }>({ setHideTabs: () => undefined });

export function useHideTabs(hide = true) {
  const { setHideTabs } = useContext(ShellContext);
  useEffect(() => {
    setHideTabs(hide);
    return () => setHideTabs(false);
  }, [hide, setHideTabs]);
}
