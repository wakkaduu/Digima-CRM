import { useNavigate } from 'react-router';
import { SearchX, Users } from 'lucide-react';
import { useCustomers } from '../api/crm';
import type { CustomerRow } from '../api/types';
import { ListRow } from '../components/data/DataList';
import type { Column } from '../components/data/DataTable';
import { FilterBar } from '../components/data/FilterBar';
import { ServerResults, sortFromParam, sortToParam } from '../components/data/ServerResults';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { ResultsSkeleton } from '../components/ui/Skeletons';
import { RelativeTime } from '../components/ui/RelativeTime';
import { EmptyState, ErrorState } from '../components/ui/States';
import { ActiveBadge } from '../components/ui/StatusBadge';
import { peso } from '../lib/format';
import { useDebounced } from '../lib/useDebounced';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useUrlFilters } from '../lib/useUrlFilters';

const DEFAULTS = { tab: 'all', q: '', sort: 'name:asc', page: '1', size: '25' };
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
] as const;

const COLUMNS: Column<CustomerRow>[] = [
  {
    id: 'name',
    header: 'Customer',
    pin: true,
    sortable: true,
    cell: (c) => (
      <>
        <div className="font-semibold">{c.name}</div>
        {(c.email || c.phone) && <div className="text-small text-text-muted">{[c.email, c.phone].filter(Boolean).join(' · ')}</div>}
      </>
    ),
  },
  { id: 'status', header: 'Status', cell: (c) => <ActiveBadge active={c.active} /> },
  { id: 'openEstimates', header: 'Open estimates', align: 'right', sortable: true, cell: (c) => c.openEstimates },
  { id: 'balance', header: 'Balance', align: 'right', sortable: true, cell: (c) => peso(c.balance) },
  { id: 'lastPayment', header: 'Last payment', sortable: true, className: 'whitespace-nowrap', cell: (c) => (c.lastPaymentAt ? <RelativeTime value={c.lastPaymentAt} /> : <span className="text-text-muted">None yet</span>) },
];
const SORTABLE = COLUMNS.filter((c) => c.sortable).map((c) => c.id);

/** Customers: the QuickBooks customer list with open estimates, balance and last payment. */
export default function CustomersPage() {
  useDocumentTitle('Customers');
  const navigate = useNavigate();
  const { values: f, set, reset } = useUrlFilters(DEFAULTS);
  const search = useDebounced(f.q.trim());
  const page = Math.max(1, Number(f.page) || 1);
  const pageSize = Number(f.size) === 50 ? 50 : 25;
  const tab = TABS.some((t) => t.id === f.tab) ? f.tab : 'all';
  const sort = sortFromParam(f.sort, SORTABLE) ?? sortFromParam(DEFAULTS.sort, SORTABLE)!;

  const { data, error, refetch, isPending, isFetching } = useCustomers({
    q: search,
    status: tab === 'all' ? undefined : tab,
    sort: sortToParam(sort),
    page,
    pageSize,
  });
  const counts = data?.counts;
  const filtered = f.q.trim() !== '' || tab !== 'all';

  return (
    <div>
      <PageHeader title="Customers" description="Your QuickBooks customers, with what is open and what they owe." />

      <FilterBar
        tabs={{
          label: 'Filter by status',
          value: tab,
          onChange: (id) => set({ tab: id, page: '' }),
          items: TABS.map((t) => ({ ...t, count: counts?.[t.id] })),
        }}
        search={{ label: 'Search customers by name, email or phone', placeholder: 'Search customers', value: f.q, onChange: (v) => set({ q: v, page: '' }) }}
        onClearAll={() => reset(['q', 'page'])}
      />

      {isPending && !error && <ResultsSkeleton label="Loading customers" columns={5} />}
      {error && <ErrorState message={`Could not load customers: ${error.message}`} onRetry={() => refetch()} />}
      {data && data.total === 0 && (
        <Card>
          {filtered ? (
            <EmptyState icon={SearchX} title="No customers match">
              Try a different search, or clear the filters.
            </EmptyState>
          ) : (
            <EmptyState icon={Users} title="No customers yet">Customers appear here once they exist in QuickBooks.</EmptyState>
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
          getRowId={(c) => c.id}
          label="Customers"
          sort={sort}
          onSortChange={(s) => set({ sort: sortToParam(s), page: '' })}
          onRowClick={(c) => navigate(`/customers/${c.id}`)}
          busy={isFetching}
          renderCard={(c) => (
            <ListRow
              title={c.name}
              amount={c.balance > 0 ? peso(c.balance) : undefined}
              meta={`${c.openEstimates} open ${c.openEstimates === 1 ? 'estimate' : 'estimates'}${c.lastPaymentAt ? '' : ' · No payments yet'}`}
              badge={!c.active ? <ActiveBadge active={false} /> : undefined}
              note={c.lastPaymentAt ? <>Last payment <RelativeTime value={c.lastPaymentAt} /></> : undefined}
            />
          )}
        />
      )}
    </div>
  );
}
