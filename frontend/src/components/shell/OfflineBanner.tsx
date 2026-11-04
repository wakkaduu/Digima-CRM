import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useOnline } from '../../lib/useOnline';

const BACK_ONLINE_MS = 4000;

/**
 * Says so when the connection drops, on every page: what still works (reading what is on screen) and what does not
 * (saving, loading). When it comes back it says that too, briefly; the data refreshes by itself on reconnect.
 */
export function OfflineBanner() {
  const online = useOnline();
  const [backOnline, setBackOnline] = useState(false);
  const wasOffline = useRef(!online);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setBackOnline(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setBackOnline(true);
    const t = window.setTimeout(() => setBackOnline(false), BACK_ONLINE_MS);
    return () => window.clearTimeout(t);
  }, [online]);

  return (
    <div role="status" aria-live="polite">
      {!online && (
        <div className="border-b border-border bg-text px-4 py-2 text-white">
          <p className="mx-auto flex max-w-300 items-start gap-2 lg:px-2">
            <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong className="font-semibold">You are offline.</strong> Loading and saving wait until the connection is back; what you have
              typed stays on this page.
            </span>
          </p>
        </div>
      )}
      {online && backOnline && (
        <div className="border-b border-success bg-success-bg px-4 py-2 text-success">
          <p className="mx-auto flex max-w-300 items-center gap-2 lg:px-2">
            <Wifi aria-hidden className="size-4 shrink-0" />
            Back online. The page is up to date again.
          </p>
        </div>
      )}
    </div>
  );
}
