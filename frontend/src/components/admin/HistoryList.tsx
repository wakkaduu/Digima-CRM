import { Link, useLocation } from 'react-router';
import type { HistoryPayment } from '../../api/types';
import { cn } from '../../lib/cn';
import { bankLabel, peso } from '../../lib/format';
import { RelativeTime } from '../ui/RelativeTime';
import { StatusBadge } from '../ui/StatusBadge';

const estimateOf = (p: HistoryPayment) => p.qboEstimateNumber || p.qboEstimateId;

/** Payments that were already approved or rejected: one card each, newest submission first. */
export function HistoryList({ payments, selectedId }: { payments: HistoryPayment[]; selectedId?: string }) {
  const { search } = useLocation(); // keep the active filters and page when a payment is opened
  return (
    <ul aria-label="Reviewed payments" className="space-y-2">
      {payments.map((p) => (
        <li key={p.id}>
          <Link
            to={{ pathname: `/payments/review/${p.id}`, search }}
            aria-current={p.id === selectedId ? 'true' : undefined}
            className={cn(
              'block min-h-16 rounded-card border p-3 text-text no-underline',
              p.id === selectedId ? 'border-accent bg-accent-subtle' : 'border-border bg-surface hover:bg-surface-sunk',
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 font-semibold">{p.customerName}</span>
              <span className="shrink-0 font-semibold tabular-nums">{peso(p.finalAmount ?? p.amountSubmitted)}</span>
            </span>
            <span className="mt-0.5 block text-small text-text-muted">
              Estimate #{estimateOf(p)} · {bankLabel(p.bankDepositedTo)} · {p.submittedBy}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-2 text-small text-text-muted">
              <StatusBadge status={p.status === 'rejected' ? 'rejected' : 'approved'} />
              {p.reviewedBy && p.reviewedAt && (
                <span>
                  by {p.reviewedBy} <RelativeTime value={p.reviewedAt} />
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
