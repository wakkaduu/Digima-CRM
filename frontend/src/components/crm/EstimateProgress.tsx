import { peso } from '../../lib/format';

/**
 * How much of an estimate has been paid: approved, waiting for review, and still to collect.
 * The bar is decoration; every segment is also written out, so colour is never the only carrier.
 */
export function EstimateProgress({ total, approved, pending, compact = false }: { total: number; approved: number; pending: number; compact?: boolean }) {
  const pct = (n: number) => (total > 0 ? Math.min(100, Math.max(0, (n / total) * 100)) : 0);
  const approvedPct = pct(approved);
  const pendingPct = Math.min(pct(pending), 100 - approvedPct);
  const remaining = Math.max(0, total - approved - pending);

  // Spans only: the compact form sits inside tappable list cards (buttons), which allow inline content only.
  const bar = (
    <span aria-hidden className="flex h-1.5 overflow-hidden rounded-badge bg-surface-sunk">
      <span className="bg-accent" style={{ width: `${approvedPct}%` }} />
      <span className="bg-border-strong" style={{ width: `${pendingPct}%` }} />
    </span>
  );

  if (compact) {
    return (
      <span className="block">
        {bar}
        <span className="mt-1 block text-small text-text-muted tabular-nums">
          <span className={approved > 0 ? 'text-text' : undefined}>{peso(approved)}</span> paid
          {pending > 0 && ` · ${peso(pending)} pending`}
        </span>
      </span>
    );
  }

  return (
    <div>
      {bar}
      <dl className="mt-2 grid grid-cols-3 gap-3 text-small">
        <Part label="Approved" value={approved} />
        <Part label="Awaiting review" value={pending} />
        <Part label="Still to collect" value={remaining} />
      </dl>
    </div>
  );
}

function Part({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{peso(value)}</dd>
    </div>
  );
}
