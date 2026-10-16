import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { MyPayment, PaymentStatus } from '../api/types';
import { bankLabel, peso, when } from '../lib/format';

const STATUS_TEXT: Record<PaymentStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const MINE_KEY = ['payments', 'mine'] as const;

export function MySubmissions() {
  const qc = useQueryClient();
  const { data, error } = useQuery({
    queryKey: MINE_KEY,
    queryFn: () => api<{ payments: MyPayment[]; unseenCount: number }>('/api/payments/mine'),
  });

  const dismiss = useMutation({
    mutationFn: () => api('/api/payments/mine/seen', { method: 'POST' }),
    onSettled: () => qc.invalidateQueries({ queryKey: MINE_KEY }),
  });

  const count = data?.unseenCount ?? 0;

  return (
    <>
      {count > 0 && (
        <div className="msg msg-info" role="status">
          {count} of your submissions {count === 1 ? 'has' : 'have'} been reviewed since you last checked (see "New"
          below).{' '}
          <button type="button" className="btn btn-link" onClick={() => dismiss.mutate()}>
            Dismiss
          </button>
        </div>
      )}

      <section className="panel">
        <div className="table-wrap">
          <table className="table">
            <caption>My recent submissions</caption>
            <thead>
              <tr>
                <th>Submitted</th>
                <th>Customer</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td className="sub" colSpan={5}>
                    Could not load your submissions: {error.message}
                  </td>
                </tr>
              ) : data && !data.payments.length ? (
                <tr>
                  <td className="sub" colSpan={5}>
                    You have not submitted any payments yet.
                  </td>
                </tr>
              ) : (
                data?.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{when(p.createdAt)}</td>
                    <td>
                      <div>{p.customerName}</div>
                      <div className="sub">
                        Estimate #{p.qboEstimateNumber || p.qboEstimateId} · {bankLabel(p.bankDepositedTo)}
                      </div>
                      {p.status === 'rejected' && p.rejectionReason && (
                        <div className="sub">Reason: {p.rejectionReason}</div>
                      )}
                    </td>
                    <td className="num">{peso(p.amountSubmitted)}</td>
                    <td>
                      <span className={`badge badge-${p.status}`}>{STATUS_TEXT[p.status] || p.status}</span>
                      {p.unseen && <span className="badge badge-new">New</span>}
                    </td>
                    <td>
                      <a href={`/api/payments/${p.id}/receipt`} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
