import { useCallback, useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { BrandLockup } from '../components/shell/BrandLockup';
import { Button } from '../components/ui/Button';
import type { MaintenanceInfo } from '../lib/maintenance';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const CHECK_EVERY_MS = 30_000;

/** "4:30 PM today" or "Nov 5, 4:30 PM", in Manila time, for when it is expected back. */
function backBy(iso: string, now = Date.now()) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime()) || at.getTime() <= now) return null;
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const time = at.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });
  return day(at) === day(new Date(now)) ? `${time} today` : `${at.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}, ${time}`;
}

/**
 * Shown in place of the whole app while the server is in maintenance (MAINTENANCE_MODE). It asks the server again every
 * 30 seconds and reloads by itself once the portal answers normally, so nobody has to keep refreshing.
 */
export function MaintenancePage({ info }: { info: MaintenanceInfo }) {
  useDocumentTitle('Down for maintenance');
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      // Any normal answer (signed in or not) means the gate is open again; health is exempt, so it cannot tell.
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (res.status !== 503) return window.location.reload();
    } catch {
      /* the server itself may be restarting: keep waiting */
    }
    setLastChecked(new Date());
    setChecking(false);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => void check(), CHECK_EVERY_MS);
    return () => window.clearInterval(id);
  }, [check]);

  const until = info.until ? backBy(info.until) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-bg px-4 py-6 sm:px-8">
      <BrandLockup />
      <main className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-140">
          <Wrench aria-hidden className="size-8 text-accent" />
          <h1 className="mt-4 text-display font-semibold">Down for maintenance</h1>
          <p className="mt-2 text-input text-text-muted">
            The portal is being updated and will be back {until ? <>by <strong className="font-semibold text-text">{until}</strong></> : 'shortly'}. Payments already
            submitted are safe.
          </p>
          {info.message && <p className="mt-4 rounded-card bg-surface px-4 py-3 text-input">{info.message}</p>}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="primary" size="lg" loading={checking} onClick={() => void check()}>
              Check again
            </Button>
            <p role="status" className="text-small text-text-muted">
              {checking ? 'Checking…' : lastChecked ? `Still down at ${lastChecked.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}. ` : ''}
              {!checking && 'This page reloads by itself when the portal is back.'}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
