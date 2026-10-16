import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { ApproveResult, PendingPayment } from '../api/types';
import { bankLabel, cents, dayLabel, peso } from '../lib/format';

interface Props {
  payment: PendingPayment;
  onDone: (message: string, type: 'success' | 'error') => void;
}

/** One pending payment: receipt, details, final (net) amount and approve / reject. */
export function PendingCard({ payment: p, onDone }: Props) {
  const gross = cents(p.amountSubmitted);
  const [finalAmount, setFinalAmount] = useState(
    p.qboPartiallyPosted && p.finalAmount ? Number(p.finalAmount).toFixed(2) : Number(p.amountSubmitted).toFixed(2),
  );

  const finalC = cents(finalAmount);
  const invalid = !Number.isFinite(finalC) || finalC <= 0;
  const tooHigh = finalC > gross;

  const approve = useMutation({
    mutationFn: () =>
      api<ApproveResult>(`/api/payments/approve/${p.id}`, { method: 'POST', json: { finalAmount } }),
    onSuccess: ({ qbo }) => {
      let msg = `Approved and posted to QuickBooks (payment #${qbo.paymentId}${qbo.depositId ? `, deposit #${qbo.depositId}` : ''}).`;
      if (qbo.unappliedCredit > 0) {
        msg += ` Note: ${peso(qbo.unappliedCredit)} was more than the invoice balance and remains as unapplied credit in QBO.`;
      }
      onDone(msg, 'success');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401 && err.code === 'QBO_REAUTH_REQUIRED') {
        onDone('QuickBooks connection expired. Reconnect it on the QuickBooks setup page.', 'error');
      } else if (!(err instanceof ApiError && (err.status === 401 || err.status === 403))) {
        onDone(err.message, 'error'); // 401/403 are handled by the route guard
      }
    },
  });

  const reject = useMutation({
    mutationFn: (reason: string) => api(`/api/payments/reject/${p.id}`, { method: 'POST', json: { reason } }),
    onSuccess: () => onDone('Payment rejected.', 'success'),
    onError: (err) => onDone(err.message, 'error'),
  });

  const busy = approve.isPending || reject.isPending;

  function onApprove() {
    if (invalid || tooHigh) return onDone('Check the final amount first.', 'error');
    const fee = (gross - finalC) / 100;
    const ok = confirm(
      `Approve ${p.customerName}?\n\nPaid: ${peso(gross / 100)}\nFee: ${peso(fee)}\nNet to ${bankLabel(p.bankDepositedTo)}: ${peso(finalC / 100)}`,
    );
    if (ok) approve.mutate();
  }

  function onReject() {
    const reason = prompt('Reason for rejecting (the sales rep will see this):');
    if (reason === null) return;
    if (reason.trim().length < 3) return onDone('Please give a reason (at least 3 characters).', 'error');
    reject.mutate(reason);
  }

  const fee = gross - finalC;

  return (
    <article className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">{p.customerName}</div>
          <div className="text-xs text-slate-500">
            Estimate #{p.qboEstimateNumber || p.qboEstimateId} · submitted by {p.submittedBy} ·{' '}
            {new Date(p.createdAt).toLocaleString()}
          </div>
        </div>
        <div className="text-lg font-semibold whitespace-nowrap">{peso(p.amountSubmitted)}</div>
      </div>

      <div className="flex gap-3">
        <a href={p.proofImageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <img src={p.proofImageUrl} alt="Receipt" loading="lazy" className="w-28 h-36 object-cover rounded border" />
        </a>
        <div className="text-sm space-y-1">
          <div>Deposited to: {bankLabel(p.bankDepositedTo)}</div>
          <div>Reference no.: {p.referenceNo || '—'}</div>
          <div>Received on: {p.receivedOn ? dayLabel(p.receivedOn) : '—'}</div>
          <div>Received by: {p.receivedBy || '—'}</div>
          <div className="text-xs text-slate-500">Tap the receipt to open it full size.</div>
        </div>
      </div>

      {p.qboPartiallyPosted && (
        <div className="rounded bg-amber-50 text-amber-800 text-sm px-3 py-2">
          An earlier approval was only partly posted to QuickBooks. Approving again finishes the sync using the same
          amount.
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor={`final-${p.id}`} className="block text-sm font-medium">
          Final amount (net deposit after bank fees)
        </label>
        <div className="flex gap-2">
          <input
            id={`final-${p.id}`}
            className="flex-1 border rounded px-3 py-2"
            inputMode="decimal"
            value={finalAmount}
            readOnly={p.qboPartiallyPosted}
            aria-describedby={`fee-${p.id}`}
            onChange={(e) => setFinalAmount(e.target.value)}
          />
          <button
            type="button"
            className="border rounded px-3 py-2 text-sm hover:bg-slate-100"
            disabled={p.qboPartiallyPosted}
            onClick={() => setFinalAmount(((gross - Math.round(gross * 0.015)) / 100).toFixed(2))}
          >
            − 1.5% fee
          </button>
        </div>
        <div id={`fee-${p.id}`} className={`text-xs ${invalid || tooHigh ? 'text-red-600' : 'text-slate-500'}`}>
          {invalid
            ? 'Enter a valid amount'
            : tooHigh
              ? 'Final amount cannot exceed the amount submitted'
              : `Bank fee: ${peso(fee / 100)} (${((fee / gross) * 100).toFixed(2)}%). Invoice is closed for the full ${peso(gross / 100)}.`}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          className="flex-1 bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50"
          disabled={busy}
          onClick={onApprove}
        >
          {approve.isPending ? 'Posting…' : 'Approve & post to QuickBooks'}
        </button>
        <button
          type="button"
          className="border border-red-300 text-red-700 rounded px-4 py-2 disabled:opacity-50"
          disabled={busy}
          onClick={onReject}
        >
          Reject
        </button>
      </div>
    </article>
  );
}
