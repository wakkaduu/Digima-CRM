import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ReceiptText, SearchX } from 'lucide-react';
import { api } from '../api/client';
import { MINE_KEY, useMyPayments } from '../api/payments';
import type { MyPayment, PaymentStatus } from '../api/types';
import { Message } from '../components/Message';
import { Button, buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Dialog } from '../components/ui/Dialog';
import { PageHeader } from '../components/ui/PageHeader';
import { ResultsSkeleton } from '../components/ui/Skeletons';
import { EmptyState, ErrorState } from '../components/ui/States';
import { NewDot, StatusBadge } from '../components/ui/StatusBadge';
import { RelativeTime } from '../components/ui/RelativeTime';
import type { Column } from '../components/data/DataTable';
import { ListRow } from '../components/data/DataList';
import { FilterBar } from '../components/data/FilterBar';
import { formatSort, parseSort, ResultsView } from '../components/data/ResultsView';
import { bankLabel, dayLabel, peso, when } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useUrlFilters } from '../lib/useUrlFilters';

const STATUS_TEXT: Record<PaymentStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  voided: 'Voided',
};
type Filter = 'all' | PaymentStatus;
const TABS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'voided', label: 'Voided' },
];

const estimateOf = (p: MyPayment) => p.qboEstimateNumber || p.qboEstimateId;

function Detail({ p }: { p: MyPayment }) {
  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <StatusBadge status={p.status} label={STATUS_TEXT[p.status]} />
        <span className="text-title font-semibold tabular-nums">{peso(p.amountSubmitted)}</span>
      </div>
      {p.status === 'rejected' && p.rejectionReason && (
        <Message>Reason: {p.rejectionReason}</Message>
      )}
      {p.status === 'voided' && (
        <Message type="warning">
          An admin reversed this payment in QuickBooks{p.voidReason ? `: ${p.voidReason}` : '.'} It no longer counts toward the estimate.
        </Message>
      )}
      <dl className="mb-3 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 [&_dt]:text-text-muted">
        <dt>Customer</dt>
        <dd>{p.customerName}</dd>
        <dt>Estimate</dt>
        <dd>#{estimateOf(p)}</dd>
        <dt>Paid via</dt>
        <dd>{bankLabel(p.bankDepositedTo)}</dd>
        <dt>Received</dt>
        <dd>
          {p.receivedOn ? dayLabel(p.receivedOn) : '—'}
          {p.receivedBy ? ` by ${p.receivedBy}` : ''}
        </dd>
        <dt>Submitted</dt>
        <dd>{when(p.createdAt)}</dd>
        {p.status === 'approved' && p.finalAmount && (
          <>
            <dt>Posted amount</dt>
            <dd className="tabular-nums">{peso(p.finalAmount)}</dd>
          </>
        )}
      </dl>
      <a
        href={`/api/payments/${p.id}/receipt`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass({ block: true })}
      >
        <ReceiptText aria-hidden className="size-4" /> View receipt
      </a>
    </>
  );
}

const DEFAULTS = { tab: 'all', q: '', bank: '', sort: 'submitted:desc' };

const COLUMNS: Column<MyPayment>[] = [
  { id: 'submitted', header: 'Submitted', sortValue: (p) => new Date(p.createdAt).getTime(), cell: (p) => <RelativeTime value={p.createdAt} />, className: 'whitespace-nowrap' },
  {
    id: 'customer',
    header: 'Customer',
    pin: true,
    sortValue: (p) => p.customerName.toLowerCase(),
    cell: (p) => (
      <>
        <div className="font-semibold">{p.customerName}</div>
        <div className="text-small text-text-muted">
          Estimate #{estimateOf(p)} · {bankLabel(p.bankDepositedTo)}
        </div>
      </>
    ),
  },
  { id: 'amount', header: 'Amount', align: 'right', sortValue: (p) => Number(p.amountSubmitted), cell: (p) => peso(p.amountSubmitted) },
  {
    id: 'status',
    header: 'Status',
    sortValue: (p) => p.status,
    cell: (p) => (
      <>
        <StatusBadge status={p.status} label={STATUS_TEXT[p.status]} />
        {p.unseen && (
          <span className="ml-2">
            <NewDot />
          </span>
        )}
        {p.status === 'rejected' && p.rejectionReason && (
          <div className="mt-1 text-small text-text-muted">Reason: {p.rejectionReason}</div>
        )}
      </>
    ),
  },
];

/** Sales: every payment the user submitted, with status tabs, search, filters, sorting and a detail sheet. */
export function MyPaymentsPage() {
  useDocumentTitle('My payments');
  const qc = useQueryClient();
  const { data, error, refetch, isPending } = useMyPayments();
  const { values: f, set, reset } = useUrlFilters(DEFAULTS);
  const [openId, setOpenId] = useState<string | null>(null);

  const dismiss = useMutation({
    mutationFn: () => api('/api/payments/mine/seen', { method: 'POST' }),
    onSettled: () => qc.invalidateQueries({ queryKey: MINE_KEY }),
  });

  const all = data?.payments ?? [];
  const unseen = data?.unseenCount ?? 0;
  const counts = useMemo(
    () => ({
      all: all.length,
      pending: all.filter((p) => p.status === 'pending').length,
      approved: all.filter((p) => p.status === 'approved').length,
      rejected: all.filter((p) => p.status === 'rejected').length,
      voided: all.filter((p) => p.status === 'voided').length,
    }),
    [all],
  );
  const banks = useMemo(() => [...new Set(all.map((p) => p.bankDepositedTo))].sort(), [all]);
  const tab = (TABS.some((t) => t.id === f.tab) ? f.tab : 'all') as Filter;
  const q = f.q.trim().toLowerCase();
  const rows = all.filter(
    (p) =>
      (tab === 'all' || p.status === tab) &&
      (!f.bank || p.bankDepositedTo === f.bank) &&
      (!q || p.customerName.toLowerCase().includes(q) || estimateOf(p).toLowerCase().includes(q)),
  );
  const open = all.find((p) => p.id === openId) ?? null;
  const sort = parseSort(f.sort, COLUMNS) ?? parseSort(DEFAULTS.sort, COLUMNS);

  return (
    <div>
      <PageHeader
        title="My payments"
        description="Payments you submitted and whether they were approved."
        actions={
          <Link to="/payments/new" className={buttonClass({ variant: 'primary' })}>
            Submit payment
          </Link>
        }
      />

      {unseen > 0 && (
        <Message type="info">
          {unseen} of your submissions {unseen === 1 ? 'has' : 'have'} been reviewed since you last checked (marked New).
          <div className="mt-2">
            <Button size="sm" onClick={() => dismiss.mutate()}>
              Dismiss
            </Button>
          </div>
        </Message>
      )}

      {all.length > 0 && (
        <FilterBar
          tabs={{ label: 'Filter by status', value: tab, onChange: (id) => set({ tab: id }), items: TABS.map((t) => ({ ...t, count: counts[t.id] })) }}
          search={{ label: 'Search by customer or estimate number', placeholder: 'Search payments', value: f.q, onChange: (v) => set({ q: v }) }}
          filters={[{ id: 'bank', label: 'Paid via', allLabel: 'All banks', value: f.bank, options: banks.map((b) => ({ value: b, label: bankLabel(b) })) }]}
          onFilterChange={(id, v) => set({ [id]: v })}
          onClearAll={() => reset(['q', 'bank'])}
        />
      )}

      {isPending && !error && <ResultsSkeleton label="Loading payments" columns={4} />}
      {error && <ErrorState message={`Could not load your submissions: ${error.message}`} onRetry={() => refetch()} />}
      {data && !all.length && (
        <Card>
          <EmptyState
            icon={ReceiptText}
            title="No payments yet"
            action={
              <Link to="/payments/new" className={buttonClass({ variant: 'primary' })}>
                Submit your first payment
              </Link>
            }
          >
            Payments you submit will show up here with their status.
          </EmptyState>
        </Card>
      )}
      {data && all.length > 0 && !rows.length && (
        <Card>
          <EmptyState
            icon={SearchX}
            title="No matching payments"
            action={<Button onClick={() => reset(['tab', 'q', 'bank'])}>Clear filters</Button>}
          >
            Try a different status or search.
          </EmptyState>
        </Card>
      )}

      {rows.length > 0 && (
        <ResultsView
          rows={rows}
          columns={COLUMNS}
          getRowId={(p) => p.id}
          label="My payments"
          resetKey={`${tab}|${f.q}|${f.bank}`}
          sort={sort}
          onSortChange={(s) => set({ sort: formatSort(s) })}
          onRowClick={(p) => setOpenId(p.id)}
          renderCard={(p) => (
            <ListRow
              title={
                <>
                  {p.customerName}
                  {p.unseen && (
                    <span className="ml-2">
                      <NewDot />
                    </span>
                  )}
                </>
              }
              amount={peso(p.amountSubmitted)}
              meta={
                <>
                  Estimate #{estimateOf(p)} · {bankLabel(p.bankDepositedTo)} · <RelativeTime value={p.createdAt} />
                </>
              }
              badge={<StatusBadge status={p.status} label={STATUS_TEXT[p.status]} />}
              note={p.status === 'rejected' && p.rejectionReason ? `Reason: ${p.rejectionReason}` : undefined}
            />
          )}
        />
      )}

      <Dialog open={!!open} onClose={() => setOpenId(null)} title={open ? `Estimate #${estimateOf(open)}` : 'Payment'}>
        {open && <Detail p={open} />}
      </Dialog>
    </div>
  );
}
