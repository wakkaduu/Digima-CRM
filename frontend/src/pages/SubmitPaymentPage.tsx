import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { Estimate, Receiver } from '../api/types';
import { EstimatePicker, remainingOf } from '../components/EstimatePicker';
import { Field, TextField } from '../components/Field';
import { Message } from '../components/Message';
import { MINE_KEY, MySubmissions } from '../components/MySubmissions';
import { useMe } from '../api/auth';
import { AMOUNT_RE, cleanAmount, peso, todayManila } from '../lib/format';

const MAX_BYTES = 5 * 1024 * 1024;
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BANKS = ['BDO', 'UnionBank', 'Digima', 'Happy Meal', 'Cash'];
const ESTIMATES_KEY = ['qbo', 'estimates'] as const;
const RECEIVERS_KEY = ['payments', 'receivers'] as const;

type FieldName = 'estimate' | 'receivedOn' | 'amount' | 'bank' | 'refNo' | 'receivedBy' | 'proof';
type Errors = Partial<Record<FieldName, string>>;
type Result = { type: 'ok' | 'error'; text: string } | null;

export function SubmitPaymentPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<Estimate | null>(null);
  const { data: me } = useMe();
  const [receivedOn, setReceivedOn] = useState(todayManila);
  const [receivedByInput, setReceivedBy] = useState<string | null>(null); // null = untouched

  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState('');
  const [refNo, setRefNo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<Result>(null);

  const estimatesQuery = useQuery({
    queryKey: ESTIMATES_KEY,
    queryFn: async () => (await api<{ estimates: Estimate[] }>('/api/qbo/estimates')).estimates,
  });
  const estimates = estimatesQuery.data ?? [];

  const receiversQuery = useQuery({
    queryKey: RECEIVERS_KEY,
    queryFn: async () => (await api<{ receivers: Receiver[] }>('/api/payments/receivers')).receivers,
  });
  const receivers = receiversQuery.data ?? [];
  // Untouched: default to yourself when you are on the list (sales staff are; admins pick someone).
  const receivedById = receivedByInput ?? (receivers.some((r) => r.id === me?.id) ? me!.id : '');
  const qboDown =
    estimatesQuery.error instanceof ApiError &&
    (estimatesQuery.error.code === 'QBO_NOT_CONNECTED' || estimatesQuery.error.code === 'QBO_REAUTH_REQUIRED');
  const loadError = estimatesQuery.error && !qboDown ? estimatesQuery.error.message : null;

  // Object URL for the receipt preview; revoked when the file changes or the page unmounts.
  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const clearError = (k: FieldName) => setErrors((x) => ({ ...x, [k]: undefined }));

  const isCash = bank === 'Cash'; // cash has no bank reference number
  const amountNumber = Number(cleanAmount(amount));
  const overRemaining =
    selected && amountNumber > 0 && remainingOf(selected) > 0 && amountNumber > remainingOf(selected);

  function onFile(f: File | null) {
    clearError('proof');
    if (!f) return setFile(null);
    const reset = (msg: string) => {
      if (fileRef.current) fileRef.current.value = '';
      setFile(null);
      setErrors((x) => ({ ...x, proof: msg }));
    };
    if (!FILE_TYPES.includes(f.type)) {
      return reset('This file is not a JPG, PNG or WebP image. Take a screenshot of the receipt and attach that.');
    }
    if (f.size > MAX_BYTES) return reset('This image is larger than 5 MB. Choose a smaller screenshot.');
    setFile(f);
  }

  function validate(): boolean {
    const found: Errors = {};
    if (!selected) found.estimate = 'Search for the customer or estimate number, then choose one from the list.';
    if (!receivedOn) found.receivedOn = 'Select the date the payment was received.';
    else if (receivedOn > todayManila()) found.receivedOn = 'The date received cannot be in the future.';
    const amt = cleanAmount(amount);
    if (!AMOUNT_RE.test(amt) || Number(amt) <= 0) {
      found.amount = 'Enter an amount greater than 0, with up to 2 decimals (for example 2500.00).';
    }
    if (!bank) found.bank = 'Select the mode of payment.';
    const ref = refNo.replace(/\s+/g, '');
    if (!isCash && ref && ref.length < 4) {
      found.refNo = 'The reference number must be at least 4 characters, or leave it blank.';
    }
    if (!receivedById) found.receivedBy = 'Select who received the payment.';
    if (!file) found.proof = 'Attach a screenshot of the receipt.';
    setErrors(found);

    const order: [FieldName, string][] = [
      ['estimate', 'estSearch'],
      ['receivedOn', 'receivedOn'],
      ['amount', 'amount'],
      ['bank', 'bank'],
      ['refNo', 'refNo'],
      ['receivedBy', 'receivedBy'],
      ['proof', 'proof'],
    ];
    const first = order.find(([k]) => found[k]);
    if (first) document.getElementById(first[1])?.focus();
    return !first;
  }

  const send = (force: boolean) => {
    const fd = new FormData();
    fd.append('estimateId', selected!.id);
    fd.append('receivedOn', receivedOn);
    fd.append('receivedById', receivedById);
    fd.append('amount', cleanAmount(amount));
    fd.append('bank', bank);
    if (!isCash && refNo.trim()) fd.append('referenceNo', refNo);
    fd.append('proof', file!);
    if (force) fd.append('force', 'true');
    return api('/api/payments/submit', { method: 'POST', body: fd });
  };

  const submit = useMutation({
    mutationFn: async () => {
      try {
        await send(false);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'DUPLICATE_PENDING' && confirm(`${err.message}\n\nSubmit anyway?`)) {
          await send(true);
        } else throw err;
      }
    },
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setResult(null);
    if (qboDown || !validate()) return;

    const summary = `Submitted: ${selected!.customerName}, ${peso(amountNumber)}, reference ${refNo
      .replace(/\s+/g, '')
      .toUpperCase()}. An admin will review it. You can submit another payment below.`;

    try {
      await submit.mutateAsync();
      setSelected(null);
      setReceivedOn(todayManila());
      setReceivedBy(null);
      setAmount('');
      setBank('');
      setRefNo('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setResult({ type: 'ok', text: summary });
      void qc.invalidateQueries({ queryKey: ESTIMATES_KEY });
      void qc.invalidateQueries({ queryKey: MINE_KEY });
    } catch (err) {
      if (!(err instanceof ApiError)) return setResult({ type: 'error', text: 'Something went wrong.' });
      if (err.status === 401 || err.code === 'MUST_CHANGE_PASSWORD') return; // route guard redirects
      if (err.code === 'DUPLICATE_REFERENCE') {
        setErrors({ refNo: `${err.message} Check that this is a new receipt.` });
        document.getElementById('refNo')?.focus();
      } else {
        setResult({ type: 'error', text: err.message });
      }
    }
  }

  return (
    <main className="page">
      <h1>Submit a payment</h1>

      {qboDown && (
        <Message>
          QuickBooks is not connected right now, so estimates cannot be loaded. Please ask an admin to reconnect it.
        </Message>
      )}
      {loadError && <Message>{loadError}</Message>}
      {result && (
        <Message type={result.type} focus>
          {result.text}
        </Message>
      )}

      <form className="panel" noValidate onSubmit={onSubmit}>
        <p className="hint" style={{ marginTop: 0 }}>
          All fields are required except the reference number.
        </p>

        <fieldset className="section">
          <legend>1. Estimate</legend>
          <EstimatePicker
            estimates={estimates}
            selected={selected}
            error={errors.estimate}
            disabled={qboDown || estimatesQuery.isPending}
            onSelect={(e) => {
              setSelected(e);
              clearError('estimate');
              if (e) setTimeout(() => document.getElementById('amount')?.focus());
            }}
          />
          {estimatesQuery.isPending && <p className="hint">Loading estimates…</p>}
        </fieldset>

        <fieldset className="section">
          <legend>2. Date received</legend>
          <Field
            id="receivedOn"
            label="Date the payment was received"
            hint="Pick the day the money was actually received."
            error={errors.receivedOn}
          >
            {(aria) => (
              <input
                id="receivedOn"
                className="input"
                type="date"
                max={todayManila()}
                value={receivedOn}
                onChange={(e) => {
                  setReceivedOn(e.target.value);
                  clearError('receivedOn');
                }}
                {...aria}
              />
            )}
          </Field>
        </fieldset>

        <fieldset className="section">
          <legend>3. Payment details</legend>
          <Field
            id="amount"
            label="Amount received (PHP)"
            hint="The full amount the client paid, before any bank fee."
            error={errors.amount}
          >
            {(aria) => (
              <input
                id="amount"
                className="input"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  clearError('amount');
                }}
                onBlur={() => {
                  const raw = cleanAmount(amount);
                  if (AMOUNT_RE.test(raw) && Number(raw) > 0) setAmount(Number(raw).toFixed(2));
                }}
                {...aria}
              />
            )}
          </Field>
          {overRemaining && selected && (
            <div className="msg msg-info" role="status" style={{ marginTop: 8 }}>
              This is more than the estimated remaining balance ({peso(remainingOf(selected))}). Check the amount
              before you submit.
            </div>
          )}

          <Field id="bank" label="Mode of payment (bank received, or cash)" error={errors.bank}>
            {(aria) => (
              <select
                id="bank"
                className="input"
                value={bank}
                onChange={(e) => {
                  setBank(e.target.value);
                  clearError('bank');
                  clearError('refNo');
                }}
                {...aria}
              >
                <option value="">Select a bank</option>
                {BANKS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            )}
          </Field>

          {!isCash && (
            <TextField
              id="refNo"
              label="Bank reference number (optional)"
              autoComplete="off"
              hint="The transaction or reference number printed on the receipt, if there is one. When given, it is used to catch duplicate submissions."
              value={refNo}
              error={errors.refNo}
              onChange={(e) => {
                setRefNo(e.target.value);
                clearError('refNo');
              }}
            />
          )}
        </fieldset>

        <fieldset className="section">
          <legend>4. Received by</legend>
          <Field
            id="receivedBy"
            label="Who received this payment?"
            hint="Sales employees only. Change it if someone else took the money."
            error={errors.receivedBy ?? (receiversQuery.error ? receiversQuery.error.message : null)}
          >
            {(aria) => (
              <select
                id="receivedBy"
                className="input"
                value={receivedById}
                disabled={receiversQuery.isPending}
                onChange={(e) => {
                  setReceivedBy(e.target.value);
                  clearError('receivedBy');
                }}
                {...aria}
              >
                <option value="">{receiversQuery.isPending ? 'Loading…' : 'Select an employee'}</option>
                {receivers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </fieldset>

        <fieldset className="section">
          <legend>5. Receipt</legend>
          <Field id="proof" label="Receipt screenshot" hint="JPG, PNG or WebP, up to 5 MB." error={errors.proof}>
            {(aria) => (
              <input
                id="proof"
                ref={fileRef}
                className="input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                {...aria}
              />
            )}
          </Field>
          {file && (
            <p className="hint">
              {file.name} · {Math.max(1, Math.round(file.size / 1024))} KB
            </p>
          )}
          {previewUrl && <img className="preview" src={previewUrl} alt="Preview of the selected receipt" />}
        </fieldset>

        <button className="btn btn-primary btn-block" disabled={qboDown || submit.isPending}>
          {submit.isPending ? 'Submitting…' : 'Submit for approval'}
        </button>
        <p className="hint">An admin will check the receipt and post the payment to QuickBooks.</p>
      </form>

      <MySubmissions />
    </main>
  );
}
