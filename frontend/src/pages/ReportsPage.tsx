import { useId, type ReactNode } from 'react';
import { useReport } from '../api/reports';
import type { Report, ReportGroup } from '../api/types';
import { DailyBars } from '../components/dashboard/DailyBars';
import { Figure, FigureStrip } from '../components/dashboard/Figure';
import { BlockError, Row, Section, SectionEmpty } from '../components/dashboard/Section';
import { Avatar } from '../components/ui/Avatar';
import { Input } from '../components/ui/controls';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonRows } from '../components/ui/Skeletons';
import { Skeleton } from '../components/ui/States';
import { cn } from '../lib/cn';
import { bankLabel, peso, todayManila } from '../lib/format';
import { MAX_DAILY_DAYS, PRESETS, daysBetween, periodLabel, presetRange, rangeLabel, rangeProblem, waitLabel, type PresetId } from '../lib/reportRange';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useUrlFilters } from '../lib/useUrlFilters';

const DEFAULTS = { range: '30d', from: '', to: '', group: '' };
const GROUPS: { id: ReportGroup; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];
const WAITING_ROWS = 5;
/** A payment waiting longer than this is flagged in the queue list. */
const STALE_MINUTES = 24 * 60;

/**
 * SuperAdmin reports. The question: how much money came in over this period, and is anything slowing it down?
 * Read-only, like the overview: SuperAdmins do not approve, so nothing here links into the review queue.
 *
 * Grid: 3 columns, 16px gap. Collected (2) beside the queue (1); the five accounts as one strip of 5 equal cells;
 * the sales reps table (2) beside the review turnaround (1). Every row ends on the canvas edges.
 */
export default function ReportsPage() {
  useDocumentTitle('Reports');
  const { values: filters, set: setFilters } = useUrlFilters(DEFAULTS);
  const preset = (PRESETS.some((p) => p.id === filters.range) ? filters.range : '30d') as PresetId;
  const today = todayManila();

  const customProblem = preset === 'custom' ? rangeProblem(filters.from, filters.to, today) : null;
  const range = preset === 'custom' ? (customProblem ? presetRange('30d', today) : { from: filters.from, to: filters.to }) : presetRange(preset, today);
  const days = daysBetween(range.from, range.to);
  const group = (GROUPS.some((g) => g.id === filters.group) && !(filters.group === 'day' && days > MAX_DAILY_DAYS) ? filters.group : undefined) as
    | ReportGroup
    | undefined;

  const report = useReport({ ...range, group });
  const data = report.data;
  const stale = report.isPlaceholderData; // the previous range, still shown while the new one loads

  return (
    <div>
      <PageHeader title="Reports" description={<Finding report={data} loading={report.isPending} />} />

      <RangeBar
        preset={preset}
        from={filters.from || range.from}
        to={filters.to || range.to}
        today={today}
        problem={customProblem}
        group={data?.range.group ?? group}
        dailyAllowed={days <= MAX_DAILY_DAYS}
        updating={report.isFetching && !report.isPending}
        onPreset={(id) => {
          const dates = id === 'custom' ? { from: range.from, to: range.to } : { from: '', to: '' };
          setFilters({ range: id, ...dates, group: '' }); // a new range picks its own bar size again
        }}
        onDates={(from, to) => setFilters({ range: 'custom', from, to, group: '' })}
        onGroup={(g) => setFilters({ group: g })}
      />

      {report.isError && !data ? (
        <div className="rounded-card border border-border bg-surface">
          <BlockError what="the report" onRetry={() => void report.refetch()} />
        </div>
      ) : (
        <div aria-busy={stale || undefined} className={cn('transition-opacity motion-reduce:transition-none', stale && 'opacity-60')}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Collections report={data} />
            <div className="min-w-0 [&>section]:h-full">
              <Waiting report={data} />
            </div>
          </div>

          <Accounts report={data} />

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2 [&>section]:h-full" data-tour="p:reports.reps">
              <Reps report={data} />
            </div>
            <div className="min-w-0 [&>section]:h-full">
              <Turnaround report={data} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Title row ───────────────────────── */

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/** The one sentence under the title: what came in, and how that compares. */
function Finding({ report, loading }: { report?: Report; loading: boolean }) {
  if (loading || !report) return loading ? <Skeleton className="mt-1 h-4 w-80 max-w-full" /> : null;
  const c = report.collections;
  const period = rangeLabel(report.range.from, report.range.to);
  if (c.count === 0) return <>Nothing was collected from {period}.</>;
  return (
    <>
      {peso(c.net)} collected from {c.count} approved {c.count === 1 ? 'payment' : 'payments'}, {period}.
    </>
  );
}

/** Range presets, custom dates and the bar size, as one toolbar row. */
function RangeBar({
  preset,
  from,
  to,
  today,
  problem,
  group,
  dailyAllowed,
  updating,
  onPreset,
  onDates,
  onGroup,
}: {
  preset: PresetId;
  from: string;
  to: string;
  today: string;
  problem: string | null;
  group?: ReportGroup;
  dailyAllowed: boolean;
  updating: boolean;
  onPreset: (id: PresetId) => void;
  onDates: (from: string, to: string) => void;
  onGroup: (g: ReportGroup) => void;
}) {
  const problemId = useId();
  return (
    <div className="mb-4 space-y-3" data-tour="p:reports.range">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Period" value={preset} options={PRESETS.map((p) => ({ id: p.id, label: p.label }))} onChange={(id) => onPreset(id as PresetId)} />
        <div className="flex items-center gap-3">
          {/* empty:hidden: an idle status takes no room, so a wrapped control lines up with the period control above. */}
          <span role="status" className="text-small text-text-muted empty:hidden">
            {updating ? 'Updating…' : ''}
          </span>
          <Segmented
            label="Show totals per"
            value={group ?? ''}
            options={GROUPS.map((g) => ({ ...g, disabled: g.id === 'day' && !dailyAllowed, title: g.id === 'day' && !dailyAllowed ? `Days are shown for ranges up to ${MAX_DAILY_DAYS} days` : undefined }))}
            onChange={(id) => onGroup(id as ReportGroup)}
          />
        </div>
      </div>

      {preset === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <DateField label="From" value={from} max={today} invalid={!!problem} describedBy={problem ? problemId : undefined} onChange={(v) => onDates(v, to)} />
          <DateField label="To" value={to} max={today} invalid={!!problem} describedBy={problem ? problemId : undefined} onChange={(v) => onDates(from, v)} />
          {problem && (
            <p id={problemId} className="pb-2.5 text-small text-danger">
              {problem} Showing the last 30 days meanwhile.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function DateField({ label, value, max, invalid, describedBy, onChange }: { label: string; value: string; max: string; invalid: boolean; describedBy?: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-small text-text-muted">
        {label}
      </label>
      <Input id={id} type="date" value={value} max={max} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} className="w-44" />
    </div>
  );
}

/** A row of mutually exclusive options. Wraps on a phone instead of scrolling, so every option stays visible. */
function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string; disabled?: boolean; title?: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-control bg-surface-sunk p-1">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={o.disabled}
            title={o.title}
            onClick={() => !selected && onChange(o.id)}
            className={cn(
              'min-h-9 cursor-pointer rounded-sm px-3 text-small whitespace-nowrap pointer-coarse:min-h-11 disabled:cursor-not-allowed disabled:opacity-45',
              selected ? 'bg-surface font-semibold text-text shadow-[0_0_0_1px_var(--color-border)]' : 'text-text-muted hover:text-text',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Blocks ───────────────────────── */

/** Collected over the period: the answer figure, how it compares, and the bars. */
function Collections({ report }: { report?: Report }) {
  const c = report?.collections;
  return (
    <section aria-label="Collected" data-tour="p:reports.collected" className="min-w-0 rounded-card border border-border bg-surface p-5 lg:col-span-2">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-body font-semibold">Collected</h2>
        {report && <span className="text-small text-text-muted">{rangeLabel(report.range.from, report.range.to)}</span>}
      </header>
      {!report || !c ? (
        <div role="status" aria-label="Loading collections">
          <Skeleton className="mt-3 h-7.5 w-44" />
          <Skeleton className="mt-2 h-4 w-64" />
          <Skeleton className="mt-4 h-52" />
        </div>
      ) : (
        <>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className="text-[30px] leading-9 font-semibold tabular-nums">{peso(c.net)}</span>
            <span className="text-text-muted">
              net from {c.count} approved {c.count === 1 ? 'payment' : 'payments'}
            </span>
          </p>
          <p className="mt-1 text-small text-text-muted tabular-nums">
            {peso(c.gross)} received, {peso(c.fees)} in bank fees{c.gross > 0 ? ` (${pct(c.fees, c.gross).toFixed(1)}%)` : ''}
          </p>
          <Change report={report} />
          <div className="mt-4">
            <DailyBars
              days={c.series.map((b) => ({ day: b.start, cents: Math.round(b.net * 100) }))}
              label={`Collected per ${report.range.group}`}
              tickLabel={(d) => periodLabel(d, report.range.group, report.range.from.slice(0, 4) !== report.range.to.slice(0, 4))}
              step={report.range.group === 'day' ? undefined : c.series.length > 8 ? 2 : 1}
            />
          </div>
          {report.range.group === 'week' && <p className="mt-1 text-small text-text-muted">Each bar is a week, labelled by its Monday.</p>}
          {c.voided > 0 && (
            <p className="mt-1 text-small text-text-muted">
              {c.voided} {c.voided === 1 ? 'payment was' : 'payments were'} approved and later voided, so {c.voided === 1 ? 'it is' : 'they are'} not counted.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** Against the same number of days before: more collected is good, less is bad; nothing to compare is grey. */
function Change({ report }: { report: Report }) {
  const c = report.collections;
  const before = `the previous ${report.range.days} days (${rangeLabel(report.previous.from, report.previous.to)})`;
  const diff = Math.round((c.net - c.previousNet) * 100) / 100;
  let text: ReactNode;
  let tone = 'text-text-muted';
  if (c.previousNet === 0 && c.net === 0) text = `Nothing was collected in ${before} either.`;
  else if (c.previousNet === 0) text = `Nothing was collected in ${before}.`;
  else if (diff === 0) text = `The same as ${before}.`;
  else {
    tone = diff > 0 ? 'text-success' : 'text-danger';
    text = (
      <>
        <span className={cn('font-semibold', tone)}>
          {diff > 0 ? '+' : '−'}
          {peso(Math.abs(diff))} ({diff > 0 ? '+' : '−'}
          {Math.abs(pct(diff, c.previousNet)).toFixed(1)}%)
        </span>{' '}
        <span className="text-text-muted">against {before}.</span>
      </>
    );
  }
  return <p className={cn('mt-1 text-small tabular-nums', typeof text === 'string' && tone)}>{text}</p>;
}

/** What is stuck right now, oldest first. Not tied to the period: it is the queue as it stands. */
function Waiting({ report }: { report?: Report }) {
  const w = report?.turnaround.waiting;
  return (
    <Section
      title="Waiting for review now"
      meta={w && w.count > 0 ? `${w.count} ${w.count === 1 ? 'payment' : 'payments'}` : undefined}
      footer={
        w && w.count > 0 ? (
          // The total sits at the card's foot, so a short queue beside a tall chart ends on a figure, not a gap.
          <p className="flex items-baseline justify-between gap-3 px-4 py-3">
            <span className="text-text-muted">Total waiting</span>
            <span className="font-semibold tabular-nums">{peso(w.amount)}</span>
          </p>
        ) : undefined
      }
    >
      {!w && <SkeletonRows label="Loading the review queue" count={WAITING_ROWS} />}
      {w && w.count === 0 && <SectionEmpty>Nothing is waiting. Every submitted payment has been reviewed.</SectionEmpty>}
      {w?.oldest.map((p) => {
        const isStale = p.waitingMinutes >= STALE_MINUTES;
        return (
          <Row
            key={p.id}
            title={p.customerName}
            detail={p.submittedBy}
            amount={peso(p.amount)}
            badge={<span className={cn('text-small', isStale ? 'font-semibold text-warning' : 'text-text-muted')}>waiting {waitLabel(p.waitingMinutes)}</span>}
          />
        );
      })}
      {w && w.count > WAITING_ROWS && <p className="px-4 py-3 text-small text-text-muted">and {w.count - WAITING_ROWS} more with the admins</p>}
    </Section>
  );
}

/** Where the money landed: one cell per account, zeros included, so a quiet account is seen as quiet. */
function Accounts({ report }: { report?: Report }) {
  const total = report?.collections.net ?? 0;
  const lead = report?.banks.reduce((a, b) => (b.net > a.net ? b : a), report.banks[0]!);
  return (
    <section aria-label="Collected by account" data-tour="p:reports.accounts" className="mt-4">
      <h2 className="mb-2 text-body font-semibold">Collected by account</h2>
      <FigureStrip className="sm:grid-cols-3 lg:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        {(report?.banks ?? Array.from({ length: 5 }, (_, i) => ({ bank: String(i), count: 0, gross: 0, fees: 0, net: 0 }))).map((b) => (
          <div key={b.bank} className="bg-surface">
            <Figure
              label={report ? bankLabel(b.bank) : 'Account'}
              loading={!report}
              value={<span className={cn(b.net === 0 && 'text-text-muted')}>{peso(b.net)}</span>}
              note={
                b.count === 0
                  ? 'No payments'
                  : `${b.count} ${b.count === 1 ? 'payment' : 'payments'}${b.fees > 0 ? ` · ${peso(b.fees)} fees` : ''}`
              }
            />
            {report && (
              <div className="flex items-center gap-2 px-4 pb-4" aria-label={`${pct(b.net, total).toFixed(1)}% of the total`}>
                <span aria-hidden className="h-0.5 flex-1 bg-surface-sunk">
                  <span className={cn('block h-full', b.bank === lead?.bank && b.net > 0 ? 'bg-text' : 'bg-border-strong')} style={{ width: `${pct(b.net, total)}%` }} />
                </span>
                <span className="w-12 text-right text-small text-text-muted tabular-nums">{pct(b.net, total).toFixed(1)}%</span>
              </div>
            )}
          </div>
        ))}
      </FigureStrip>
    </section>
  );
}

/** Each sales rep: sent, decided and collected in the period, and what they still have waiting. */
function Reps({ report }: { report?: Report }) {
  return (
    <Section title="By sales rep" meta={report ? `${report.reps.length} ${report.reps.length === 1 ? 'rep' : 'reps'}` : undefined}>
      {!report && <SkeletonRows label="Loading sales reps" count={4} />}
      {report && report.reps.length === 0 && <SectionEmpty>No payments were submitted or decided in this period.</SectionEmpty>}
      {/* Phones: one row per rep with the amount on the right, the counts in the line below. */}
      {report?.reps.map((r) => (
        <div key={r.id ?? r.name} className="sm:hidden">
          <Row
            title={r.name}
            detail={`${r.submitted} sent · ${r.approved} approved · ${r.rejected} rejected`}
            amount={<span className={cn(r.collected === 0 && 'font-normal text-text-muted')}>{peso(r.collected)}</span>}
            badge={r.waiting > 0 ? <span className="text-small text-text-muted">{r.waiting} waiting</span> : undefined}
          />
        </div>
      ))}
      {report && report.reps.length > 0 && (
        <div className="max-sm:hidden">
          <table className="w-full text-body">
            <caption className="sr-only">Payments by sales rep, {rangeLabel(report.range.from, report.range.to)}</caption>
            <thead>
              <tr className="text-small text-text-muted [&>th]:h-10 [&>th]:px-4 [&>th]:font-normal">
                <th scope="col" className="text-left">Sales rep</th>
                <th scope="col" className="text-right">Submitted</th>
                <th scope="col" className="text-right">Approved</th>
                <th scope="col" className="text-right">Rejected</th>
                <th scope="col" className="text-right">Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border border-t border-border">
              {report.reps.map((r, i) => {
                const decided = r.approved + r.rejected;
                return (
                  <tr key={r.id ?? r.name} className="[&>td]:px-4 [&>td]:py-2.5">
                    <th scope="row" className="text-left font-normal">
                      <span className="flex items-center gap-3">
                        <Avatar name={r.name} index={i} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{r.name}</span>
                          {r.waiting > 0 && <span className="block text-small text-text-muted">{r.waiting} waiting for review</span>}
                        </span>
                      </span>
                    </th>
                    <td className="text-right tabular-nums">{r.submitted}</td>
                    <td className="text-right tabular-nums">{r.approved}</td>
                    <td className="text-right tabular-nums">
                      <span className="block">{r.rejected}</span>
                      <span className="block text-small text-text-muted">{decided > 0 ? `${pct(r.rejected, decided).toFixed(0)}%` : '—'}</span>
                    </td>
                    <td className={cn('text-right font-semibold tabular-nums', r.collected === 0 && 'font-normal text-text-muted')}>{peso(r.collected)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {report && report.reps.length > 0 && (
        <p className="px-4 py-3 text-small text-text-muted">Submitted counts payments sent in the period; approved, rejected and collected count decisions made in it.</p>
      )}
    </Section>
  );
}

/** How fast payments get a decision, and how often the answer is no. */
function Turnaround({ report }: { report?: Report }) {
  const t = report?.turnaround;
  const biggest = t ? Math.max(1, ...t.bands.map((b) => b.count)) : 1;
  return (
    <Section title="Review turnaround" meta={t ? `${t.decided} ${t.decided === 1 ? 'decision' : 'decisions'}` : undefined}>
      {!t && <SkeletonRows label="Loading turnaround" count={3} />}
      {t && (
        <>
          <dl className="grid grid-cols-2 gap-px bg-border">
            <div className="bg-surface p-4">
              <dt className="text-small text-text-muted">Median wait</dt>
              <dd className="mt-1 text-title font-semibold tabular-nums">{waitLabel(t.medianMinutes)}</dd>
              <dd className="mt-0.5 text-small text-text-muted">{t.p90Minutes === null ? 'No decisions yet' : `90% within ${waitLabel(t.p90Minutes)}`}</dd>
            </div>
            <div className="bg-surface p-4">
              <dt className="text-small text-text-muted">Rejected</dt>
              <dd className="mt-1 text-title font-semibold tabular-nums">{t.decided > 0 ? `${pct(t.rejected, t.decided).toFixed(1)}%` : '—'}</dd>
              <dd className="mt-0.5 text-small text-text-muted">{t.decided > 0 ? `${t.rejected} of ${t.decided}` : 'No decisions yet'}</dd>
            </div>
          </dl>
          <div className="p-4">
            <h3 className="mb-2 text-small text-text-muted">Time from submission to decision</h3>
            <ul className="space-y-2.5">
              {t.bands.map((b) => (
                <li key={b.label}>
                  <div className="flex items-baseline justify-between gap-3 text-small">
                    <span>{b.label}</span>
                    <span className={cn('tabular-nums', b.count === 0 && 'text-text-muted')}>{b.count}</span>
                  </div>
                  <span aria-hidden className="mt-1 block h-0.5 bg-surface-sunk">
                    <span className={cn('block h-full', b.count === biggest && b.count > 0 ? 'bg-text' : 'bg-border-strong')} style={{ width: `${(b.count / biggest) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Section>
  );
}
