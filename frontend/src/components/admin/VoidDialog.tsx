import { useState } from 'react';
import type { PaymentDetail } from '../../api/types';
import { peso } from '../../lib/format';
import { Field } from '../Field';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/controls';
import { Dialog } from '../ui/Dialog';

const MIN = 3;
const MAX = 300;

interface Props {
  open: boolean;
  payment: PaymentDetail;
  loading: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** Reversing posts to QuickBooks, so say what it does and require a reason for the record. */
export function VoidDialog({ open, payment: p, loading, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = reason.trim();
    if (trimmed.length < MIN) {
      setError(`Give a reason of at least ${MIN} characters. It stays in the payment's history.`);
      document.getElementById('void-reason')?.focus();
      return;
    }
    onConfirm(trimmed);
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={`Void ${p.customerName}'s payment?`}
      footer={
        <>
          <Button onClick={onCancel} disabled={loading}>
            Keep payment
          </Button>
          <Button variant="danger" onClick={submit} loading={loading}>
            Void payment
          </Button>
        </>
      }
    >
      <p className="mb-3">
        This reverses the {peso(p.amountSubmitted)} payment in QuickBooks
        {p.qbo?.depositId ? ' (the deposit is deleted and the payment is voided)' : ' (the payment is voided)'}. The invoice
        balance goes back up and the estimate no longer counts this payment. Voiding cannot be undone from here.
      </p>
      <Field id="void-reason" label="Reason for voiding" hint={`Kept in the history. ${reason.length}/${MAX}`} error={error}>
        {(aria) => (
          <Textarea
            id="void-reason"
            value={reason}
            maxLength={MAX}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
            {...aria}
          />
        )}
      </Field>
    </Dialog>
  );
}
