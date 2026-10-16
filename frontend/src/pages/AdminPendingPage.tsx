import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { PendingPayment } from '../api/types';
import { PendingCard } from '../components/PendingCard';

const PENDING_KEY = ['payments', 'pending'] as const;

export default function AdminPendingPage() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const { data, error, refetch, isFetching } = useQuery({
    queryKey: PENDING_KEY,
    queryFn: () => api<{ count: number; payments: PendingPayment[] }>('/api/payments/pending'),
  });

  function onDone(text: string, type: 'success' | 'error') {
    setToast({ text, type });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Refetch even after errors: picks up any partial-sync state.
    void qc.invalidateQueries({ queryKey: PENDING_KEY });
  }

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Pending payments</h1>
        <button type="button" className="underline text-sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          className={`rounded px-3 py-2 text-sm ${toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}
        >
          {toast.text}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded px-3 py-2 text-sm bg-red-50 text-red-700">
          {error.message}
        </div>
      )}
      {data && <p className="text-sm text-slate-500">{data.count ? `${data.count} awaiting review` : ''}</p>}

      <section className="space-y-4">
        {data && !data.payments.length && (
          <p className="text-slate-500 text-center py-10">Nothing pending. All caught up! 🎉</p>
        )}
        {data?.payments.map((p) => <PendingCard key={p.id} payment={p} onDone={onDone} />)}
      </section>
    </main>
  );
}
