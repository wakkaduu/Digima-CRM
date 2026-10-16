import { useState } from 'react';
import type { PendingPayment } from '../../api/types';
import { Field } from '../Field';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/controls';
import { Dialog } from '../ui/Dialog';

const QUICK_REASONS = ['Receipt is unclear', 'Amount does not match', 'Duplicate payment', 'Wrong customer or estimate'];
const MIN = 3;
const MAX = 300;

interface Props {
  open: boolean;
  payment: PendingPayment;
  loading: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** The reason is shown to the sales rep, so it is required and validated inline. */
export function RejectDialog({ open, payment: p, loading, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = reason.trim();
    if (trimmed.length < MIN) {
      setError(`Give a reason of at least ${MIN} characters. The sales rep will read it.`);
      document.getElementById('reject-reason')?.focus();
      return;
    }
    onConfirm(trimmed);
  }

  function pick(text: string) {
    setError(null);
    setReason((r) => {
      const next = r.trim() ? `${r.trim().replace(/[.;]$/, '')}; ${text}` : text;
      return next.slice(0, MAX);
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={`Reject ${p.customerName}?`}
      footer={
        <>
          <Button onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={loading}>
            Reject payment
          </Button>
        </>
      }
    >
      <fieldset className="mb-3 min-w-0 border-0 p-0">
        <legend className="mb-1 text-small text-text-muted">Quick reasons</legend>
        <div className="flex flex-wrap gap-2">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => pick(r)}
              className="min-h-(--control-h) rounded-badge border border-border-strong bg-surface px-3 text-small hover:bg-surface-sunk"
            >
              {r}
            </button>
          ))}
        </div>
      </fieldset>
      <Field
        id="reject-reason"
        label="Reason for rejecting"
        hint={`Visible to the sales rep. ${reason.length}/${MAX}`}
        error={error}
      >
        {(aria) => (
          <Textarea
            id="reject-reason"
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
