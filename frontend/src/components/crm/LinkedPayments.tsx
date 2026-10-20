import { Link } from 'react-router';
import { useLinkedPayments } from '../../api/crm';
import type { LinkedPayment, Role } from '../../api/types';
import { bankLabel, peso } from '../../lib/format';
import { Card } from '../ui/Card';
import { SkeletonCardList } from '../ui/Skeletons';
import { RelativeTime } from '../ui/RelativeTime';
import { EmptyState, ErrorState } from '../ui/States';
import { StatusBadge } from '../ui/StatusBadge';

const estimateOf = (p: LinkedPayment) => p.qboEstimateNumber || p.qboEstimateId;

/** Payments submitted in the portal for one customer or estimate. Admins can open one in the review screen. */
export function LinkedPayments({ filter, role, showEstimate = true }: { filter: { customerId?: string; estimateId?: string }; role: Role; showEstimate?: boolean }) {
  const { data, error, refetch, isPending } = useLinkedPayments(filter);

  if (isPending && !error) return <SkeletonCardList label="Loading payments" count={3} />;
  if (error) return <ErrorState message={`Could not load payments: ${error.message}`} onRetry={() => refetch()} />;
  if (!data?.items.length) {
    return (
      <Card>
        <EmptyState title="No payments yet">Payments submitted for {filter.estimateId ? 'this estimate' : 'this customer'} will show up here.</EmptyState>
      </Card>
    );
  }

  return (
    <>
      <ul aria-label="Payments" className="space-y-2">
        {data.items.map((p) => {
          const body = (
            <>
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 font-semibold">{showEstimate ? `Estimate #${estimateOf(p)}` : bankLabel(p.bankDepositedTo)}</span>
                <span className="shrink-0 font-semibold tabular-nums">{peso(p.status === 'approved' ? (p.finalAmount ?? p.amountSubmitted) : p.amountSubmitted)}</span>
              </span>
              <span className="mt-0.5 block text-small text-text-muted">
                {showEstimate && `${bankLabel(p.bankDepositedTo)} · `}
                {p.submittedBy ? `${p.submittedBy} · ` : ''}
                <RelativeTime value={p.createdAt} />
              </span>
              <span className="mt-2 block">
                <StatusBadge status={p.status} />
              </span>
            </>
          );
          const cls = 'block min-h-16 rounded-card border border-border bg-surface p-3 text-text no-underline';
          return (
            <li key={p.id}>
              {role === 'admin' ? (
                <Link to={`/payments/review/${p.id}`} className={`${cls} hover:bg-surface-sunk`}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {data.total > data.items.length && (
        <p className="mt-2 text-small text-text-muted">
          Showing the latest {data.items.length} of {data.total} payments.
        </p>
      )}
    </>
  );
}
