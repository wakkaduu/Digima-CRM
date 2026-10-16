import type { PendingPayment } from '../../api/types';
import { bankLabel, peso } from '../../lib/format';
import type { Breakdown } from '../../lib/review';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface Props {
  open: boolean;
  payment: PendingPayment;
  amounts: Breakdown;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** States what will happen in QuickBooks, not a bare "Are you sure?" (D7). */
export function ApproveDialog({ open, payment: p, amounts: a, loading, onConfirm, onCancel }: Props) {
  const gross = a.grossC / 100;
  const net = a.finalC / 100;
  return (
    <ConfirmDialog
      open={open}
      title={`Approve ${p.customerName}?`}
      confirmLabel={`Approve and post ${peso(net)}`}
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <dl className="mb-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums [&_dd]:text-right">
        <dt>Paid by customer</dt>
        <dd>{peso(gross)}</dd>
        <dt>Bank fee ({a.feePercent.toFixed(2)}%)</dt>
        <dd>− {peso(a.feeC / 100)}</dd>
        <dt className="border-t border-border pt-1 font-semibold">Net to {bankLabel(p.bankDepositedTo)}</dt>
        <dd className="border-t border-border pt-1 font-semibold">{peso(net)}</dd>
      </dl>
      <p className="text-text-muted">
        This posts the payment to QuickBooks and closes the invoice for the full {peso(gross)}. It cannot be undone
        from here.
      </p>
      {p.qboPartiallyPosted && (
        <p className="mt-2 text-warning">An earlier approval was only partly posted. This finishes the sync with the same amount.</p>
      )}
    </ConfirmDialog>
  );
}
