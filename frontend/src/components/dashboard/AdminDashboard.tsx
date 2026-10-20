import { Link } from 'react-router';
import { ClipboardCheck, FileText, Hourglass, Plug, Users } from 'lucide-react';
import { useCustomers, useEstimates } from '../../api/crm';
import { usePaymentsList, usePendingPayments } from '../../api/payments';
import { useQboStatus } from '../../api/qbo';
import { buttonClass } from '../ui/Button';
import { RelativeTime } from '../ui/RelativeTime';
import { SkeletonRows } from '../ui/Skeletons';
import { Skeleton } from '../ui/States';
import { StatTile } from '../ui/StatTile';
import { StatusBadge } from '../ui/StatusBadge';
import { bankLabel, dateTime, peso } from '../../lib/format';
import { waiting } from '../../lib/review';
import { Row, Section, SectionEmpty } from './Section';

/** Admin home: what is waiting for a decision, how healthy the QuickBooks link is, and what was decided lately. */
export function AdminDashboard() {
  const queue = usePendingPayments(60_000);
  const reviewed = usePaymentsList({ status: 'approved,rejected', sort: 'createdAt:desc', page: 1, pageSize: 5 });
  const qbo = useQboStatus();
  const customers = useCustomers({ status: 'active', page: 1, pageSize: 1 }); // only the counts are used
  const estimates = useEstimates({ page: 1, pageSize: 1 });

  const pending = [...(queue.data?.payments ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)); // oldest first
  const attention = pending.filter((p) => p.qboPartiallyPosted).length;
  const oldest = pending[0] ? waiting(pending[0].createdAt) : null;
  const pendingTotal = pending.reduce((sum, p) => sum + Number(p.amountSubmitted), 0);
  const openEstimates = estimates.data ? estimates.data.counts.Pending! + estimates.data.counts.Accepted! : undefined;

  const q = qbo.data;
  const qboOk = q?.connected === true && !q.needsReauth;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Awaiting review"
          icon={ClipboardCheck}
          to="/payments/review"
          loading={queue.isPending} value={pending.length}
          note={pending.length > 0 ? `${peso(pendingTotal)} to post${attention ? ` · ${attention} need attention` : ''}` : 'All caught up'}
          tone={attention > 0 ? 'warning' : 'default'}
        />
        <StatTile
          label="Longest wait"
          icon={Hourglass}
          loading={queue.isPending}
          to="/payments/review"
          value={oldest ? oldest.text.replace('Waiting ', '') : '—'}
          note={oldest ? (oldest.stale ? 'Over 24 hours: review soon' : 'Within a day') : 'Nothing waiting'}
          tone={oldest?.stale ? 'warning' : 'default'}
        />
        <StatTile label="Open estimates" icon={FileText} to="/estimates?tab=Accepted" loading={estimates.isPending} value={openEstimates ?? '—'} note={estimates.isError ? 'QuickBooks unavailable' : 'Pending or accepted'} />
        <StatTile label="Active customers" icon={Users} to="/customers?tab=active" loading={customers.isPending} value={customers.data?.counts.active ?? '—'} note={customers.isError ? 'QuickBooks unavailable' : 'In QuickBooks'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Section title="Needs your review" to="/payments/review" linkLabel="Open the queue">
            {queue.isPending && <SkeletonRows label="Loading the review queue" count={4} />}
            {queue.isError && <SectionEmpty>Could not load the queue.</SectionEmpty>}
            {queue.data && pending.length === 0 && <SectionEmpty>Nothing is waiting. New submissions will appear here.</SectionEmpty>}
            {pending.slice(0, 5).map((p) => {
              const w = waiting(p.createdAt);
              return (
                <Row
                  key={p.id}
                  to={`/payments/review/${p.id}`}
                  title={p.customerName}
                  detail={`${p.submittedBy} · ${bankLabel(p.bankDepositedTo)} · ${w.text}${w.stale ? ' (over a day)' : ''}`}
                  amount={peso(p.amountSubmitted)}
                  badge={p.qboPartiallyPosted ? <StatusBadge status="partial" /> : <StatusBadge status="pending" />}
                />
              );
            })}
          </Section>

          <Section title="Recently reviewed" to="/payments/review?tab=history" linkLabel="Full history">
            {reviewed.isPending && <SkeletonRows label="Loading recent reviews" count={3} />}
            {reviewed.isError && <SectionEmpty>Could not load the history.</SectionEmpty>}
            {reviewed.data && reviewed.data.items.length === 0 && <SectionEmpty>No payments have been reviewed yet.</SectionEmpty>}
            {(reviewed.data?.items ?? []).map((p) => (
              <Row
                key={p.id}
                to={`/payments/review/${p.id}?tab=history`}
                title={p.customerName}
                detail={
                  <>
                    {p.reviewedBy ? `${p.reviewedBy} · ` : ''}
                    {p.reviewedAt ? <RelativeTime value={p.reviewedAt} /> : null}
                  </>
                }
                amount={peso(p.finalAmount ?? p.amountSubmitted)}
                badge={<StatusBadge status={p.status === 'rejected' ? 'rejected' : 'approved'} />}
              />
            ))}
          </Section>
        </div>

        <aside aria-label="QuickBooks connection" className="space-y-3 self-start rounded-card border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-body font-semibold">QuickBooks</h2>
            {q ? <StatusBadge status={qboOk ? 'connected' : 'disconnected'} label={qboOk ? 'Connected' : q.needsReauth ? 'Needs reconnecting' : 'Not connected'} /> : null}
          </div>
          {qbo.isPending && <Skeleton className="h-16" />}
          {qbo.isError && <p className="text-text-muted">Could not check the connection.</p>}
          {q && (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 [&_dt]:text-text-muted">
              {q.lastVerifiedAt && (
                <>
                  <dt>Last checked</dt>
                  <dd>{dateTime(q.lastVerifiedAt)}</dd>
                </>
              )}
              {q.expiresInDays !== undefined && qboOk && (
                <>
                  <dt>Renews in</dt>
                  <dd>{q.expiresInDays} {q.expiresInDays === 1 ? 'day' : 'days'}</dd>
                </>
              )}
            </dl>
          )}
          <Link to="/settings/integrations" className={buttonClass({ block: true })}>
            <Plug aria-hidden className="size-4" /> Manage connection
          </Link>
          <p className="text-small text-text-muted">
            Press <kbd className="rounded-control border border-border px-1">Ctrl</kbd> <kbd className="rounded-control border border-border px-1">K</kbd> to search customers, estimates and pages.
          </p>
        </aside>
      </div>
    </div>
  );
}
