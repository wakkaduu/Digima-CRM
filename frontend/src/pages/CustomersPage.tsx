import { useMemo } from 'react';
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
import { Avatar } from '../components/ui/Avatar';
import { NeutralBadge } from '../components/ui/StatusBadge';
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

/** A stable number from the QuickBooks id, so a customer keeps the same tint. */
const hashIndex = (id: string) => [...id].reduce((n, ch) => n + ch.charCodeAt(0), 0);

const columnsFor = (maxBalance: number): Column<CustomerRow>[] => [
  {
    id: 'name',
    header: 'Customer',
    pin: true,
    sortable: true,
    cell: (c) => (
      <div className="flex items-center gap-3">
        <Avatar name={c.name} index={hashIndex(c.id)} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{c.name}</span>
            {!c.active && <NeutralBadge>Inactive</NeutralBadge>}
          </div>
          {(c.email || c.phone) && <div className="text-small text-text-muted">{[c.email, c.phone].filter(Boolean).join(' · ')}</div>}
        </div>
      </div>
    ),
  },
  // A zero is printed, in grey: nothing open, nothing owed.
  { id: 'openEstimates', header: 'Open estimates', align: 'right', sortable: true, cell: (c) => <span className={c.openEstimates === 0 ? 'text-text-muted' : undefined}>{c.openEstimates}</span> },
  {
    id: 'balance',
    header: 'Balance',
    align: 'right',
    sortable: true,
    className: 'w-44',
    // The thin bar is the balance against the largest on this page; zero prints in grey with no bar.
    cell: (c) => (
      <div className="ml-auto w-32">
        <div className={c.balance === 0 ? 'text-text-muted' : 'font-semibold'}>{peso(c.balance)}</div>
        <div aria-hidden className="mt-1 flex h-0.5 justify-end bg-surface-sunk">
          <div className="h-full bg-accent" style={{ width: `${maxBalance > 0 ? (c.balance / maxBalance) * 100 : 0}%` }} />
        </div>
      </div>
    ),
  },
  { id: 'lastPayment', header: 'Last payment', sortable: true, className: 'whitespace-nowrap', cell: (c) => (c.lastPaymentAt ? <RelativeTime value={c.lastPaymentAt} /> : <span className="text-text-muted">None yet</span>) },
];
const SORTABLE = columnsFor(0).filter((c) => c.sortable).map((c) => c.id);

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
  const columns = useMemo(() => columnsFor(Math.max(0, ...(data?.items ?? []).map((c) => c.balance))), [data]);
  const filtered = f.q.trim() !== '' || tab !== 'all';

  return (
    <div>
      <PageHeader
        title="Customers"
        description={
          counts
            ? `${counts.all} ${counts.all === 1 ? 'customer' : 'customers'} in QuickBooks, ${counts.active} active. Open one to see its estimates and payments.`
            : 'Your QuickBooks customers, with what is open and what they owe.'
        }
      />

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
          columns={columns}
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
              badge={!c.active ? <NeutralBadge>Inactive</NeutralBadge> : undefined}
              note={c.lastPaymentAt ? <>Last payment <RelativeTime value={c.lastPaymentAt} /></> : undefined}
            />
          )}
        />
      )}
    </div>
  );
}
