import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { UserCog } from 'lucide-react';
import { useCustomers, useEstimates } from '../../api/crm';
import { useBankConfig, usePaymentsList } from '../../api/payments';
import { useTeam } from '../../api/users';
import { buttonClass } from '../ui/Button';
import { PageHeader } from '../ui/PageHeader';
import { RelativeTime } from '../ui/RelativeTime';
import { SkeletonRows } from '../ui/Skeletons';
import { Skeleton } from '../ui/States';
import { StatusBadge } from '../ui/StatusBadge';
import { bankLabel, peso } from '../../lib/format';
import { cn } from '../../lib/cn';
import { waiting } from '../../lib/review';
import { DailyBars } from './DailyBars';
import { Row, Section, SectionEmpty } from './Section';
import { FETCH_DAYS, WINDOW_DAYS, dayShort, elapsed, fetchFrom, summarise } from './overview';

const QUEUE_ROWS = 4;
const DECISION_ROWS = 5;

/**
 * SuperAdmin home. The question it answers: is the money getting through approval, and is anything stuck?
 * Read-only (approving stays with the admins, so nothing here links into the review queue).
 *
 * Grid: 3 columns with a 16px gap. The chart and the decisions list take 2 columns, the queue and the accounts list 1,
 * so every row ends on the canvas edges. The strip below the chart is 4 equal cells (2 x 2 on a phone).
 */
export function ExecutiveDashboard() {
  const [from] = useState(() => fetchFrom());
  const recent = usePaymentsList({ sort: 'createdAt:desc', page: 1, pageSize: 100, from });
  const queue = usePaymentsList({ status: 'pending', sort: 'createdAt:asc', page: 1, pageSize: 100 });
  const customers = useCustomers({ status: 'active', page: 1, pageSize: 1 }); // only the counts are used
  const estimates = useEstimates({ page: 1, pageSize: 1 });
  const team = useTeam();
  const banks = useBankConfig();

  const stats = useMemo(() => (recent.data ? summarise(recent.data.items) : undefined), [recent.data]);
  const waitingRows = queue.data?.items ?? [];
  const waitingTotal = queue.data?.total ?? 0;
  const waitingSum = queue.data && queue.data.items.length === queue.data.total ? queue.data.items.reduce((s, p) => s + Math.round(Number(p.amountSubmitted) * 100), 0) : undefined;
  const truncated = recent.data !== undefined && recent.data.total > recent.data.items.length;

  const openEstimates = estimates.data ? estimates.data.counts.Pending! + estimates.data.counts.Accepted! : undefined;
  const activeMembers = team.data?.filter((m) => m.active).length;
  const invites = team.data?.filter((m) => m.invitePending).length;

  const finding = queue.isPending ? (
    <Skeleton className="mt-1 h-4 w-72 max-w-full" />
  ) : queue.isError ? (
    'The review queue could not be loaded.'
  ) : waitingTotal === 0 ? (
    'Nothing is waiting for review.'
  ) : (
    `${waitingTotal} ${waitingTotal === 1 ? 'payment' : 'payments'}${waitingSum !== undefined ? ` (${peso(waitingSum / 100)})` : ''} ${waitingTotal === 1 ? 'is' : 'are'} waiting for review. The oldest has waited ${elapsed(waitingRows[0]!.createdAt)}.`
  );

  return (
    <div>
      <PageHeader
        title="Overview"
        description={finding}
        actions={
          <Link to="/settings/team" className={buttonClass({ variant: 'secondary' })}>
            <UserCog aria-hidden className="size-4" /> Manage team
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section aria-label="Approved payments" className="min-w-0 rounded-card border border-border bg-surface p-5 lg:col-span-2">
          <header className="flex flex-wrap items-baseline justify-between gap-x-3">
            <h2 className="text-body font-semibold">Approved, last {WINDOW_DAYS} days</h2>
            {stats && <span className="text-small text-text-muted">{dayShort(stats.days[0]!.day)} – {dayShort(stats.days.at(-1)!.day)}</span>}
          </header>
          {recent.isPending && (
            <div role="status" aria-label="Loading approved payments">
              <Skeleton className="mt-3 h-[30px] w-44" />
              <Skeleton className="mt-2 h-4 w-32" />
              <Skeleton className="mt-4 h-[208px]" />
            </div>
          )}
          {recent.isError && <BlockError what="the payments" onRetry={() => void recent.refetch()} />}
          {stats && (
            <>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[30px] leading-9 font-semibold tabular-nums">{peso(stats.approvedC / 100)}</span>
                <span className="text-text-muted">
                  from {stats.approvedCount} approved {stats.approvedCount === 1 ? 'payment' : 'payments'}
                </span>
              </p>
              <div className="mt-4">
                <DailyBars days={stats.days} label="Approved per day" />
              </div>
              {truncated && (
                <p className="mt-2 text-small text-text-muted">
                  Based on the latest {recent.data!.items.length} of {recent.data!.total} submissions from the last {FETCH_DAYS} days.
                </p>
              )}
            </>
          )}
        </section>

        <Section title="Waiting for review">
          {queue.isPending && <SkeletonRows label="Loading the review queue" count={QUEUE_ROWS} />}
          {queue.isError && <BlockError what="the queue" onRetry={() => void queue.refetch()} />}
          {queue.data && waitingTotal === 0 && <SectionEmpty>Nothing is waiting. New submissions will appear here.</SectionEmpty>}
          {waitingRows.slice(0, QUEUE_ROWS).map((p) => {
            const w = waiting(p.createdAt);
            return (
              <Row
                key={p.id}
                title={p.customerName}
                detail={`${p.submittedBy} · ${bankLabel(p.bankDepositedTo)}`}
                amount={peso(p.amountSubmitted)}
                badge={<span className={cn('text-small', w.stale ? 'font-semibold text-warning' : 'text-text-muted')}>{w.text}</span>}
              />
            );
          })}
          {waitingTotal > QUEUE_ROWS && <p className="px-4 py-3 text-small text-text-muted">and {waitingTotal - QUEUE_ROWS} more with the admins</p>}
        </Section>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border lg:grid-cols-4">
        <Figure
          label={`Reviewed, last ${WINDOW_DAYS} days`}
          loading={recent.isPending}
          value={stats?.reviewedCount}
          note={
            !stats
              ? undefined
              : stats.reviewedCount === 0
                ? 'None reviewed yet'
                : `${stats.rejectedCount} rejected (${((stats.rejectedCount / stats.reviewedCount) * 100).toFixed(1)}%)`
          }
        />
        <Figure label="Open estimates" to="/estimates?tab=Accepted" loading={estimates.isPending} value={openEstimates} note={estimates.isError ? 'QuickBooks unavailable' : 'Pending or accepted'} />
        <Figure label="Active customers" to="/customers?tab=active" loading={customers.isPending} value={customers.data?.counts.active} note={customers.isError ? 'QuickBooks unavailable' : 'In QuickBooks'} />
        <Figure
          label="Team members"
          to="/settings/team"
          loading={team.isPending}
          value={activeMembers}
          note={team.isError ? 'Could not load the team' : invites ? `${invites} ${invites === 1 ? 'invite' : 'invites'} not accepted yet` : 'All invites accepted'}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2 [&>section]:h-full">
          <Section title="Recent decisions">
            {recent.isPending && <SkeletonRows label="Loading recent decisions" count={DECISION_ROWS} />}
            {recent.isError && <BlockError what="the payments" onRetry={() => void recent.refetch()} />}
            {stats && stats.recent.length === 0 && <SectionEmpty>No payments have been reviewed yet.</SectionEmpty>}
            {(stats?.recent ?? []).slice(0, DECISION_ROWS).map((p) => (
              <Row
                key={p.id}
                title={p.customerName}
                detail={
                  <>
                    {p.reviewedBy ? `${p.reviewedBy} · ` : ''}
                    {bankLabel(p.bankDepositedTo)} · {p.reviewedAt ? <RelativeTime value={p.reviewedAt} /> : null}
                  </>
                }
                amount={peso(p.finalAmount ?? p.amountSubmitted)}
                badge={<StatusBadge status={p.status} />}
              />
            ))}
          </Section>
        </div>

        <div className="min-w-0 [&>section]:h-full">
          <Section title={`Approved by account, ${WINDOW_DAYS} days`}>
            {recent.isPending && <SkeletonRows label="Loading accounts" count={banks.banks.length} />}
            {recent.isError && <BlockError what="the payments" onRetry={() => void recent.refetch()} />}
            {stats &&
              (() => {
                const rows = banks.banks.map((b) => ({ ...b, ...(stats.banks.get(b.key) ?? { cents: 0, count: 0 }) }));
                const biggest = Math.max(1, ...rows.map((r) => r.cents));
                const lead = rows.reduce((a, b) => (b.cents > a.cents ? b : a), rows[0]!);
                return rows.map((r) => (
                  <div key={r.key} className="flex min-h-16 flex-col justify-center gap-1.5 px-4 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-semibold">{r.label}</span>
                      <span className={cn('tabular-nums', r.cents === 0 && 'text-text-muted')}>{peso(r.cents / 100)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span aria-hidden className="h-0.5 flex-1">
                        <span className={cn('block h-full', r.key === lead.key && r.cents > 0 ? 'bg-text' : 'bg-border-strong')} style={{ width: `${(r.cents / biggest) * 100}%` }} />
                      </span>
                      <span className="shrink-0 text-small text-text-muted tabular-nums">
                        {r.count} {r.count === 1 ? 'payment' : 'payments'}
                      </span>
                    </div>
                  </div>
                ));
              })()}
          </Section>
        </div>
      </div>
    </div>
  );
}

/** A figure in the divided strip: label over value over a note. A link when it has somewhere to go. */
function Figure({ label, value, note, to, loading }: { label: string; value: number | undefined; note?: ReactNode; to?: string; loading?: boolean }) {
  const body = (
    <>
      <span className="block text-small text-text-muted">{label}</span>
      {loading ? (
        <span role="status" aria-label={`Loading ${label}`} className="block">
          <Skeleton className="mt-1 h-7 w-12" />
          <Skeleton className="mt-1.5 h-4 w-32" />
        </span>
      ) : (
        <>
          {/* The spaces keep the link's accessible name readable ("Active customers 18 ...") whatever the CSS does. */}{' '}
          <span className="mt-1 block text-title font-semibold tabular-nums">{value ?? '—'}</span>{' '}
          {note && <span className="mt-0.5 block text-small text-text-muted">{note}</span>}
        </>
      )}
    </>
  );
  const cls = 'block bg-surface p-4 text-text no-underline';
  return to ? (
    <Link to={to} className={cn(cls, 'hover:bg-surface-sunk')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A block that failed says what and offers a retry, inside its own frame. */
function BlockError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <p role="alert" className="px-4 py-6 text-text-muted">
      Could not load {what}.{' '}
      <button type="button" onClick={onRetry} className="min-h-6 cursor-pointer text-accent underline">
        Retry
      </button>
    </p>
  );
}
