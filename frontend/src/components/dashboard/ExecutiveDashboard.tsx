import { Link } from 'react-router';
import { ClipboardCheck, FileText, UserCog, Users } from 'lucide-react';
import { useCustomers, useEstimates } from '../../api/crm';
import { useCounts, usePaymentsList } from '../../api/payments';
import { buttonClass } from '../ui/Button';
import { RelativeTime } from '../ui/RelativeTime';
import { SkeletonRows } from '../ui/Skeletons';
import { StatTile } from '../ui/StatTile';
import { StatusBadge } from '../ui/StatusBadge';
import { bankLabel, peso } from '../../lib/format';
import { Row, Section, SectionEmpty } from './Section';

/**
 * SuperAdmin home: the state of the business at a glance, read-only. Approving payments stays with admins, so nothing
 * here links into the review queue. Reports and deeper analytics are not built yet.
 */
export function ExecutiveDashboard() {
  const counts = useCounts();
  const decided = usePaymentsList({ status: 'approved,rejected,voided', sort: 'createdAt:desc', page: 1, pageSize: 8 });
  const customers = useCustomers({ status: 'active', page: 1, pageSize: 1 }); // only the counts are used
  const estimates = useEstimates({ page: 1, pageSize: 1 });

  const openEstimates = estimates.data ? estimates.data.counts.Pending! + estimates.data.counts.Accepted! : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Awaiting review"
          icon={ClipboardCheck}
          loading={counts.isPending}
          value={counts.data?.pending ?? '—'}
          note={counts.data?.pending === 0 ? 'All caught up' : 'With the admins'}
        />
        <StatTile label="Open estimates" icon={FileText} to="/estimates?tab=Accepted" loading={estimates.isPending} value={openEstimates ?? '—'} note={estimates.isError ? 'QuickBooks unavailable' : 'Pending or accepted'} />
        <StatTile label="Active customers" icon={Users} to="/customers?tab=active" loading={customers.isPending} value={customers.data?.counts.active ?? '—'} note={customers.isError ? 'QuickBooks unavailable' : 'In QuickBooks'} />
        <StatTile label="Team" icon={UserCog} to="/settings/team" value="Manage" note="Accounts and roles" />
      </div>

      <Section title="Recent payment decisions">
        {decided.isPending && <SkeletonRows label="Loading recent decisions" count={4} />}
        {decided.isError && <SectionEmpty>Could not load the payments.</SectionEmpty>}
        {decided.data && decided.data.items.length === 0 && <SectionEmpty>No payments have been reviewed yet.</SectionEmpty>}
        {(decided.data?.items ?? []).map((p) => (
          <Row
            key={p.id}
            title={p.customerName}
            detail={
              <>
                {p.submittedBy ? `${p.submittedBy} · ` : ''}
                {bankLabel(p.bankDepositedTo)} · {p.reviewedAt ? <RelativeTime value={p.reviewedAt} /> : null}
              </>
            }
            amount={peso(p.finalAmount ?? p.amountSubmitted)}
            badge={<StatusBadge status={p.status} />}
          />
        ))}
      </Section>

      <p className="text-small text-text-muted">
        Customers and estimates open in read-only view.{' '}
        <Link to="/settings/team" className={buttonClass({ variant: 'link' })}>
          Manage the team
        </Link>
      </p>
    </div>
  );
}
