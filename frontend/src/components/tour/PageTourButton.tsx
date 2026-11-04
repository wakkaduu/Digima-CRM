import { useLocation } from 'react-router';
import { Lightbulb } from 'lucide-react';
import { cn } from '../../lib/cn';
import { startPageTour } from '../../lib/tour';
import { pageForPath } from './pageTours';

/**
 * "Tour this page": replays the current page's tips whenever someone wants them, even after they finished them or turned
 * page tours off. Only shown on pages that have a tour. `compact` is the icon-only version for the phone header.
 */
export function PageTourButton({ compact = false }: { compact?: boolean }) {
  const { pathname } = useLocation();
  const page = pageForPath(pathname);
  if (!page) return null;
  return (
    <button
      type="button"
      onClick={() => startPageTour(page)}
      aria-label={compact ? 'Tour this page' : undefined}
      className={cn(
        'inline-flex min-h-(--control-h) cursor-pointer items-center justify-center gap-1.5 rounded-control text-text hover:bg-surface-sunk',
        compact ? 'min-w-(--control-h)' : 'px-3 text-small text-text-muted hover:text-text',
      )}
    >
      <Lightbulb aria-hidden className={compact ? 'size-5' : 'size-4'} />
      {!compact && 'Tour this page'}
    </button>
  );
}
