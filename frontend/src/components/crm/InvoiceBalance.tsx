import { CheckCircle2 } from 'lucide-react';
import { useInvoiceSummary } from '../../api/crm';
import { Card } from '../ui/Card';
import { dayLabel, peso } from '../../lib/format';

/** What QuickBooks says about the invoice(s) made from an estimate: the balance still owed and whether it is paid in full. */
export function InvoiceBalance({ estimateId, approvedAmount }: { estimateId: string; approvedAmount: number }) {
  const { data, isPending, isError, refetch } = useInvoiceSummary(estimateId);

  return (
    <Card>
      <h2 className="mb-3 text-body font-semibold">QuickBooks invoice</h2>
      {isPending && !isError ? (
        <p className="text-text-muted">Checking QuickBooks…</p>
      ) : isError || !data ? (
        <p className="text-text-muted">
          Could not read the invoice from QuickBooks.{' '}
          <button type="button" onClick={() => refetch()} className="text-accent underline">
            Try again
          </button>
        </p>
      ) : !data.invoices.length ? (
        <p className="text-text-muted">No invoice yet. Create it in QuickBooks from this estimate; payments can be approved once it exists.</p>
      ) : (
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {data.balance <= 0 ? (
              <span className="inline-flex items-center gap-1 font-semibold text-success">
                <CheckCircle2 aria-hidden className="size-4" /> Paid in full
              </span>
            ) : (
              <span className="font-semibold tabular-nums">{peso(data.balance)} still owed</span>
            )}
            <span className="text-text-muted tabular-nums">
              {peso(data.paid)} paid of {peso(data.total)}
            </span>
          </p>
          <ul className="divide-y divide-border">
            {data.invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2 tabular-nums">
                <span>
                  Invoice #{i.docNumber || i.id} <span className="text-text-muted">· {dayLabel(i.txnDate)}</span>
                </span>
                <span>
                  {peso(i.total)} <span className="text-text-muted">· {i.balance > 0 ? `${peso(i.balance)} owed` : 'paid'}</span>
                </span>
              </li>
            ))}
          </ul>
          {Math.abs(data.paid - approvedAmount) >= 0.005 && (
            <p className="text-small text-text-muted">
              QuickBooks shows {peso(data.paid)} paid; the portal has {peso(approvedAmount)} approved. The difference was
              recorded in QuickBooks directly or in another way.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
