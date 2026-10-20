import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';

/** A titled dashboard block with an optional "view all" link. Rows inside it are separated by hairlines. */
export function Section({ title, to, linkLabel = 'View all', children }: { title: string; to?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface" aria-label={title}>
      <header className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4">
        <h2 className="text-body font-semibold">{title}</h2>
        {to && (
          <Link to={to} className="inline-flex min-h-6 items-center gap-1 text-accent underline pointer-coarse:min-h-11">
            {linkLabel} <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        )}
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

/** One row: tappable when `to` is given. Title and amount on the first line, muted detail below, an optional badge. */
export function Row({ to, title, amount, detail, badge }: { to?: string; title: ReactNode; amount?: ReactNode; detail?: ReactNode; badge?: ReactNode }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        {detail && <span className="block truncate text-small text-text-muted">{detail}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {amount && <span className="font-semibold tabular-nums">{amount}</span>}
        {badge}
      </span>
    </>
  );
  const cls = 'flex min-h-16 items-center gap-3 px-4 py-2 text-text no-underline';
  return to ? (
    <Link to={to} className={`${cls} hover:bg-surface-sunk`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function SectionEmpty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-text-muted">{children}</p>;
}
