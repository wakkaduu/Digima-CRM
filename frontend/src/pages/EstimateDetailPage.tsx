import { Link, useParams } from 'react-router';
import { Send } from 'lucide-react';
import { useMe } from '../api/auth';
import { useEstimate } from '../api/crm';
import { ApiError } from '../api/client';
import { EstimateProgress } from '../components/crm/EstimateProgress';
import { InvoiceBalance } from '../components/crm/InvoiceBalance';
import { LinkedPayments } from '../components/crm/LinkedPayments';
import { buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { DetailSkeleton } from '../components/ui/Skeletons';
import { ErrorState } from '../components/ui/States';
import { EstimateStatusBadge } from '../components/ui/StatusBadge';
import { dayLabel, peso } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { estimateNo } from './EstimatesPage';

/** One estimate: facts, payment progress, line items and the payments submitted for it. */
export default function EstimateDetailPage() {
  const { id } = useParams();
  const { data: me } = useMe();
  const { data: e, error, refetch, isPending } = useEstimate(id);
  useDocumentTitle(e ? `Estimate #${estimateNo(e)}` : 'Estimate');

  if (isPending && !error) return <DetailSkeleton label="Loading estimate" cards={3} />;
  if (error || !e) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div>
        <PageHeader title="Estimate" breadcrumb={[{ label: 'Estimates', to: '/estimates' }]} />
        <ErrorState message={notFound ? 'That estimate was not found in QuickBooks.' : (error?.message ?? 'Unknown error')} onRetry={notFound ? undefined : () => refetch()} />
      </div>
    );
  }

  const canRecord = me?.role === 'sales' && e.status !== 'Rejected';

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Estimate #${estimateNo(e)}`}
        breadcrumb={[{ label: 'Estimates', to: '/estimates' }]}
        description={e.customerId ? <Link to={`/customers/${e.customerId}`} className="text-accent underline">{e.customerName}</Link> : e.customerName}
        actions={
          canRecord && (
            <Link to={`/payments/new?estimateId=${e.id}`} className={buttonClass({ variant: 'primary' })}>
              <Send aria-hidden className="size-4" /> Record payment
            </Link>
          )
        }
      />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-body font-semibold">Payment progress</h2>
          <p className="text-title font-semibold tabular-nums">{peso(e.totalAmount)}</p>
        </div>
        <EstimateProgress total={e.totalAmount} approved={e.approvedAmount} pending={e.pendingAmount} />
      </Card>

      <InvoiceBalance estimateId={e.id} approvedAmount={e.approvedAmount} />

      <Card>
        <h2 className="mb-3 text-body font-semibold">Details</h2>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 [&_dt]:text-text-muted">
          <dt>Status</dt>
          <dd>
            <EstimateStatusBadge status={e.status} />
          </dd>
          <dt>Date</dt>
          <dd>{dayLabel(e.txnDate)}</dd>
          {e.expirationDate && (
            <>
              <dt>Expires</dt>
              <dd>{dayLabel(e.expirationDate)}</dd>
            </>
          )}
          {e.email && (
            <>
              <dt>Email</dt>
              <dd className="break-all">{e.email}</dd>
            </>
          )}
          {e.linkedInvoiceIds.length > 0 && (
            <>
              <dt>Invoiced</dt>
              <dd>{e.linkedInvoiceIds.length === 1 ? '1 invoice' : `${e.linkedInvoiceIds.length} invoices`} in QuickBooks</dd>
            </>
          )}
        </dl>
        {e.memo && <p className="mt-3 border-t border-border pt-3 whitespace-pre-line text-text-muted">{e.memo}</p>}
      </Card>

      {e.lines.length > 0 && (
        <Card className="overflow-x-auto" tabIndex={0} aria-label="Items, scrolls sideways when narrow">
          <h2 className="mb-3 text-body font-semibold">Items</h2>
          <table className="w-full border-collapse">
            <caption className="sr-only">Items on estimate {estimateNo(e)}</caption>
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">Description</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Qty</th>
                <th scope="col" className="py-2 pl-3 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {e.lines.map((l, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 align-top">{l.description ?? '—'}</td>
                  <td className="px-3 py-2 text-right align-top tabular-nums">{l.quantity ?? ''}</td>
                  <td className="py-2 pl-3 text-right align-top tabular-nums">{peso(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <section aria-labelledby="est-payments">
        <h2 id="est-payments" className="mb-2 text-body font-semibold">Payments</h2>
        {me && <LinkedPayments filter={{ estimateId: e.id }} role={me.role} showEstimate={false} />}
      </section>
    </div>
  );
}
