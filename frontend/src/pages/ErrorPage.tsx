import { RefreshCw, TriangleAlert } from 'lucide-react';
import { BrandLockup } from '../components/shell/BrandLockup';
import { Button, buttonClass } from '../components/ui/Button';
import { useDocumentTitle } from '../lib/useDocumentTitle';

/**
 * A page's code is fetched when it is first opened. After a deploy the old files are gone, so a tab left open from
 * before fails to load the next page: that is not a bug to report, it just needs a reload.
 */
export const isStaleBuild = (error: Error) =>
  /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|module script/i.test(`${error.name} ${error.message}`);

/**
 * What a crash looks like: what happened in plain words, the one thing to do (reload), a way out, and the technical
 * detail folded away for whoever is asked to look into it. `fullPage` when nothing of the app around it survived.
 */
export function ErrorPage({ error, onRetry, fullPage = false }: { error: Error; onRetry?: () => void; fullPage?: boolean }) {
  const stale = isStaleBuild(error);
  useDocumentTitle(stale ? 'Update available' : 'Something went wrong');
  const at = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

  const body = (
    <div role="alert" className="w-full max-w-140">
      {stale ? <RefreshCw aria-hidden className="size-8 text-accent" /> : <TriangleAlert aria-hidden className="size-8 text-warning" />}
      <h1 className="mt-4 text-display font-semibold">{stale ? 'A new version of the portal is ready' : 'This page ran into a problem'}</h1>
      <p className="mt-2 text-input text-text-muted">
        {stale
          ? 'The portal was updated while this tab was open. Reload to get the latest version; it takes a second.'
          : 'Something on this page failed, so it could not be shown. Reloading usually fixes it. Payments already submitted are not affected.'}
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" size="lg" onClick={() => window.location.reload()}>
          Reload page
        </Button>
        {!stale && onRetry && (
          <Button size="lg" onClick={onRetry}>
            Try again without reloading
          </Button>
        )}
        <a href="/dashboard" className={buttonClass({ size: 'lg', variant: 'ghost' })}>
          Go to the dashboard
        </a>
      </div>

      {!stale && (
        <details className="mt-8 rounded-card bg-surface-sunk px-4 py-3 text-small">
          <summary className="min-h-6 cursor-pointer text-text-muted">If it keeps happening</summary>
          <p className="mt-2 text-text-muted">
            This error was reported to the team automatically. If it keeps happening, tell your admin what you were doing and send
            them these details:
          </p>
          <p className="mt-2 wrap-break-word text-text">
            {at} · {window.location.pathname}
            {'requestId' in error && typeof error.requestId === 'string' && <> · ref {error.requestId}</>}
            <br />
            {error.name}: {error.message}
          </p>
        </details>
      )}
    </div>
  );

  if (!fullPage) return <div className="flex justify-center px-4 py-12 sm:py-16">{body}</div>;
  return (
    <div className="flex min-h-dvh flex-col bg-bg px-4 py-6 sm:px-8">
      <BrandLockup />
      <main className="flex flex-1 items-center justify-center py-12">{body}</main>
    </div>
  );
}
