import { Link } from 'react-router';
import { useEstimates } from '../../api/crm';
import { useMyPayments, useRecentEstimates } from '../../api/payments';
import { EstimateProgress } from '../crm/EstimateProgress';
import { PageHeader } from '../ui/PageHeader';
import { RelativeTime } from '../ui/RelativeTime';
import { SkeletonRows } from '../ui/Skeletons';
import { Skeleton } from '../ui/States';
import { PaymentStatusDot } from '../ui/StatusBadge';
import { bankLabel, dayLabel, peso } from '../../lib/format';
import { cn } from '../../lib/cn';
import { WINDOW_DAYS, dayShort, lastDays, manilaDay } from './overview';
import { DailyBars } from './DailyBars';
import { Figure, FigureStrip } from './Figure';
import { Row, Section, SectionEmpty } from './Section';

const FIX_ROWS = 3;
const RECENT_ROWS = 5;
const OWED_ROWS = 4;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Sales home. The question it answers: where do my payments stand, and does anything need me?
 * The finding under the title says it (the posted sum, then what was rejected); the lead figure repeats the posted sum.
 *
 * Grid: 3 columns with a 16px gap. Payments take 2 columns, the estimates still to collect take 1,
 * so every row ends on the canvas edges. The strip above is 4 equal cells (2 x 2 on a phone).
 */
export function SalesDashboard() {
  const mine = useMyPayments();
  const recents = useRecentEstimates();
  const open = useEstimates({ page: 1, pageSize: 1 }); // only the status counts are used

  const payments = mine.data?.payments ?? [];
  const pending = payments.filter((p) => p.status === 'pending');
  const approved = payments.filter((p) => p.status === 'approved');
  const rejected = payments.filter((p) => p.status === 'rejected');
  const cents = (s: string) => Math.round(Number(s) * 100);
  const approvedCents = approved.reduce((sum, p) => sum + cents(p.finalAmount ?? p.amountSubmitted), 0);
  const pendingCents = pending.reduce((sum, p) => sum + cents(p.amountSubmitted), 0);
  const unseen = mine.data?.unseenCount ?? 0;
  const openEstimates = open.data ? open.data.counts.Pending! + open.data.counts.Accepted! : undefined;
  const owed = (recents.data ?? []).filter((e) => e.totalAmount - e.approvedAmount - e.pendingAmount > 0);

  // Money submitted per day (Manila days), and per account, from the rows as sent.
  const submittedDays = lastDays(WINDOW_DAYS).map((day) => ({ day, cents: 0 }));
  const dayIndex = new Map(submittedDays.map((d) => [d.day, d]));
  const accounts = new Map<string, { cents: number; count: number }>();
  for (const p of payments) {
    const d = dayIndex.get(manilaDay(p.createdAt));
    if (d) d.cents += cents(p.amountSubmitted);
    const a = accounts.get(p.bankDepositedTo) ?? { cents: 0, count: 0 };
    accounts.set(p.bankDepositedTo, { cents: a.cents + cents(p.amountSubmitted), count: a.count + 1 });
  }
  const submittedC = submittedDays.reduce((n, d) => n + d.cents, 0);
  const accountRows = [...accounts.entries()].sort((a, b) => b[1].cents - a[1].cents);
  const biggestAccount = Math.max(1, ...accountRows.map(([, v]) => v.cents));

  const finding = mine.isPending ? (
    <Skeleton className="mt-1 h-4 w-72 max-w-full" />
  ) : mine.isError ? (
    'Your payments could not be loaded.'
  ) : payments.length === 0 ? (
    'You have not submitted a payment yet.'
  ) : (
    <>
      {peso(approvedCents / 100)} posted from {plural(approved.length, 'approved payment')}.
      {rejected.length > 0
        ? ` ${plural(rejected.length, 'payment')} ${rejected.length === 1 ? 'was' : 'were'} rejected and ${rejected.length === 1 ? 'needs' : 'need'} a fix.`
        : ' Nothing was rejected.'}
      {unseen > 0 && (
        <>
          {' '}
          <Link to="/payments" className="inline-flex min-h-6 items-center text-accent underline pointer-coarse:min-h-11">
            {plural(unseen, 'result')} not seen yet
          </Link>
        </>
      )}
    </>
  );

  return (
    <div>
      <PageHeader title="Dashboard" description={finding} />

      <FigureStrip className="lg:grid-cols-4">
        <Figure
          lead
          label="Posted to QuickBooks"
          to="/payments?tab=approved"
          loading={mine.isPending}
          value={peso(approvedCents / 100)}
          note={mine.data ? `${plural(approved.length, 'payment')}, of your last 30` : undefined}
        />
        <Figure
          label="Waiting for review"
          to="/payments?tab=pending"
          loading={mine.isPending}
          value={pending.length}
          note={mine.data ? (pending.length === 0 ? 'Nothing waiting' : `${peso(pendingCents / 100)} with the admins`) : undefined}
        />
        <Figure
          label="Rejected"
          to="/payments?tab=rejected"
          loading={mine.isPending}
          value={rejected.length}
          tone={rejected.length > 0 ? 'danger' : undefined}
          note={rejected.length > 0 ? 'Read the reasons and resubmit' : 'Nothing to fix'}
        />
        <Figure label="Open estimates" to="/estimates?tab=Accepted" loading={open.isPending} value={openEstimates} note={open.isError ? 'QuickBooks unavailable' : 'Pending or accepted'} />
      </FigureStrip>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {mine.data && payments.length > 0 && (
            <section aria-label="Submitted per day" className="rounded-card border border-border bg-surface p-5">
              <header className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 className="text-body font-semibold">Submitted, last {WINDOW_DAYS} days</h2>
                <span className="text-small text-text-muted">
                  {dayShort(submittedDays[0]!.day)} – {dayShort(submittedDays.at(-1)!.day)}
                </span>
              </header>
              <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[1.875rem] leading-9 font-semibold tabular-nums">{peso(submittedC / 100)}</span>
                <span className="text-text-muted">sent for approval</span>
              </p>
              <div className="mt-4">
                <DailyBars days={submittedDays} label="Submitted per day" />
              </div>
            </section>
          )}

          {rejected.length > 0 && (
            <Section title="Needs a fix" to="/payments?tab=rejected" linkLabel="All rejected">
              {rejected.slice(0, FIX_ROWS).map((p) => (
                <Row
                  key={p.id}
                  to={`/estimates/${p.qboEstimateId}`}
                  title={p.customerName}
                  detail={p.rejectionReason ?? 'No reason was given.'}
                  amount={peso(p.amountSubmitted)}
                  badge={<span className="text-small text-text-muted">Estimate #{p.qboEstimateNumber || p.qboEstimateId}</span>}
                />
              ))}
            </Section>
          )}

          <Section title="Recent payments" to="/payments">
            {mine.isPending && <SkeletonRows label="Loading recent payments" count={RECENT_ROWS} />}
            {mine.isError && <SectionEmpty>Could not load your payments.</SectionEmpty>}
            {mine.data && payments.length === 0 && (
              <SectionEmpty>
                No payments yet.{' '}
                <Link to="/payments/new" className="text-accent underline">
                  Submit your first one
                </Link>{' '}
                to see it here.
              </SectionEmpty>
            )}
            {payments.slice(0, RECENT_ROWS).map((p) => (
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
                badge={<PaymentStatusDot status={p.status} />}
              />
            ))}
          </Section>
        </div>

        <div className="min-w-0 space-y-4">
        <Section title="Left to collect" to="/estimates" linkLabel="All estimates">
          {recents.isPending && <SkeletonRows label="Loading estimates" count={OWED_ROWS} />}
          {recents.isError && <SectionEmpty>Could not load your estimates.</SectionEmpty>}
          {recents.data && owed.length === 0 && <SectionEmpty>Estimates you submit payments for will appear here.</SectionEmpty>}
          {owed.slice(0, OWED_ROWS).map((e) => {
            const left = Math.max(0, e.totalAmount - e.approvedAmount - e.pendingAmount);
            return (
              <Link key={e.id} to={`/estimates/${e.id}`} className="block px-4 py-3 text-text no-underline hover:bg-surface-sunk">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-semibold">{e.customerName}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{peso(left)}</span>
                </span>
                <span className="mb-2 flex items-baseline justify-between gap-3 text-small text-text-muted">
                  <span className="min-w-0 truncate">
                    #{e.docNumber || e.id} · {dayLabel(e.txnDate)}
                  </span>
                  <span className="shrink-0">left to collect</span>
                </span>
                <EstimateProgress compact total={e.totalAmount} approved={e.approvedAmount} pending={e.pendingAmount} />
              </Link>
            );
          })}
        </Section>

        {accountRows.length > 0 && (
          <Section title="By account">
            {accountRows.map(([bank, v], i) => (
              <div key={bank} className="flex min-h-16 flex-col justify-center gap-1.5 px-4 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-semibold">{bankLabel(bank)}</span>
                  <span className="tabular-nums">{peso(v.cents / 100)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span aria-hidden className="h-0.5 flex-1">
                    <span className={cn('block h-full', i === 0 ? 'bg-text' : 'bg-border-strong')} style={{ width: `${(v.cents / biggestAccount) * 100}%` }} />
                  </span>
                  <span className="shrink-0 text-small text-text-muted tabular-nums">{plural(v.count, 'payment')}</span>
                </div>
              </div>
            ))}
          </Section>
        )}
        </div>
      </div>
    </div>
  );
}
