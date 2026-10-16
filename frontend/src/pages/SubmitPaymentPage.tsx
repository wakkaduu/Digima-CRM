import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { api, apiUpload, ApiError } from '../api/client';
import { useMe } from '../api/auth';
import { MINE_KEY, RECEIVERS_KEY, useBankConfig, useEstimateProbe, useRecentEstimates } from '../api/payments';
import type { Estimate, Receiver } from '../api/types';
import { EstimatePicker, remainingOf } from '../components/EstimatePicker';
import { Field, TextField } from '../components/Field';
import { Message } from '../components/Message';
import { ReceiptUpload } from '../components/ReceiptUpload';
import { Button, buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select } from '../components/ui/controls';
import { Dialog } from '../components/ui/Dialog';
import { PageHeader } from '../components/ui/PageHeader';
import { RadioCards } from '../components/ui/RadioCards';
import { StickyActionBar } from '../components/ui/StickyActionBar';
import { AMOUNT_RE, cleanAmount, dayLabel, formatAmountInput, peso, todayManila } from '../lib/format';
import { compressImage } from '../lib/image';
import { readJson, removeKey, writeJson } from '../lib/storage';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const MAX_BYTES = 5 * 1024 * 1024;
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type FieldName = 'estimate' | 'receivedOn' | 'amount' | 'bank' | 'refNo' | 'receivedBy' | 'proof';
type Errors = Partial<Record<FieldName, string>>;

interface Draft {
  /** Snapshot of the chosen estimate (there is no whole list to look it up in any more). */
  estimate: Estimate | null;
  receivedOn: string;
  receivedById: string | null;
  amount: string;
  bank: string;
  refNo: string;
}

interface Submitted {
  customerName: string;
  amount: number;
  reference: string;
}

export function SubmitPaymentPage() {
  useDocumentTitle('Submit a payment');
  const qc = useQueryClient();
  const { data: me } = useMe();
  const uid = me?.id ?? 'anon';
  const draftKey = `digima.draft.${uid}`;
  const bankKey = `digima.lastBank.${uid}`;

  const [selected, setSelected] = useState<Estimate | null>(null);
  const [receivedOn, setReceivedOn] = useState(todayManila);
  const [receivedByInput, setReceivedBy] = useState<string | null>(null); // null = untouched
  const [amount, setAmount] = useState('');
  const [bank, setBank] = useState('');
  const [refNo, setRefNo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [optimising, setOptimising] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const successRef = useRef<HTMLHeadingElement>(null);

  // Estimates are searched on the server as the rep types. This probe only tells us whether QuickBooks answers.
  const estimatesQuery = useEstimateProbe();
  const recents = useRecentEstimates(!!me).data ?? [];
  const { banks } = useBankConfig(!!me);
  const bankIds = banks.map((b) => b.id);

  const receiversQuery = useQuery({
    queryKey: RECEIVERS_KEY,
    queryFn: async () => (await api<{ receivers: Receiver[] }>('/api/payments/receivers')).receivers,
  });
  const receivers = receiversQuery.data ?? [];
  // Untouched: default to yourself when you are on the list (sales staff are; admins pick someone).
  const receivedById = receivedByInput ?? (receivers.some((r) => r.id === me?.id) ? me!.id : '');
  const receiverName = receivers.find((r) => r.id === receivedById)?.name;
  const qboDown =
    estimatesQuery.error instanceof ApiError &&
    (estimatesQuery.error.code === 'QBO_NOT_CONNECTED' || estimatesQuery.error.code === 'QBO_REAUTH_REQUIRED');
  const loadError = estimatesQuery.error && !qboDown ? estimatesQuery.error.message : null;

  const savedBank = () => {
    const saved = readJson<string>(bankKey);
    return saved && bankIds.includes(saved) ? saved : '';
  };

  // Object URL for the receipt preview; revoked when the file changes or the page unmounts.
  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Restore a saved draft (text fields only; the receipt must be attached again) once we know who and what.
  useEffect(() => {
    if (draftReady || !me) return;
    const draft = readJson<Draft>(draftKey);
    if (draft && (draft.amount || draft.refNo || draft.estimate)) {
      setSelected(draft.estimate);
      if (draft.receivedOn && draft.receivedOn <= todayManila()) setReceivedOn(draft.receivedOn);
      setReceivedBy(draft.receivedById);
      setAmount(draft.amount);
      setBank(draft.bank);
      setRefNo(draft.refNo);
      setDraftRestored(true);
    } else {
      setBank(savedBank()); // last-used bank saves a tap
    }
    setDraftReady(true);
  }, [draftReady, me, draftKey, bankKey]);

  // Autosave the draft on every change.
  useEffect(() => {
    if (!draftReady || submitted) return;
    const draft: Draft = { estimate: selected, receivedOn, receivedById: receivedByInput, amount, bank, refNo };
    if (draft.estimate || draft.amount || draft.refNo) writeJson(draftKey, draft);
    else removeKey(draftKey);
  }, [draftReady, submitted, draftKey, selected, receivedOn, receivedByInput, amount, bank, refNo]);

  const dirty = !!(selected || amount || refNo || file);
  const submit = useMutation({ mutationFn: (force: boolean) => send(force) });

  // Warn before leaving with unsent work.
  useEffect(() => {
    if (!dirty || submitted) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, submitted]);

  useEffect(() => {
    if (submitted) successRef.current?.focus();
  }, [submitted]);

  const clearError = (k: FieldName) => setErrors((x) => ({ ...x, [k]: undefined }));

  // Cash has no bank reference number. Whether a mode takes one comes from the API's bank list.
  const isCash = banks.find((b) => b.id === bank)?.referenceNumber === 'none';
  const amountRaw = cleanAmount(amount);
  const amountValid = AMOUNT_RE.test(amountRaw) && Number(amountRaw) > 0;
  const amountNumber = Number(amountRaw);
  const overRemaining =
    selected && amountNumber > 0 && remainingOf(selected) > 0 && amountNumber > remainingOf(selected);

  async function onPick(f: File) {
    clearError('proof');
    if (!FILE_TYPES.includes(f.type)) {
      setFile(null);
      return setErrors((x) => ({
        ...x,
        proof: 'This file is not a JPG, PNG or WebP image. Take a screenshot of the receipt and attach that.',
      }));
    }
    setOptimising(true);
    const ready = await compressImage(f);
    setOptimising(false);
    if (ready.size > MAX_BYTES) {
      setFile(null);
      return setErrors((x) => ({ ...x, proof: 'This image is still larger than 5 MB after resizing. Choose a different one.' }));
    }
    setFile(ready);
  }

  function validate(): boolean {
    const found: Errors = {};
    if (!selected) found.estimate = 'Search for the customer or estimate number, then choose one from the list.';
    if (!receivedOn) found.receivedOn = 'Select the date the payment was received.';
    else if (receivedOn > todayManila()) found.receivedOn = 'The date received cannot be in the future.';
    if (!amountValid) found.amount = 'Enter an amount greater than 0, with up to 2 decimals (for example 2500.00).';
    if (!bank) found.bank = 'Select how the payment was received.';
    const ref = refNo.replace(/\s+/g, '');
    if (!isCash && ref && ref.length < 4) {
      found.refNo = 'The reference number must be at least 4 characters, or leave it blank.';
    }
    if (!receivedById) found.receivedBy = 'Select who received the payment.';
    if (!file) found.proof = 'Attach a screenshot or photo of the receipt.';
    setErrors(found);

    const order: [FieldName, string][] = [
      ['estimate', 'estSearch'],
      ['amount', 'amount'],
      ['bank', 'bank'],
      ['refNo', 'refNo'],
      ['proof', 'proof'],
    ];
    const first = order.find(([k]) => found[k]);
    if (first) document.getElementById(first[1])?.focus();
    else if (found.receivedOn || found.receivedBy) setSheetOpen(true); // the defaults row hides these fields
    return !first && !found.receivedOn && !found.receivedBy;
  }

  // One key per distinct payment: a Retry after a lost response reuses it (the server then returns the payment it
  // already saved), but changing anything about the payment starts a new key so edits are never swallowed.
  const keyRef = useRef<{ key: string; fingerprint: string } | null>(null);
  function idempotencyKey() {
    const fingerprint = [selected?.id, amountRaw, bank, refNo.trim(), receivedOn, receivedById, file?.name, file?.size, file?.lastModified].join('|');
    if (keyRef.current?.fingerprint !== fingerprint) keyRef.current = { key: crypto.randomUUID(), fingerprint };
    return keyRef.current.key;
  }

  function send(force: boolean) {
    const fd = new FormData();
    fd.append('estimateId', selected!.id);
    fd.append('receivedOn', receivedOn);
    fd.append('receivedById', receivedById);
    fd.append('amount', amountRaw);
    fd.append('bank', bank);
    if (!isCash && refNo.trim()) fd.append('referenceNo', refNo);
    fd.append('proof', file!);
    if (force) fd.append('force', 'true');
    return apiUpload('/api/payments/submit', fd, { onProgress: setProgress, headers: { 'Idempotency-Key': idempotencyKey() } });
  }

  function resetForm() {
    setSelected(null);
    setReceivedOn(todayManila());
    setReceivedBy(null);
    setAmount('');
    setBank(savedBank());
    setRefNo('');
    setFile(null);
    setErrors({});
    setFailure(null);
    setDuplicate(null);
    setDraftRestored(false);
    removeKey(draftKey);
  }

  async function attempt(force: boolean) {
    setFailure(null);
    setDuplicate(null);
    setProgress(0);
    try {
      await submit.mutateAsync(force);
      setSubmitted({
        customerName: selected!.customerName,
        amount: amountNumber,
        reference: refNo.replace(/\s+/g, '').toUpperCase(),
      });
      writeJson(bankKey, bank);
      removeKey(draftKey);
      keyRef.current = null;
      void qc.invalidateQueries({ queryKey: ['qbo', 'estimates'] });
      void qc.invalidateQueries({ queryKey: ['payments', 'recent-estimates'] });
      void qc.invalidateQueries({ queryKey: MINE_KEY });
    } catch (err) {
      if (!(err instanceof ApiError)) return setFailure('Something went wrong. Your details are kept, so you can try again.');
      if (err.status === 401 || err.code === 'MUST_CHANGE_PASSWORD') return; // route guard redirects
      if (err.code === 'DUPLICATE_PENDING') setDuplicate(err.message);
      else if (err.code === 'DUPLICATE_REFERENCE') {
        setErrors({ refNo: `${err.message} Check that this is a new receipt.` });
        document.getElementById('refNo')?.focus();
      } else setFailure(err.message);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (qboDown || submit.isPending || !validate()) return;
    void attempt(false);
  }

  if (submitted) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-2 py-12 text-center">
        <CheckCircle2 aria-hidden className="size-12 text-success" />
        <h1 ref={successRef} tabIndex={-1} className="text-title font-semibold">
          Submitted
        </h1>
        <p role="status" className="text-text-muted">
          {submitted.customerName}, {peso(submitted.amount)}
          {submitted.reference ? `, reference ${submitted.reference}` : ''}. An admin will review it and post it to QuickBooks.
        </p>
        <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setSubmitted(null);
            }}
          >
            Submit another
          </Button>
          <Link to="/payments" className={buttonClass()}>
            View submission
          </Link>
        </div>
      </div>
    );
  }

  const receivedLabel = `Received ${receivedOn === todayManila() ? 'today' : dayLabel(receivedOn)} by ${
    receivedById === me?.id ? 'you' : (receiverName ?? 'someone, not chosen yet')
  }`;

  return (
    <div>
      <PageHeader title="Submit a payment" description="Attach the receipt and send it for approval." />

      {qboDown && (
        <Message>
          QuickBooks is not connected right now, so estimates cannot be loaded. Please ask an admin to reconnect it.
        </Message>
      )}
      {loadError && <Message>{loadError}</Message>}
      {failure && (
        <Message focus>
          {failure}{' '}
          <Button variant="link" onClick={() => void attempt(false)} disabled={submit.isPending}>
            Retry
          </Button>
        </Message>
      )}
      {duplicate && (
        <Message type="warning" focus>
          {duplicate} Submit it anyway only if this is a different payment.{' '}
          <Button variant="link" onClick={() => void attempt(true)} disabled={submit.isPending}>
            Submit anyway
          </Button>{' '}
          <Button variant="link" onClick={() => setDuplicate(null)}>
            Cancel
          </Button>
        </Message>
      )}
      {draftRestored && (
        <p className="mb-3 text-small text-text-muted" role="status">
          Draft restored. Attach the receipt again.{' '}
          <Button
            variant="link"
            onClick={() => {
              resetForm();
            }}
          >
            Discard
          </Button>
        </p>
      )}

      <form noValidate onSubmit={onSubmit} className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
        <div>
          <Card className="mb-4">
            <EstimatePicker
              selected={selected}
              error={errors.estimate}
              recents={recents}
              disabled={qboDown || estimatesQuery.isPending}
              onSelect={(e) => {
                setSelected(e);
                clearError('estimate');
                if (e) setTimeout(() => document.getElementById('amount')?.focus());
              }}
            />

            <Field
              id="amount"
              label="Amount received (PHP)"
              hint={
                amountValid ? (
                  <>
                    <strong className="tabular-nums text-text">{peso(amountNumber)}</strong> · before any bank fee
                  </>
                ) : (
                  'The full amount the client paid, before any bank fee.'
                )
              }
              error={errors.amount}
            >
              {(aria) => (
                <Input
                  id="amount"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  className="scroll-mb-32"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    clearError('amount');
                  }}
                  onBlur={() => setAmount(formatAmountInput(amount))}
                  {...aria}
                />
              )}
            </Field>
            {overRemaining && selected && (
              <Message type="warning">
                This is more than the estimated remaining balance ({peso(remainingOf(selected))}). Check the amount before you
                submit.
              </Message>
            )}

            <RadioCards
              name="bank"
              legend="Paid via"
              options={bankIds}
              wide={['Cash']}
              value={bank}
              firstId="bank"
              error={errors.bank}
              onChange={(v) => {
                setBank(v);
                clearError('bank');
                clearError('refNo');
              }}
            />

            {!isCash && (
              <TextField
                id="refNo"
                label="Bank reference number (optional)"
                autoComplete="off"
                hint="The transaction or reference number printed on the receipt. When given, it is used to catch duplicate submissions."
                value={refNo}
                error={errors.refNo}
                onChange={(e) => {
                  setRefNo(e.target.value);
                  clearError('refNo');
                }}
              />
            )}

            <ReceiptUpload
              file={file}
              previewUrl={previewUrl}
              optimising={optimising}
              error={errors.proof}
              onPick={(f) => void onPick(f)}
              onRemove={() => setFile(null)}
            />

            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <p className="min-w-0">{receivedLabel}</p>
              <Button size="sm" aria-haspopup="dialog" onClick={() => setSheetOpen(true)} className="shrink-0">
                Change
              </Button>
            </div>
            {(errors.receivedOn || errors.receivedBy) && (
              <p className="mt-1 text-small font-semibold text-danger">{errors.receivedBy ?? errors.receivedOn}</p>
            )}
          </Card>

          <StickyActionBar>
            <Button type="submit" variant="primary" block disabled={qboDown} loading={submit.isPending} loadingLabel={progress < 100 ? `Uploading ${progress}%…` : 'Submitting…'} size="lg">
              Submit for approval
            </Button>
            <p className="mt-1 hidden text-small text-text-muted lg:block">
              An admin will check the receipt and post the payment to QuickBooks.
            </p>
          </StickyActionBar>
        </div>

        <aside aria-label="Summary" className="hidden lg:sticky lg:top-6 lg:block">
          <Card>
            <h2 className="mb-3 text-[1.0625rem] font-semibold">Summary</h2>
            {selected ? (
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 tabular-nums [&_dt]:text-text-muted [&_dd]:text-right">
                <dt>Customer</dt>
                <dd>{selected.customerName}</dd>
                <dt>Estimate</dt>
                <dd>#{selected.docNumber || selected.id}</dd>
                <dt>Estimate total</dt>
                <dd>{peso(selected.totalAmount)}</dd>
                <dt>Remaining</dt>
                <dd>{peso(remainingOf(selected))}</dd>
                <dt className="font-semibold text-text">This payment</dt>
                <dd className="font-semibold">{amountValid ? peso(amountNumber) : '—'}</dd>
              </dl>
            ) : (
              <p className="text-text-muted">Choose an estimate to see its balance.</p>
            )}
            {previewUrl && (
              <img src={previewUrl} alt="" className="mt-3 block max-h-40 rounded-control border border-border" />
            )}
          </Card>
        </aside>
      </form>

      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Received on and by"
        footer={
          <Button variant="primary" onClick={() => setSheetOpen(false)}>
            Done
          </Button>
        }
      >
        <Field
          id="receivedOn"
          label="Date the payment was received"
          hint="Pick the day the money was actually received."
          error={errors.receivedOn}
        >
          {(aria) => (
            <Input
              id="receivedOn"
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
        <Field
          id="receivedBy"
          label="Who received this payment?"
          hint="Sales employees only. Change it if someone else took the money."
          error={errors.receivedBy ?? (receiversQuery.error ? receiversQuery.error.message : null)}
        >
          {(aria) => (
            <Select
              id="receivedBy"
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
            </Select>
          )}
        </Field>
      </Dialog>
    </div>
  );
}
