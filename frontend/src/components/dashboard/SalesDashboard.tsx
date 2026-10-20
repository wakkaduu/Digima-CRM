import { Link } from 'react-router';
import { CheckCircle2, Clock, FileText, Search, Send, XCircle } from 'lucide-react';
import { useEstimates } from '../../api/crm';
import { useMyPayments, useRecentEstimates } from '../../api/payments';
import { buttonClass } from '../ui/Button';
import { Message } from '../Message';
import { RelativeTime } from '../ui/RelativeTime';
import { SkeletonRows } from '../ui/Skeletons';
import { StatTile } from '../ui/StatTile';
import { StatusBadge } from '../ui/StatusBadge';
import { bankLabel, dayLabel, peso } from '../../lib/format';
import { Row, Section, SectionEmpty } from './Section';

/** Sales home: where my payments stand, what to do next, and the estimates I worked on lately. */
export function SalesDashboard() {
  const mine = useMyPayments();
  const recents = useRecentEstimates();
  const open = useEstimates({ page: 1, pageSize: 1 }); // only the status counts are used

  const payments = mine.data?.payments ?? [];
  const pending = payments.filter((p) => p.status === 'pending');
  const approved = payments.filter((p) => p.status === 'approved');
  const rejected = payments.filter((p) => p.status === 'rejected');
  const approvedTotal = approved.reduce((sum, p) => sum + Number(p.finalAmount ?? p.amountSubmitted), 0);
  const unseen = mine.data?.unseenCount ?? 0;
  const openEstimates = open.data ? open.data.counts.Pending! + open.data.counts.Accepted! : undefined;

  return (
    <div className="space-y-4">
      {unseen > 0 && (
        <Message type="info">
          {unseen} of your submissions {unseen === 1 ? 'has' : 'have'} been reviewed since you last checked.{' '}
          <Link to="/payments" className="inline-flex min-h-6 items-center font-semibold underline pointer-coarse:min-h-11">
            See the results
          </Link>
        </Message>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Awaiting review" icon={Clock} to="/payments?tab=pending" loading={mine.isPending} value={pending.length} note="Of your last 30" />
        <StatTile label="Approved" icon={CheckCircle2} to="/payments?tab=approved" loading={mine.isPending} value={approved.length} note={mine.data ? `${peso(approvedTotal)} posted` : undefined} />
        <StatTile
          label="Rejected"
          icon={XCircle}
          tone={rejected.length > 0 ? 'danger' : 'default'}
          to="/payments?tab=rejected"
          loading={mine.isPending} value={rejected.length}
          note={rejected.length > 0 ? 'Check the reasons' : 'Nothing to fix'}
        />
        <StatTile label="Open estimates" icon={FileText} to="/estimates?tab=Accepted" loading={open.isPending} value={openEstimates ?? '—'} note={open.isError ? 'QuickBooks unavailable' : 'Pending or accepted'} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Section title="Recent payments" to="/payments">
            {mine.isPending && <SkeletonRows label="Loading recent payments" count={4} />}
            {mine.isError && <SectionEmpty>Could not load your payments.</SectionEmpty>}
            {mine.data && payments.length === 0 && <SectionEmpty>No payments yet. Submit your first one to see it here.</SectionEmpty>}
            {payments.slice(0, 5).map((p) => (
              <Row
                key={p.id}
                to="/payments"
                title={p.customerName}
                detail={
                  <>
                    Estimate #{p.qboEstimateNumber || p.qboEstimateId} · {bankLabel(p.bankDepositedTo)} · <RelativeTime value={p.createdAt} />
                  </>
                }
                amount={peso(p.amountSubmitted)}
                badge={<StatusBadge status={p.status} />}
              />
            ))}
          </Section>

          <Section title="Pick up where you left off" to="/estimates" linkLabel="All estimates">
            {recents.isPending && <SkeletonRows label="Loading estimates" count={2} />}
            {recents.data && recents.data.length === 0 && <SectionEmpty>Estimates you submit payments for will appear here.</SectionEmpty>}
            {(recents.data ?? []).map((e) => (
              <Row
                key={e.id}
                to={`/estimates/${e.id}`}
                title={`#${e.docNumber || e.id} · ${e.customerName}`}
                detail={`${dayLabel(e.txnDate)} · ${peso(e.approvedAmount)} paid of ${peso(e.totalAmount)}`}
                amount={peso(Math.max(0, e.totalAmount - e.approvedAmount - e.pendingAmount))}
                badge={<span className="text-small text-text-muted">left to collect</span>}
              />
            ))}
          </Section>
        </div>

        <aside aria-label="Quick actions" className="space-y-2 self-start rounded-card border border-border bg-surface p-4">
          <h2 className="mb-1 text-body font-semibold">Quick actions</h2>
          <Link to="/payments/new" className={buttonClass({ variant: 'primary', block: true })}>
            <Send aria-hidden className="size-4" /> Submit a payment
          </Link>
          <Link to="/customers" className={buttonClass({ block: true })}>
            <Search aria-hidden className="size-4" /> Find a customer
          </Link>
          <Link to="/estimates" className={buttonClass({ block: true })}>
            <FileText aria-hidden className="size-4" /> Browse estimates
          </Link>
          <p className="pt-1 text-small text-text-muted">
            Tip: press <kbd className="rounded-control border border-border px-1">Ctrl</kbd> <kbd className="rounded-control border border-border px-1">K</kbd> anywhere to search.
          </p>
        </aside>
      </div>
    </div>
  );
}
