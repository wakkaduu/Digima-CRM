import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { Link2, RefreshCw, FlaskConical } from 'lucide-react';
import { api } from '../api/client';
import { QBO_REAUTH_KEY, QBO_STATUS_KEY } from '../api/qbo';
import type { Estimate, QboStatus } from '../api/types';
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

/** Admin: QuickBooks connection health, reconnect, and a connectivity test. */
export default function SetupPage() {
  useDocumentTitle('QuickBooks');
  const qc = useQueryClient();
  const [params] = useSearchParams();

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

  const flash = params.get('qbo');
  const healthy = !!s?.connected && !s.verifyError && !s.needsReauth;

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="QuickBooks" description="The connection that lets approved payments post to your books." />

      {flash === 'connected' && <Message type="ok">QuickBooks connected.</Message>}
      {flash === 'error' && <Message>QuickBooks connection failed: {params.get('reason') ?? 'unknown reason'}</Message>}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Connection</h2>
          {status.isPending ? (
            <Skeleton className="h-6 w-28" />
          ) : s ? (
            <StatusBadge status={healthy ? 'connected' : 'disconnected'} label={s.connected && (s.verifyError || s.needsReauth) ? 'Needs reconnecting' : undefined} />
          ) : null}
        </div>

        {status.isPending && (
          <div role="status" aria-label="Checking the connection" className="space-y-2">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-40" />
          </div>
        )}
        {status.error && <ErrorState message={`Could not check the connection: ${status.error.message}`} onRetry={() => status.refetch()} />}

        {s && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 [&_dt]:text-text-muted">
            <dt>Company</dt>
            <dd>{s.companyName ?? '—'}</dd>
            <dt>Realm ID</dt>
            <dd className="break-all">{s.realmId ?? '—'}</dd>
            <dt>Last verified</dt>
            <dd>{s.lastVerifiedAt ? dateTime(s.lastVerifiedAt) : 'Not yet'}</dd>
            {s.refreshTokenExpiresAt && (
              <>
                <dt>Valid until</dt>
                <dd>
                  {dateShort(s.refreshTokenExpiresAt)}
                  {s.expiresInDays !== undefined && s.connected ? ` (in ${s.expiresInDays} ${s.expiresInDays === 1 ? 'day' : 'days'})` : ''}
                </dd>
              </>
            )}
          </dl>
        )}
        {s?.verifyError && (
          <Message type="error" className="mb-0">
            QuickBooks rejected the saved connection: {s.verifyError}. Reconnect to fix it.
          </Message>
        )}

        <div className="flex flex-wrap gap-2">
          {/* A real navigation: the backend redirects to Intuit and back. */}
          <a href="/api/auth/qbo" className={buttonClass({ variant: healthy ? 'secondary' : 'primary' })}>
            <Link2 aria-hidden className="size-4" />
            {s?.connected ? 'Reconnect to QuickBooks' : 'Connect to QuickBooks'}
          </a>
          <Button onClick={() => status.refetch()} loading={status.isFetching && !status.isPending}>
            <RefreshCw aria-hidden className="size-4" />
            Check again
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Test the connection</h2>
        <p className="text-text-muted">Fetches the open estimates from QuickBooks to confirm everything works end to end.</p>
        <Button variant="primary" loading={test.isPending} disabled={!s?.connected} onClick={() => test.mutate()}>
          <FlaskConical aria-hidden className="size-4" />
          Run test
        </Button>

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
    </div>
  );
}
