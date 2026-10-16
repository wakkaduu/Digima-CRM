import { Link, useLocation } from 'react-router';
import { Clock } from 'lucide-react';
import type { PendingPayment } from '../../api/types';
import { cn } from '../../lib/cn';
import { bankLabel, peso } from '../../lib/format';
import { waiting } from '../../lib/review';
import { StatusBadge } from '../ui/StatusBadge';

const estimateOf = (p: PendingPayment) => p.qboEstimateNumber || p.qboEstimateId;

/** The review queue: one tappable card per payment, oldest first. The selected one is marked for the detail pane. */
export function QueueList({ payments, selectedId }: { payments: PendingPayment[]; selectedId?: string }) {
  const { search } = useLocation(); // keep the active filters when a payment is opened
  return (
    <ul aria-label="Payments awaiting review" className="space-y-2">
      {payments.map((p) => {
        const wait = waiting(p.createdAt);
        const selected = p.id === selectedId;
        return (
          <li key={p.id}>
            <Link
              to={{ pathname: `/admin/${p.id}`, search }}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'block min-h-16 rounded-card border p-3 text-text no-underline',
                selected ? 'border-accent bg-accent-subtle' : 'border-border bg-surface hover:bg-surface-sunk',
              )}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-semibold">{p.customerName}</span>
                <span className="shrink-0 font-semibold tabular-nums">{peso(p.amountSubmitted)}</span>
              </span>
              <span className="mt-0.5 block text-small text-text-muted">
                Estimate #{estimateOf(p)} · {bankLabel(p.bankDepositedTo)} · {p.submittedBy}
              </span>
              <span className="mt-1.5 flex flex-wrap items-center gap-2 text-small">
                <span className={cn('inline-flex items-center gap-1', wait.stale ? 'font-semibold text-warning' : 'text-text-muted')}>
                  <Clock aria-hidden className="size-3.5" />
                  {wait.text}
                </span>
                {p.qboPartiallyPosted && <StatusBadge status="partial" />}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
