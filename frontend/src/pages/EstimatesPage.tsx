import { useNavigate } from 'react-router';
import { FileText, SearchX } from 'lucide-react';
import { useEstimates } from '../api/crm';
import type { EstimateRow } from '../api/types';
import { EstimateProgress } from '../components/crm/EstimateProgress';
import { ListRow } from '../components/data/DataList';
import type { Column } from '../components/data/DataTable';
import { FilterBar } from '../components/data/FilterBar';
import { ServerResults, sortFromParam, sortToParam } from '../components/data/ServerResults';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { ResultsSkeleton } from '../components/ui/Skeletons';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState, ErrorState } from '../components/ui/States';
import { EstimateStatusBadge } from '../components/ui/StatusBadge';
import { dayLabel, peso } from '../lib/format';
import { useDebounced } from '../lib/useDebounced';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useUrlFilters } from '../lib/useUrlFilters';

const DEFAULTS = { tab: 'all', q: '', sort: 'date:desc', page: '1', size: '25' };
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'Pending', label: 'Pending' },
  { id: 'Accepted', label: 'Accepted' },
  { id: 'Closed', label: 'Closed' },
  { id: 'Rejected', label: 'Rejected' },
];

export const estimateNo = (e: Pick<EstimateRow, 'docNumber' | 'id'>) => e.docNumber || e.id;

/** A stable number from the customer, so a customer keeps the same tint across pages. */
const hashIndex = (id: string) => [...id].reduce((n, ch) => n + ch.charCodeAt(0), 0);

const COLUMNS: Column<EstimateRow>[] = [
  { id: 'number', header: 'Estimate', sortable: true, pin: true, className: 'whitespace-nowrap font-semibold', cell: (e) => `#${estimateNo(e)}` },
  {
    id: 'customer',
    header: 'Customer',
    sortable: true,
    cell: (e) =>
      e.customerName ? (
        <div className="flex items-center gap-3">
          <Avatar name={e.customerName} index={hashIndex(e.customerId ?? e.customerName)} />
          <span>{e.customerName}</span>
        </div>
      ) : (
        <span className="text-text-muted">—</span>
      ),
  },
  { id: 'date', header: 'Date', sortable: true, className: 'whitespace-nowrap text-text-muted', cell: (e) => dayLabel(e.txnDate) },
  { id: 'status', header: 'Status', cell: (e) => <EstimateStatusBadge status={e.status} /> },
  { id: 'total', header: 'Total', align: 'right', sortable: true, cell: (e) => <span className="font-semibold">{peso(e.totalAmount)}</span> },
  {
    id: 'progress',
    header: 'Left to collect',
    className: 'w-[26rem]',
    cell: (e) => {
      const left = Math.max(0, e.totalAmount - e.approvedAmount - e.pendingAmount);
      return (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <span className={left === 0 ? 'text-text-muted' : 'font-semibold'}>{peso(left)}</span>
            <span className="text-small whitespace-nowrap text-text-muted">
              {peso(e.approvedAmount)} paid{e.pendingAmount > 0 ? ` · ${peso(e.pendingAmount)} pending` : ''}
            </span>
          </div>
          <EstimateProgress.Bar total={e.totalAmount} approved={e.approvedAmount} pending={e.pendingAmount} />
        </div>
      );
    },
  },
];
const SORTABLE = COLUMNS.filter((c) => c.sortable).map((c) => c.id);

/** Estimates from QuickBooks (recent ones, any status) with how much of each has been paid. */
export default function EstimatesPage() {
  useDocumentTitle('Estimates');
  const navigate = useNavigate();
  const { values: f, set, reset } = useUrlFilters(DEFAULTS);
  const search = useDebounced(f.q.trim());
  const page = Math.max(1, Number(f.page) || 1);
  const pageSize = Number(f.size) === 50 ? 50 : 25;
  const tab = TABS.some((t) => t.id === f.tab) ? f.tab : 'all';
  const sort = sortFromParam(f.sort, SORTABLE) ?? sortFromParam(DEFAULTS.sort, SORTABLE)!;

  const { data, error, refetch, isPending, isFetching } = useEstimates({
    q: search,
    status: tab === 'all' ? undefined : tab,
    sort: sortToParam(sort),
    page,
    pageSize,
  });
  const filtered = f.q.trim() !== '' || tab !== 'all';

  return (
    <div>
      <PageHeader
        title="Estimates"
        description={
          data
            ? `${data.counts.Accepted ?? 0} accepted and ${data.counts.Pending ?? 0} pending of ${data.counts.all ?? data.total} estimates from the last ${data.lookbackDays} days. The bar shows how much of each has been paid.`
            : undefined
        }
      />

      <FilterBar
        tabs={{
          label: 'Filter by status',
          value: tab,
          onChange: (id) => set({ tab: id, page: '' }),
          items: TABS.map((t) => ({ ...t, count: data?.counts[t.id] })),
        }}
        search={{ label: 'Search by customer or estimate number', placeholder: 'Search estimates', value: f.q, onChange: (v) => set({ q: v, page: '' }) }}
        onClearAll={() => reset(['q', 'page'])}
      />

      {isPending && !error && <ResultsSkeleton label="Loading estimates" columns={6} />}
      {error && <ErrorState message={`Could not load estimates: ${error.message}`} onRetry={() => refetch()} />}
      {data && data.total === 0 && (
        <Card>
          {filtered ? (
            <EmptyState icon={SearchX} title="No estimates match">
              Try a different search, or clear the filters.
            </EmptyState>
          ) : (
            <EmptyState icon={FileText} title="No recent estimates">Estimates created in QuickBooks appear here.</EmptyState>
          )}
        </Card>
      )}
      {data && data.total > 0 && (
        <ServerResults
          rows={data.items}
          total={data.total}
          page={page}
          pageSize={pageSize}
          onPage={(p) => set({ page: String(p) })}
          onPageSize={(s) => set({ size: String(s), page: '' })}
          columns={COLUMNS}
          getRowId={(e) => e.id}
          label="Estimates"
          sort={sort}
          onSortChange={(s) => set({ sort: sortToParam(s), page: '' })}
          onRowClick={(e) => navigate(`/estimates/${e.id}`)}
          busy={isFetching}
          renderCard={(e) => (
            <ListRow
              title={`#${estimateNo(e)} · ${e.customerName ?? 'Unknown customer'}`}
              amount={peso(e.totalAmount)}
              meta={`${dayLabel(e.txnDate)} · ${e.status ?? 'Unknown'}`}
              note={<EstimateProgress compact total={e.totalAmount} approved={e.approvedAmount} pending={e.pendingAmount} />}
            />
          )}
        />
      )}
    </div>
  );
}
