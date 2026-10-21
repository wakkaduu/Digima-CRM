import { Link, useNavigate, useParams } from 'react-router';
import { CheckCircle2, FileText, Mail, Phone, Wallet } from 'lucide-react';
import { useMe } from '../api/auth';
import { ApiError } from '../api/client';
import { useCustomer, useEstimates } from '../api/crm';
import { LinkedPayments } from '../components/crm/LinkedPayments';
import { ListRow } from '../components/data/DataList';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { DetailSkeleton, SkeletonCardList } from '../components/ui/Skeletons';
import { EmptyState, ErrorState } from '../components/ui/States';
import { ActiveBadge, EstimateStatusBadge } from '../components/ui/StatusBadge';
import { RelativeTime } from '../components/ui/RelativeTime';
import { StatTile } from '../components/ui/StatTile';
import { TabPanel, Tabs } from '../components/ui/Tabs';
import { EstimateProgress } from '../components/crm/EstimateProgress';
import { dayLabel, peso } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useUrlFilters } from '../lib/useUrlFilters';
import { estimateNo } from './EstimatesPage';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'estimates', label: 'Estimates' },
  { id: 'payments', label: 'Payments' },
];
const DEFAULTS = { tab: 'overview' };

function CustomerEstimates({ customerId }: { customerId: string }) {
  const navigate = useNavigate();
  const { data, error, refetch, isPending } = useEstimates({ page: 1, pageSize: 50, sort: 'date:desc', customerId });
  if (isPending && !error) return <SkeletonCardList label="Loading estimates" count={3} />;
  if (error) return <ErrorState message={`Could not load estimates: ${error.message}`} onRetry={() => refetch()} />;
  if (!data?.items.length) {
    return (
      <Card>
        <EmptyState title="No recent estimates">Nothing in the last {data?.lookbackDays} days.</EmptyState>
      </Card>
    );
  }
  return (
    <>
      <ul aria-label="Estimates" className="space-y-2">
        {data.items.map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => navigate(`/estimates/${e.id}`)} className="block min-h-16 w-full rounded-card border border-border bg-surface p-3 text-left hover:bg-surface-sunk">
              <ListRow
                title={`#${estimateNo(e)}`}
                amount={peso(e.totalAmount)}
                meta={<>{dayLabel(e.txnDate)} · <EstimateStatusBadge status={e.status} /></>}
                note={<EstimateProgress compact total={e.totalAmount} approved={e.approvedAmount} pending={e.pendingAmount} />}
              />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-small text-text-muted">
        {data.total > data.items.length ? `Showing the latest ${data.items.length} of ${data.total}. ` : ''}Estimates from the last {data.lookbackDays} days.
      </p>
    </>
  );
}

/** One customer: key facts and three summary figures, plus their estimates and payments. */
export default function CustomerDetailPage() {
  const { id } = useParams();
  const { data: me } = useMe();
  const { values: f, set } = useUrlFilters(DEFAULTS);
  const { data, error, refetch, isPending } = useCustomer(id);
  const c = data?.customer;
  useDocumentTitle(c?.name ?? 'Customer');
  const tab = TABS.some((t) => t.id === f.tab) ? f.tab : 'overview';

  if (isPending && !error) return <DetailSkeleton label="Loading customer" tabs tiles={3} cards={1} />;
  if (error || !c) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div>
        <PageHeader title="Customer" breadcrumb={[{ label: 'Customers', to: '/customers' }]} />
        <ErrorState message={notFound ? 'That customer was not found in QuickBooks.' : (error?.message ?? 'Unknown error')} onRetry={notFound ? undefined : () => refetch()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={c.name}
        breadcrumb={[{ label: 'Customers', to: '/customers' }]}
        description={<ActiveBadge active={c.active} />}
      />

      <Tabs label="Customer sections" tabs={TABS} value={tab} onChange={(t) => set({ tab: t })} />

      <TabPanel>
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile label="Open estimates" icon={FileText} value={c.openEstimates} />
              <StatTile label="Paid to date" icon={CheckCircle2} value={peso(c.paidToDate)} note={c.pendingPayments > 0 ? `${c.pendingPayments} more awaiting review` : undefined} />
              <StatTile label="Outstanding" icon={Wallet} value={peso(c.outstanding)} note="Open balance in QuickBooks" />
            </div>
            <Card>
              <h2 className="mb-3 text-body font-semibold">Details</h2>
              <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-1 [&_dt]:text-text-muted">
                {c.company && c.company !== c.name && (
                  <>
                    <dt>Company</dt>
                    <dd>{c.company}</dd>
                  </>
                )}
                <dt>Email</dt>
                <dd className="break-all">
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="inline-flex min-h-6 items-center gap-1 text-accent underline pointer-coarse:min-h-11">
                      <Mail aria-hidden className="size-4" /> {c.email}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt>Phone</dt>
                <dd>
                  {c.phone ? (
                    <a href={`tel:${c.phone}`} className="inline-flex min-h-6 items-center gap-1 text-accent underline pointer-coarse:min-h-11">
                      <Phone aria-hidden className="size-4" /> {c.phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt>Last payment</dt>
                <dd>{c.lastPaymentAt ? <RelativeTime value={c.lastPaymentAt} /> : 'None yet'}</dd>
              </dl>
            </Card>
            {me?.role === 'sales' && (
              <p className="text-text-muted">
                To record a payment, open one of this customer's <Link to="?tab=estimates" className="text-accent underline">estimates</Link>.
              </p>
            )}
          </div>
        )}
        {tab === 'estimates' && <CustomerEstimates customerId={c.id} />}
        {tab === 'payments' && me && <LinkedPayments filter={{ customerId: c.id }} role={me.role} />}
      </TabPanel>
    </div>
  );
}
