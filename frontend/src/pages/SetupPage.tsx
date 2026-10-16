import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { api } from '../api/client';
import type { QboStatus } from '../api/types';
import { Message } from '../components/Message';

export default function SetupPage() {
  const [params] = useSearchParams();
  const [out, setOut] = useState('');

  const status = useQuery({
    queryKey: ['qbo', 'status'],
    queryFn: () => api<QboStatus>('/api/auth/qbo/status?verify=true'),
  });

  const test = useMutation({
    mutationFn: () => api('/api/qbo/estimates?refresh=true'),
    onMutate: () => setOut('Loading…'),
    onSuccess: (data) => setOut(JSON.stringify(data, null, 2)),
    onError: (err) => setOut(JSON.stringify({ error: err.message }, null, 2)),
  });

  const s = status.data;
  const flash = params.get('qbo');

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">QuickBooks setup</h1>

      {flash === 'connected' && <Message type="ok">QuickBooks connected.</Message>}
      {flash === 'error' && <Message>QuickBooks connection failed: {params.get('reason')}</Message>}

      <section className="bg-white rounded-xl shadow-sm border p-5 space-y-3">
        <h2 className="font-medium">1. QuickBooks connection</h2>
        <p className="text-sm text-slate-600" aria-live="polite">
          {status.isPending
            ? 'Checking…'
            : status.error
              ? `Could not check the status (${status.error.message})`
              : s?.connected
                ? `✅ Connected${s.companyName ? ` to "${s.companyName}"` : ''} (realm ${s.realmId})`
                : '❌ Not connected'}
        </p>
        {s?.verifyError && <p className="text-sm text-red-600">{s.verifyError}</p>}
        {/* A real navigation: the backend redirects to Intuit and back. */}
        <a href="/api/auth/qbo" className="inline-block bg-green-600 text-white rounded px-4 py-2 no-underline">
          {s?.connected ? 'Reconnect to QuickBooks' : 'Connect to QuickBooks'}
        </a>
      </section>

      <section className="bg-white rounded-xl shadow-sm border p-5 space-y-3">
        <h2 className="font-medium">2. Test: fetch open estimates</h2>
        <button
          type="button"
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
          disabled={test.isPending}
          onClick={() => test.mutate()}
        >
          Load estimates
        </button>
        <pre className="text-xs bg-slate-100 rounded p-3 overflow-auto max-h-96">{out}</pre>
      </section>
    </main>
  );
}
