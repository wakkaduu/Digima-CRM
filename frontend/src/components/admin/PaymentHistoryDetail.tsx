import { Link, useLocation } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { usePaymentDetail } from '../../api/payments';
import type { AuditEvent } from '../../api/types';
import { bankLabel, dateTime, dayLabel, peso } from '../../lib/format';
import { Message } from '../Message';
import { Card } from '../ui/Card';
import { DetailSkeleton } from '../ui/Skeletons';
import { ErrorState } from '../ui/States';
import { StatusBadge } from '../ui/StatusBadge';
import { ReceiptViewer } from './ReceiptViewer';

const EVENT_TEXT: Record<AuditEvent['type'], string> = {
  submitted: 'Submitted',
  approved: 'Approved and posted to QuickBooks',
  rejected: 'Rejected',
};

/** Read-only view of a payment that was already reviewed: amounts, receipt, QuickBooks ids and who did what, when. */
export function PaymentHistoryDetail({ id }: { id: string }) {
  const { search } = useLocation();
  const { data: p, error, refetch, isPending } = usePaymentDetail(id);

  return (
    <div>
      <Link to={{ pathname: '/payments/review', search }} className="mb-3 inline-flex min-h-(--control-h) items-center gap-1 text-accent underline lg:hidden">
        <ArrowLeft aria-hidden className="size-4" /> Back to the list
      </Link>

      {isPending && !error && <DetailSkeleton label="Loading payment" breadcrumb={false} cards={2} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {p && (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-title font-semibold">{p.customerName}</h2>
              <p className="text-small text-text-muted">
                Estimate #{p.qboEstimateNumber || p.qboEstimateId} · submitted by {p.submittedBy}
              </p>
              <div className="mt-1.5">
                {p.status === 'pending' ? <StatusBadge status="pending" /> : <StatusBadge status={p.status} />}
              </div>
            </div>
            <p className="text-title font-semibold whitespace-nowrap tabular-nums">{peso(p.amountSubmitted)}</p>
          </div>

          {p.status === 'pending' && (
            <Message type="info" className="mb-0">
              This payment is waiting for review. Open it from the Pending tab.
            </Message>
          )}
          {p.status === 'rejected' && p.rejectionReason && (
            <Message type="warning" className="mb-0">
              Reason: {p.rejectionReason}
            </Message>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,22rem)]">
            <ReceiptViewer src={p.proofImageUrl} thumbSrc={p.thumbUrl} alt={`Receipt from ${p.customerName}`} />

            <div className="space-y-4">
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 [&_dt]:text-text-muted">
                <dt>Paid via</dt>
                <dd>{bankLabel(p.bankDepositedTo)}</dd>
                <dt>Reference no.</dt>
                <dd className="break-all">{p.referenceNo || '—'}</dd>
                <dt>Received on</dt>
                <dd>{p.receivedOn ? dayLabel(p.receivedOn) : '—'}</dd>
                <dt>Received by</dt>
                <dd>{p.receivedBy || '—'}</dd>
                {p.finalAmount && (
                  <>
                    <dt>Amount paid</dt>
                    <dd className="tabular-nums">{peso(p.amountSubmitted)}</dd>
                    <dt>Bank fee</dt>
                    <dd className="tabular-nums">{p.fee ? `− ${peso(p.fee)}` : '—'}</dd>
                    <dt className="font-semibold text-text">Net posted</dt>
                    <dd className="font-semibold tabular-nums">{peso(p.finalAmount)}</dd>
                  </>
                )}
                {p.qbo?.paymentId && (
                  <>
                    <dt>QuickBooks payment</dt>
                    <dd>#{p.qbo.paymentId}</dd>
                  </>
                )}
                {p.qbo?.depositId && (
                  <>
                    <dt>QuickBooks deposit</dt>
                    <dd>#{p.qbo.depositId}</dd>
                  </>
                )}
              </dl>

              <section aria-label="History">
                <h3 className="mb-2 font-semibold">History</h3>
                <ol className="space-y-2 border-l-2 border-border pl-4">
                  {p.events.map((e) => (
                    <li key={e.type} className="relative">
                      <span aria-hidden className="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full border-2 border-surface bg-accent" />
                      <p className="font-semibold">{EVENT_TEXT[e.type]}</p>
                      <p className="text-small text-text-muted">
                        {e.by ? `${e.by} · ` : ''}
                        <time dateTime={e.at}>{dateTime(e.at)}</time>
                      </p>
                      {e.note && <p className="text-small text-text-muted">“{e.note}”</p>}
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
