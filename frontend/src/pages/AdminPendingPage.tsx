import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { CheckCheck, History, Keyboard, RefreshCw, SearchX } from 'lucide-react';
import { useReceivers, usePaymentsList, usePendingPayments } from '../api/payments';
import type { HistoryPayment, PendingPayment } from '../api/types';
import { FilterBar } from '../components/data/FilterBar';
import { Pagination } from '../components/data/Pagination';
import { HistoryList } from '../components/admin/HistoryList';
import { PaymentHistoryDetail } from '../components/admin/PaymentHistoryDetail';
import { PaymentReview, type ReviewActions } from '../components/admin/PaymentReview';
import { QueueList } from '../components/admin/QueueList';
import { QueueSkeleton } from '../components/admin/QueueSkeleton';
import { ShortcutSheet } from '../components/admin/ShortcutSheet';
import { useQueueShortcuts } from '../components/admin/useQueueShortcuts';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonCardList } from '../components/ui/Skeletons';
import { EmptyState, ErrorState } from '../components/ui/States';
import { cn } from '../lib/cn';
import { bankLabel } from '../lib/format';
import { useDebounced } from '../lib/useDebounced';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useUrlFilters } from '../lib/useUrlFilters';

type Tab = 'pending' | 'attention' | 'history';
const TABS: Tab[] = ['pending', 'attention', 'history'];
const DEFAULTS = { tab: 'pending', q: '', rep: '', bank: '', outcome: '', page: '' };
const OUTCOMES = [
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const estimateOf = (p: PendingPayment) => p.qboEstimateNumber || p.qboEstimateId;

/**
 * Admin review queue. Phone: the list, then a full-screen review with a sticky Approve / Reject bar.
 * From 1024px: list on the left, review on the right (the route keeps the selection: /payments/review/:id).
 * The History tab lists reviewed payments from the server, paged, and opens them read-only.
 */
export default function AdminPendingPage() {
  useDocumentTitle('Approvals');
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, error, refetch, isFetching, isPending } = usePendingPayments();

  // Filters live in the URL (?tab=history&rep=...), so a view can be linked and survives a refresh.
  const { values: f, set, reset } = useUrlFilters(DEFAULTS);
  const { search } = useLocation();
  const tab: Tab = TABS.includes(f.tab as Tab) ? (f.tab as Tab) : 'pending';
  const { q: query, rep, bank, outcome } = f;
  const page = Math.max(1, Number(f.page) || 1);
  const [pageSize, setPageSize] = useState(25);
  const [help, setHelp] = useState(false);
  const actions = useRef<ReviewActions | null>(null);

  // Any filter change goes back to the first page.
  const setFilter = (patch: Partial<typeof DEFAULTS>) => set({ ...patch, page: '' });

  // Oldest first: the one that has waited longest is reviewed first.
  const all = useMemo(
    () => [...(data?.payments ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [data],
  );
  const attention = all.filter((p) => p.qboPartiallyPosted);

  // Sales reps for the filter: everyone who can be a rep, plus anyone who has a payment waiting.
  const receivers = useReceivers().data ?? [];
  const reps = useMemo(() => {
    const byId = new Map(receivers.map((r) => [r.id, r.name]));
    for (const p of all) if (p.submittedById) byId.set(p.submittedById, p.submittedBy);
    return [...byId].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [receivers, all]);
  const banks = useMemo(() => [...new Set(all.map((p) => p.bankDepositedTo))].sort(), [all]);

  const q = query.trim().toLowerCase();
  const pendingRows = (tab === 'attention' ? attention : all).filter(
    (p) =>
      (!rep || p.submittedById === rep) &&
      (!bank || p.bankDepositedTo === bank) &&
      (!q || p.customerName.toLowerCase().includes(q) || estimateOf(p).toLowerCase().includes(q)),
  );

  // History: server-side search, filter and paging (the API never sends the whole archive).
  const historySearch = useDebounced(query.trim());
  const historyQuery = usePaymentsList(
    { status: outcome || 'approved,rejected', q: historySearch, rep, bank, sort: 'createdAt:desc', page, pageSize },
    tab === 'history',
  );
  const historyRows: HistoryPayment[] = historyQuery.data?.items ?? [];

  const rows: (PendingPayment | HistoryPayment)[] = tab === 'history' ? historyRows : pendingRows;
  const filtered = !!(q || rep || bank || outcome);

  const selectedPending = all.find((p) => p.id === id);
  const selectedIdx = rows.findIndex((p) => p.id === id);

  // The query string travels with the selection, so filters survive opening a payment.
  const go = (p?: { id: string }) => navigate({ pathname: p ? `/payments/review/${p.id}` : '/payments/review', search }, { replace: !!id });
  useQueueShortcuts({
    next: () => go(rows[selectedIdx + 1] ?? (selectedIdx < 0 ? rows[0] : undefined)),
    prev: () => selectedIdx > 0 && go(rows[selectedIdx - 1]),
    approve: () => actions.current?.approve(),
    reject: () => actions.current?.reject(),
    help: () => setHelp(true),
  });

  /** After a decision, move to the next payment in the current view (or back to the empty queue). */
  function onDecided(doneId: string) {
    const i = rows.findIndex((p) => p.id === doneId);
    go(rows[i + 1] ?? rows[i - 1]);
  }

  const description =
    all.length > 0 ? `${all.length} awaiting review${attention.length ? `, ${attention.length} ${attention.length === 1 ? 'needs' : 'need'} attention` : ''}.` : undefined;
  const nothingToReview = !!data && all.length === 0 && tab !== 'history';

  const filters = [
    { id: 'rep', label: 'Sales rep', allLabel: 'All reps', value: rep, options: reps },
    { id: 'bank', label: 'Bank', allLabel: 'All banks', value: bank, options: banks.map((b) => ({ value: b, label: bankLabel(b) })) },
    ...(tab === 'history' ? [{ id: 'outcome', label: 'Outcome', allLabel: 'Approved and rejected', value: outcome, options: OUTCOMES }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Approvals"
        description={description}
        actions={
          <>
            <Button size="sm" variant="ghost" onClick={() => setHelp(true)} className="max-lg:hidden" aria-label="Keyboard shortcuts">
              <Keyboard aria-hidden className="size-4" /> Shortcuts
            </Button>
            <Button size="sm" onClick={() => refetch()} loading={isFetching && !isPending}>
              <RefreshCw aria-hidden className="size-4" />
              Refresh
            </Button>
          </>
        }
      />

      {isPending && !error && <QueueSkeleton opened={!!id} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && (
        <div className="lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-6">
          {/* Queue: on phones it is hidden while a payment is open. */}
          <section aria-label="Review queue" className={cn(id && 'hidden lg:block', 'lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto')}>
            <FilterBar
              tabs={{
                label: 'Queue view',
                value: tab,
                onChange: (t) => set({ tab: t, page: '', outcome: '' }),
                items: [
                  { id: 'pending', label: 'Pending', count: all.length },
                  { id: 'attention', label: 'Needs attention', count: attention.length },
                  { id: 'history', label: 'History' },
                ],
              }}
              search={{ label: 'Search by customer or estimate number', placeholder: 'Search payments', value: query, onChange: (v) => setFilter({ q: v }) }}
              filters={filters}
              onFilterChange={(fid, v) => setFilter({ [fid]: v })}
              onClearAll={() => reset(['q', 'rep', 'bank', 'outcome', 'page'])}
            />

            {tab === 'history' ? (
              <>
                {historyQuery.isPending && !historyQuery.error && <SkeletonCardList label="Loading history" count={4} />}
                {historyQuery.error && <ErrorState message={historyQuery.error.message} onRetry={() => historyQuery.refetch()} />}
                {historyQuery.data && historyRows.length === 0 && (
                  <Card>
                    <EmptyState icon={History} title={filtered ? 'No matching payments' : 'Nothing reviewed yet'}>
                      {filtered ? 'Try a different search or filter.' : 'Approved and rejected payments appear here.'}
                    </EmptyState>
                    {filtered && (
                      <div className="flex justify-center pb-4">
                        <Button onClick={() => reset(['q', 'rep', 'bank', 'outcome', 'page'])}>Clear filters</Button>
                      </div>
                    )}
                  </Card>
                )}
                {historyRows.length > 0 && (
                  <>
                    <HistoryList payments={historyRows} selectedId={id} />
                    <Pagination
                      page={page}
                      size={pageSize}
                      total={historyQuery.data?.total ?? 0}
                      onPage={(p) => set({ page: String(p) })}
                      onSize={(s) => {
                        setPageSize(s);
                        set({ page: '' });
                      }}
                    />
                  </>
                )}
              </>
            ) : pendingRows.length > 0 ? (
              <QueueList payments={pendingRows} selectedId={id} />
            ) : (
              <Card>
                {nothingToReview ? (
                  <EmptyState icon={CheckCheck} title="All caught up">
                    Nothing is waiting for review. New submissions appear here.
                  </EmptyState>
                ) : (
                  <EmptyState icon={SearchX} title={tab === 'attention' && !filtered ? 'Nothing needs attention' : 'No matching payments'}>
                    {tab === 'attention' && !filtered
                      ? 'Payments that were only partly posted to QuickBooks appear here.'
                      : 'Try a different search or filter.'}
                  </EmptyState>
                )}
                {filtered && (
                  <div className="flex justify-center pb-4">
                    <Button onClick={() => reset(['q', 'rep', 'bank', 'outcome', 'page'])}>Clear filters</Button>
                  </div>
                )}
              </Card>
            )}
          </section>

          {/* Review: full screen on phones, the right-hand pane on desktop. */}
          <section aria-label="Payment review" className={cn(!id && (nothingToReview ? 'hidden' : 'hidden lg:block'), 'min-w-0')}>
            {selectedPending ? (
              <PaymentReview key={selectedPending.id} payment={selectedPending} onDecided={onDecided} actionsRef={actions} />
            ) : id ? (
              // Not in the pending queue: it was reviewed already (or by someone else a moment ago).
              <PaymentHistoryDetail key={id} id={id} />
            ) : (
              <Card className="hidden lg:block">
                <EmptyState title="Select a payment">
                  Choose one from the list to see its receipt and decide. Press J and K to move through the queue.
                </EmptyState>
              </Card>
            )}
          </section>
        </div>
      )}

      <ShortcutSheet open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
