import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, RefreshCw, FlaskConical } from 'lucide-react';
import { api } from '../api/client';
import { QBO_REAUTH_KEY, QBO_STATUS_KEY } from '../api/qbo';
import type { Estimate, QboStatus } from '../api/types';
import { signInUrl, useMe } from '../api/auth';
import { useTeam } from '../api/users';
import { Row, Section } from '../components/dashboard/Section';
import { Access } from '../components/team/Access';
import { Message } from '../components/Message';
import { buttonClass, Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorState, Skeleton } from '../components/ui/States';
import { StatusBadge } from '../components/ui/StatusBadge';
import { dateShort, dateTime } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';

interface TestResult {
  count: number;
  ms: number;
  raw: unknown;
}

/** One fact about the connection: a small label over its value. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface p-4">
      <dt className="text-small text-text-muted">{label}</dt>
      <dd className="mt-1 font-semibold break-words">{children}</dd>
    </div>
  );
}

/** Your own QuickBooks connection: health, renewing it, and a connectivity test. */
export default function SetupPage() {
  useDocumentTitle('QuickBooks');
  const qc = useQueryClient();
  const { data: me } = useMe();
  const team = useTeam(me?.role === 'superadmin'); // the list is SuperAdmin-only; the server refuses it for anyone else

  // Asks Intuit to confirm the link, so this is the authoritative check.
  const status = useQuery({
    queryKey: ['qbo', 'status', 'verified'],
    queryFn: () => api<QboStatus>('/api/auth/qbo/status?verify=true'),
  });
  const s = status.data;

  // Keep the shell banner in step with what was just verified.
  useEffect(() => {
    if (!s) return;
    qc.setQueryData(QBO_REAUTH_KEY, s.connected && !!s.verifyError);
    qc.setQueryData(QBO_STATUS_KEY, s);
  }, [s, qc]);

  const test = useMutation({
    mutationFn: async (): Promise<TestResult> => {
      const t0 = performance.now();
      const raw = await api<{ estimates?: Estimate[] }>('/api/qbo/estimates?refresh=true');
      return { count: raw.estimates?.length ?? 0, ms: Math.round(performance.now() - t0), raw };
    },
  });

  const healthy = !!s?.connected && !s.verifyError && !s.needsReauth;
  const days = s?.expiresInDays;

  // The answer first: is it working, and for how long.
  const finding = !s
    ? 'Your own QuickBooks connection.'
    : healthy
      ? `Connected to ${s.companyName ?? 'QuickBooks'}.${days !== undefined ? ` The link stays valid for ${days} more ${days === 1 ? 'day' : 'days'}.` : ''}`
      : s.connected
        ? 'QuickBooks needs you to sign in again before anything can be posted.'
        : 'QuickBooks is not connected. Sign in with QuickBooks to start.';

  return (
    <div>
      <PageHeader title="QuickBooks" description={finding} />

      <div className="space-y-4">
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-body font-semibold">Connection</h2>
            {status.isPending ? (
              <Skeleton className="h-6 w-28" />
            ) : s ? (
              <StatusBadge status={healthy ? 'connected' : 'disconnected'} label={s.connected && (s.verifyError || s.needsReauth) ? 'Needs reconnecting' : undefined} />
            ) : null}
          </div>

          {status.isPending && (
            <div role="status" aria-label="Checking the connection" className="grid grid-cols-2 gap-px overflow-hidden rounded-control border border-border bg-border">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="bg-surface p-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className={i % 2 ? 'mt-2 h-5 w-48' : 'mt-2 h-5 w-32'} />
                </div>
              ))}
            </div>
          )}
          {status.error && <ErrorState message={`Could not check the connection: ${status.error.message}`} onRetry={() => status.refetch()} />}

          {s && (
            <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-control border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
              <Fact label="Company">{s.companyName ?? '—'}</Fact>
              <Fact label="Realm ID">
                <span className="tabular-nums">{s.realmId ?? '—'}</span>
              </Fact>
              <Fact label="Last verified">{s.lastVerifiedAt ? dateTime(s.lastVerifiedAt) : 'Not yet'}</Fact>
              <Fact label="Valid until">
                {s.refreshTokenExpiresAt ? (
                  <>
                    {dateShort(s.refreshTokenExpiresAt)}
                    {s.expiresInDays !== undefined && s.connected ? ` (in ${s.expiresInDays} ${s.expiresInDays === 1 ? 'day' : 'days'})` : ''}
                  </>
                ) : (
                  <span className="font-normal text-text-muted">—</span>
                )}
              </Fact>
            </dl>
          )}
          {s?.verifyError && (
            <Message type="error" className="mb-0">
              QuickBooks rejected the saved connection: {s.verifyError}. Sign in with QuickBooks again to fix it.
            </Message>
          )}

          <div className="flex flex-wrap gap-2">
            {/* A real navigation: the backend redirects to Intuit and back. */}
            <a href={signInUrl('/settings/integrations')} className={buttonClass({ variant: healthy ? 'secondary' : 'primary' })}>
              <Link2 aria-hidden className="size-4" />
              {s?.connected ? 'Reconnect to QuickBooks' : 'Sign in with QuickBooks'}
            </a>
            <Button onClick={() => status.refetch()} loading={status.isFetching && !status.isPending}>
              <RefreshCw aria-hidden className="size-4" />
              Check again
            </Button>
          </div>

          <p className="text-small text-text-muted">The connection is created when you sign in. What you can see and post follows your QuickBooks permissions.</p>
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h2 className="text-body font-semibold">Test the connection</h2>
              <p className="mt-1 text-text-muted">Fetches the open estimates from QuickBooks to confirm everything works end to end.</p>
            </div>
            <Button variant="primary" loading={test.isPending} disabled={!s?.connected} onClick={() => test.mutate()}>
              <FlaskConical aria-hidden className="size-4" />
              Run test
            </Button>
          </div>

          {test.isSuccess && (
            <div role="status">
              <Message type="ok" className="mb-2">
                Success. Loaded {test.data.count} open {test.data.count === 1 ? 'estimate' : 'estimates'} in{' '}
                {(test.data.ms / 1000).toFixed(1)} s.
              </Message>
              <details>
                <summary className="min-h-(--control-h) cursor-pointer py-2 text-accent underline">Show raw response</summary>
                <pre className="max-h-96 overflow-auto rounded-control bg-surface-sunk p-3 text-micro">
                  {JSON.stringify(test.data.raw, null, 2)}
                </pre>
              </details>
            </div>
          )}
          {test.isError && <Message type="error" className="mb-0">The test failed: {test.error.message}</Message>}
        </Card>

        {me?.role === 'superadmin' && team.data && (
          <div>
            <Section title="Who is signed in with QuickBooks">
              {team.data
                .filter((m) => m.active)
                .map((m) => (
                  <Row key={m.id} title={m.name} detail={m.email} badge={<Access member={m} />} />
                ))}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
