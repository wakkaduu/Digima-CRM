import { useEffect, useState, type RefObject } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X } from 'lucide-react';
import { api, ApiError } from '../../api/client';
import { PAYMENTS_KEY, useBankConfig } from '../../api/payments';
import { QBO_REAUTH_KEY } from '../../api/qbo';
import type { ApproveResult, PendingPayment } from '../../api/types';
import { bankLabel, dayLabel, peso, when } from '../../lib/format';
import { breakdown, netAfterFee, waiting } from '../../lib/review';
import { cn } from '../../lib/cn';
import { Field } from '../Field';
import { Message } from '../Message';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/controls';
import { StickyActionBar } from '../ui/StickyActionBar';
import { StatusBadge } from '../ui/StatusBadge';
import { useToast } from '../ui/Toast';
import { ApproveDialog } from './ApproveDialog';
import { ReceiptViewer } from './ReceiptViewer';
import { RejectDialog } from './RejectDialog';

/** What the page's keyboard shortcuts can ask the open review to do. */
export interface ReviewActions {
  approve: () => void;
  reject: () => void;
}

interface Props {
  payment: PendingPayment;
  /** Called after a successful decision, so the page can move to the next payment. */
  onDecided: (id: string) => void;
  actionsRef: RefObject<ReviewActions | null>;
}

const estimateOf = (p: PendingPayment) => p.qboEstimateNumber || p.qboEstimateId;

/** One pending payment: receipt beside the decision (amount, fee, approve / reject). */
export function PaymentReview({ payment: p, onDecided, actionsRef }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { search } = useLocation();
  const toast = useToast();
  const feePercent = useBankConfig().defaultFeePercent;

  const [finalAmount, setFinalAmount] = useState(
    p.qboPartiallyPosted && p.finalAmount ? Number(p.finalAmount).toFixed(2) : Number(p.amountSubmitted).toFixed(2),
  );
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const amounts = breakdown(p.amountSubmitted, finalAmount);
  const wait = waiting(p.createdAt);

  const afterDecision = () => {
    setDialog(null);
    // Refetch even after errors: picks up any partial-sync state.
    void qc.invalidateQueries({ queryKey: PAYMENTS_KEY }); // queue, history and the nav badge
  };

  const approve = useMutation({
    mutationFn: () => api<ApproveResult>(`/api/payments/approve/${p.id}`, { method: 'POST', json: { finalAmount } }),
    onSuccess: ({ qbo }) => {
      let text = `Approved ${p.customerName} and posted to QuickBooks (payment #${qbo.paymentId}${qbo.depositId ? `, deposit #${qbo.depositId}` : ''}).`;
      if (qbo.unappliedCredit > 0) {
        text += ` ${peso(qbo.unappliedCredit)} was more than the invoice balance and stays as unapplied credit in QuickBooks.`;
      }
      toast({ text });
      afterDecision();
      onDecided(p.id);
    },
    onError: (err) => {
      afterDecision();
      if (err instanceof ApiError && (err.status === 401 || err.status === 403) && err.code !== 'QBO_REAUTH_REQUIRED') return; // route guard
      if (err instanceof ApiError && err.code === 'QBO_REAUTH_REQUIRED') {
        qc.setQueryData(QBO_REAUTH_KEY, true);
        toast({
          type: 'error',
          text: 'The QuickBooks connection expired. Reconnect it, then approve again.',
          action: { label: 'Reconnect', onClick: () => navigate('/setup') },
        });
      } else {
        toast({ type: 'error', text: err.message });
      }
    },
  });

  const reject = useMutation({
    mutationFn: (reason: string) =>
      api<{ ok: true; undoUntil?: string }>(`/api/payments/reject/${p.id}`, { method: 'POST', json: { reason } }),
    onSuccess: ({ undoUntil }) => {
      // The server allows a short undo window. Offer it for exactly that long.
      const left = undoUntil ? Date.parse(undoUntil) - Date.now() : 0;
      toast({
        text: `Rejected ${p.customerName}. The sales rep can see your reason.`,
        ...(left > 2000 ? { durationMs: left - 1000, action: { label: 'Undo', onClick: () => void undoReject() } } : {}),
      });
      afterDecision();
      onDecided(p.id);
    },
    onError: (err) => {
      afterDecision();
      toast({ type: 'error', text: err.message });
    },
  });

  // A plain call (not a mutation hook): the review pane is usually gone by the time Undo is tapped.
  async function undoReject() {
    try {
      await api(`/api/payments/reject/${p.id}/undo`, { method: 'POST' });
      void qc.invalidateQueries({ queryKey: PAYMENTS_KEY });
      toast({ text: `Restored ${p.customerName} to the queue.` });
      navigate({ pathname: `/admin/${p.id}`, search });
    } catch (err) {
      toast({ type: 'error', text: err instanceof ApiError ? err.message : 'Could not undo the rejection.' });
    }
  }

  const busy = approve.isPending || reject.isPending;

  function startApprove() {
    if (busy) return;
    if (!amounts.ok) return void document.getElementById('final-amount')?.focus();
    setDialog('approve');
  }
  function startReject() {
    if (!busy) setDialog('reject');
  }

  // The page's keyboard shortcuts call the latest handlers through this ref.
  useEffect(() => {
    actionsRef.current = { approve: startApprove, reject: startReject };
    return () => {
      actionsRef.current = null;
    };
  });

  const amountMessage = amounts.invalid
    ? 'Enter a valid amount.'
    : amounts.tooHigh
      ? 'The final amount cannot be more than the amount paid.'
      : null;
  const feeLine = amounts.ok
    ? `Bank fee ${peso(amounts.feeC / 100)} (${amounts.feePercent.toFixed(2)}%). The invoice is closed for the full ${peso(amounts.grossC / 100)}.`
    : null;

  return (
    <div>
      <Link to={{ pathname: '/admin', search }} className="mb-3 inline-flex min-h-(--control-h) items-center gap-1 text-accent underline lg:hidden">
        <ArrowLeft aria-hidden className="size-4" /> Back to queue
      </Link>

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-title font-semibold">{p.customerName}</h2>
            <p className="text-small text-text-muted">
              Estimate #{estimateOf(p)} · submitted by {p.submittedBy} · {when(p.createdAt)}
            </p>
            <p className={cn('mt-0.5 text-small', wait.stale ? 'font-semibold text-warning' : 'text-text-muted')}>{wait.text}</p>
          </div>
          <p className="text-title font-semibold whitespace-nowrap tabular-nums">{peso(p.amountSubmitted)}</p>
        </div>

        {p.qboPartiallyPosted && (
          <Message type="warning" className="mb-0">
            An earlier approval was only partly posted to QuickBooks. Approving again finishes the sync with the same
            amount, so the final amount is locked.
          </Message>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,22rem)]">
          <ReceiptViewer src={p.proofImageUrl} thumbSrc={p.thumbUrl} alt={`Receipt from ${p.customerName}`} />

          <div className="space-y-4">
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 [&_dt]:text-text-muted">
              <dt>Deposited to</dt>
              <dd>{bankLabel(p.bankDepositedTo)}</dd>
              <dt>Reference no.</dt>
              <dd className="break-all">{p.referenceNo || '—'}</dd>
              <dt>Received on</dt>
              <dd>{p.receivedOn ? dayLabel(p.receivedOn) : '—'}</dd>
              <dt>Received by</dt>
              <dd>{p.receivedBy || '—'}</dd>
              <dt>Status</dt>
              <dd>{p.qboPartiallyPosted ? <StatusBadge status="partial" /> : <StatusBadge status="pending" />}</dd>
            </dl>

            <Field
              id="final-amount"
              label="Final amount (net deposit after bank fee)"
              hint={feeLine}
              error={amountMessage}
            >
              {(aria) => (
                <div className="flex gap-2">
                  <Input
                    id="final-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    value={finalAmount}
                    readOnly={p.qboPartiallyPosted}
                    onChange={(e) => setFinalAmount(e.target.value)}
                    {...aria}
                  />
                  <Button
                    disabled={p.qboPartiallyPosted}
                    onClick={() => setFinalAmount(netAfterFee(p.amountSubmitted, feePercent))}
                    className="shrink-0"
                  >
                    − {feePercent}% fee
                  </Button>
                </div>
              )}
            </Field>
            {!p.qboPartiallyPosted && finalAmount !== Number(p.amountSubmitted).toFixed(2) && (
              <Button variant="link" onClick={() => setFinalAmount(Number(p.amountSubmitted).toFixed(2))}>
                Use the full amount
              </Button>
            )}

            <StickyActionBar>
              <div className="flex gap-2">
                <Button variant="danger" onClick={startReject} disabled={busy} className="shrink-0">
                  <X aria-hidden className="size-4" /> Reject
                </Button>
                <Button variant="primary" block onClick={startApprove} disabled={busy} loading={approve.isPending}>
                  <Check aria-hidden className="size-4" />
                  {amounts.ok ? `Approve ${peso(amounts.finalC / 100)}` : 'Approve'}
                </Button>
              </div>
            </StickyActionBar>
          </div>
        </div>
      </Card>

      <ApproveDialog
        open={dialog === 'approve'}
        payment={p}
        amounts={amounts}
        loading={approve.isPending}
        onConfirm={() => approve.mutate()}
        onCancel={() => setDialog(null)}
      />
      <RejectDialog
        key={p.id}
        open={dialog === 'reject'}
        payment={p}
        loading={reject.isPending}
        onConfirm={(reason) => reject.mutate(reason)}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
