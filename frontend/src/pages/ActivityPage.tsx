import { Link } from 'react-router';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  Ban,
  CircleCheck,
  CircleX,
  History,
  LogIn,
  Plug,
  ReceiptText,
  ShieldAlert,
  TriangleAlert,
  Undo2,
  Unplug,
  UserCog,
  UserPlus,
  UserX,
} from 'lucide-react';
import { useActivity } from '../api/activity';
import type { ActivityCategory, ActivityEvent } from '../api/types';
import { useTeam } from '../api/users';
import { Pagination } from '../components/data/Pagination';
import { BlockError } from '../components/dashboard/Section';
import { Avatar } from '../components/ui/Avatar';
import { Checkbox, Select } from '../components/ui/controls';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonRows } from '../components/ui/Skeletons';
import { EmptyState, Skeleton } from '../components/ui/States';
import { Tabs } from '../components/ui/Tabs';
import { cn } from '../lib/cn';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useUrlFilters } from '../lib/useUrlFilters';

const DEFAULTS = { tab: 'all', actor: '', failed: '', page: '1', size: '50' };
const TABS: { id: 'all' | ActivityCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'payments', label: 'Payments' },
  { id: 'team', label: 'Team' },
  { id: 'access', label: 'Sign-ins' }, // sign-ins and QuickBooks connections; short enough to stay on one row on a phone
];
const ROLE: Record<string, string> = { sales: 'Sales', admin: 'Admin', superadmin: 'SuperAdmin' };

/** One small glyph per kind of event, so a column of sentences can be scanned by shape. Muted; red only on a failure. */
const GLYPH: Record<string, { icon: LucideIcon; label: string }> = {
  'payment.submitted': { icon: ReceiptText, label: 'Payment submitted' },
  'payment.approved': { icon: CircleCheck, label: 'Payment approved' },
  'payment.approve_failed': { icon: TriangleAlert, label: 'Approval failed' },
  'payment.rejected': { icon: CircleX, label: 'Payment rejected' },
  'payment.reject_undone': { icon: Undo2, label: 'Rejection undone' },
  'payment.voided': { icon: Ban, label: 'Payment voided' },
  'payment.void_failed': { icon: TriangleAlert, label: 'Void failed' },
  'user.invited': { icon: UserPlus, label: 'Person invited' },
  'user.reinvited': { icon: UserPlus, label: 'Invite link sent again' },
  'user.updated': { icon: UserCog, label: 'Account changed' },
  'auth.signed_in': { icon: LogIn, label: 'Signed in' },
  'auth.sign_in_refused': { icon: ShieldAlert, label: 'Sign-in refused' },
  'qbo.connected': { icon: Plug, label: 'QuickBooks connected' },
  'qbo.disconnected': { icon: Unplug, label: 'QuickBooks disconnected' },
};

const manilaDay = (d: string | number | Date) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

/** "Today", "Yesterday", or "Mon, Nov 2" (with the year when it is not this year). */
function dayHeading(day: string, now = Date.now()) {
  if (day === manilaDay(now)) return 'Today';
  if (day === manilaDay(now - 86_400_000)) return 'Yesterday';
  const d = new Date(`${day}T00:00:00Z`);
  const sameYear = day.slice(0, 4) === manilaDay(now).slice(0, 4);
  return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' });
}
const timeOf = (at: string) => new Date(at).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit' });

/** Consecutive events of the same Manila day, newest day first (the API already sorts newest first). */
function byDay(items: ActivityEvent[]) {
  const groups: { day: string; items: ActivityEvent[] }[] = [];
  for (const e of items) {
    const day = manilaDay(e.at);
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(e);
  }
  return groups;
}

/**
 * SuperAdmin activity log. The question: who did what, and did anything fail? The answer to the second part leads: how
 * many attempts failed under the current filters, with one click to see only those. Then every approval, rejection,
 * void, invite, role change and sign-in, newest first, each with a glyph for its kind and failures marked.
 */
export default function ActivityPage() {
  useDocumentTitle('Activity');
  const { values: f, set } = useUrlFilters(DEFAULTS);
  const page = Math.max(1, Number(f.page) || 1);
  const size = Number(f.size) === 25 ? 25 : 50;
  const failedOnly = f.failed === 'true';
  const category = f.tab === 'all' ? undefined : (f.tab as ActivityCategory);
  const actor = f.actor || undefined;

  const team = useTeam();
  const activity = useActivity({ category, actor, failed: failedOnly, page, pageSize: size });
  // Same filters, failures only: just the count, for the line under the title.
  const failures = useActivity({ category, actor, failed: true, page: 1, pageSize: 10 });

  const data = activity.data;
  const failedTotal = failures.data?.total;
  const people = (team.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  // A stable tint per person: their place in the team list, so the same person keeps the same colour on every page.
  const tint = new Map(people.map((p, i) => [p.id, i]));
  const filtered = f.tab !== 'all' || !!f.actor || failedOnly;

  return (
    <div>
      <PageHeader
        title="Activity"
        description={
          <Finding
            total={data?.total}
            failed={failedTotal}
            failedOnly={failedOnly}
            filtered={filtered}
            onShowFailed={() => set({ failed: 'true', page: '1' })}
            onShowAll={() => set({ failed: '', page: '1' })}
          />
        }
      />

      <div data-tour="p:activity.tabs">
        <Tabs label="Kind of activity" tabs={TABS} value={f.tab} onChange={(tab) => set({ tab, page: '1' })} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2" data-tour="p:activity.filters">
        <label className="flex items-center gap-2">
          <span className="text-text-muted">Person</span>
          <Select value={f.actor} onChange={(e) => set({ actor: e.target.value, page: '1' })} className="w-56 max-w-[60vw]">
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.active ? '' : ' (deactivated)'}
              </option>
            ))}
          </Select>
        </label>
        <Checkbox checked={failedOnly} onChange={(e) => set({ failed: e.target.checked ? 'true' : '', page: '1' })}>
          Only failed attempts
        </Checkbox>
      </div>

      <section aria-label="Activity" data-tour="p:activity.list" aria-busy={activity.isFetching || undefined} className="overflow-hidden rounded-card border border-border bg-surface">
        {activity.isPending && <SkeletonRows label="Loading activity" count={6} />}
        {activity.isError && !data && <BlockError what="the activity log" onRetry={() => void activity.refetch()} />}
        {data && data.items.length === 0 && (
          <EmptyState icon={History} title={failedOnly ? 'No failed attempts' : filtered ? 'No matching activity' : 'No activity yet'}>
            {failedOnly
              ? 'Every approval, void and sign-in in this view went through.'
              : filtered
                ? 'Try another kind of activity or another person.'
                : 'Approvals, rejections, invites and sign-ins are recorded here from now on.'}
          </EmptyState>
        )}
        {data &&
          byDay(data.items).map((g) => (
            <div key={g.day}>
              <h2 className="sticky top-0 z-10 bg-surface-sunk px-4 py-2 text-small font-semibold text-text-muted">{dayHeading(g.day)}</h2>
              <ol className="divide-y divide-border">
                {g.items.map((e) => (
                  <Event key={e.id} e={e} tint={e.actorId ? tint.get(e.actorId) : undefined} />
                ))}
              </ol>
            </div>
          ))}
      </section>

      {data && data.total > 0 && (
        <Pagination page={page} size={size} total={data.total} onPage={(p) => set({ page: String(p) })} onSize={(s) => set({ size: String(s), page: '1' })} />
      )}
    </div>
  );
}

/**
 * The line under the title: how much there is, and how many attempts failed. The failure count is itself the way to see
 * them (one click, the same filter as the checkbox), so the answer and its action sit together.
 */
function Finding({
  total,
  failed,
  failedOnly,
  filtered,
  onShowFailed,
  onShowAll,
}: {
  total?: number;
  failed?: number;
  failedOnly: boolean;
  filtered: boolean;
  onShowFailed: () => void;
  onShowAll: () => void;
}) {
  if (total === undefined) return <Skeleton className="mt-1 h-4 w-64 max-w-full" />;
  const n = (x: number, one: string, many: string) => `${x.toLocaleString('en-PH')} ${x === 1 ? one : many}`;
  const action = 'min-h-6 cursor-pointer font-semibold underline underline-offset-2 pointer-coarse:min-h-11';
  if (failedOnly) {
    return (
      <>
        {total === 0 ? 'No failed attempts.' : `${n(total, 'failed attempt', 'failed attempts')}, newest first.`}{' '}
        <button type="button" onClick={onShowAll} className={cn(action, 'text-accent')}>
          Show everything
        </button>
      </>
    );
  }
  if (total === 0) return <>{filtered ? 'Nothing matches these filters.' : 'Nothing has been recorded yet.'}</>;
  return (
    <>
      {n(total, 'event', 'events')}
      {filtered ? ' match these filters' : ''}, newest first.{' '}
      {failed === undefined ? null : failed === 0 ? (
        'None failed.'
      ) : (
        <button type="button" onClick={onShowFailed} className={cn(action, 'inline-flex items-center gap-1 text-danger')}>
          <TriangleAlert aria-hidden className="size-3.5" />
          {n(failed, 'attempt', 'attempts')} failed
        </button>
      )}
    </>
  );
}

/** One event: when, who, what, and a way to the estimate it was about. A failed attempt is marked once, by its tag. */
function Event({ e, tint }: { e: ActivityEvent; tint?: number }) {
  const failed = e.outcome === 'failed';
  const estimateId = typeof e.details?.estimateId === 'string' ? e.details.estimateId : null;
  const glyph = GLYPH[e.action] ?? { icon: History, label: e.action };
  const Icon = glyph.icon;
  return (
    <li className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[5rem_13rem_minmax(0,1fr)]">
      <time dateTime={e.at} className="pt-1.5 text-small text-text-muted tabular-nums">
        {timeOf(e.at)}
      </time>
      <span className="flex min-w-0 items-start gap-2">
        {e.actorId ? (
          <Avatar name={e.actorName} index={tint ?? 0} />
        ) : (
          <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-text-muted">
            <UserX className="size-4" />
          </span>
        )}
        <span className="min-w-0">
          <span className={cn('block truncate font-semibold', !e.actorId && 'font-normal text-text-muted')}>{e.actorName}</span>
          <span className="block text-small text-text-muted">{e.actorRole ? (ROLE[e.actorRole] ?? e.actorRole) : 'No account'}</span>
        </span>
      </span>
      <div className="col-span-2 flex min-w-0 items-start gap-2.5 sm:col-span-1 sm:pt-1">
        <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', failed ? 'text-danger' : 'text-text-muted')} />
        <div className="min-w-0">
          <p className="wrap-break-word">
            <span className="sr-only">{glyph.label}: </span>
            {failed && (
              <span className="mr-2 inline-block rounded-badge bg-danger-bg px-2 py-px align-[1px] text-small font-semibold whitespace-nowrap text-danger">Failed</span>
            )}
            {e.summary}
          </p>
          {estimateId && (
            <Link to={`/estimates/${estimateId}`} className="mt-1 inline-flex min-h-6 items-center gap-1 text-small text-accent underline pointer-coarse:min-h-11">
              Open estimate{e.details?.estimateNumber ? ` #${e.details.estimateNumber}` : ''} <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
