import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError } from '../api/client';
import { homePath, useMe } from '../api/auth';
import { Message } from '../components/Message';
import { TextField } from '../components/Field';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Checkbox } from '../components/ui/controls';
import { PageHeader } from '../components/ui/PageHeader';
import { useDocumentTitle } from '../lib/useDocumentTitle';

type Errors = Partial<Record<'current' | 'next' | 'confirm', string>>;
const MIN_PASSWORD = 10;

/** Change your own password (accounts that sign in with email). */
export function PasswordPage() {
  useDocumentTitle('Change password');
  const { data: me } = useMe();
  const navigate = useNavigate();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => document.getElementById('current')?.focus(), []);

  const clear = (k: keyof Errors) => setErrors((x) => ({ ...x, [k]: undefined }));
  const type = showPw ? 'text' : 'password';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    const found: Errors = {};
    if (!current) found.current = 'Enter your current password.';
    if (next.length < MIN_PASSWORD) found.next = `The new password must be at least ${MIN_PASSWORD} characters.`;
    else if (next === current) found.next = 'Choose a password that is different from the current one.';
    if (confirm !== next) found.confirm = 'The two new passwords do not match.';
    setErrors(found);
    const firstBad = (['current', 'next', 'confirm'] as const).find((k) => found[k]);
    if (firstBad) return document.getElementById(firstBad)?.focus();

    setBusy(true);
    try {
      await api('/api/auth/change-password', { method: 'POST', json: { currentPassword: current, newPassword: next } });
      setDone(true);
      setMessage('Your password has been changed.');
      setTimeout(() => navigate(me ? homePath(me) : '/', { replace: true }), 1200);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors({ current: err.message });
        document.getElementById('current')?.focus();
      } else if (err instanceof ApiError && err.status !== 401) {
        setMessage(err.message);
      }
      setBusy(false);
    }
  }

  if (me && !me.hasPassword) {
    return (
      <div className="max-w-[480px]">
        <PageHeader title="Change password" />
        <Message type="info">This account signs in with QuickBooks, so it has no password. Ask a SuperAdmin for an invite link if you want one.</Message>
      </div>
    );
  }

  return (
    <div className="max-w-[480px]">
      <PageHeader title="Change password" />
      {message && <Message type={done ? 'ok' : 'error'} focus>{message}</Message>}

      {!done && (
        <Card>
          <form noValidate onSubmit={onSubmit}>
            <TextField id="current" label="Current password" type={type} autoComplete="current-password" value={current} error={errors.current} onChange={(e) => (setCurrent(e.target.value), clear('current'))} />
            <TextField id="next" label="New password" type={type} autoComplete="new-password" hint={`At least ${MIN_PASSWORD} characters.`} value={next} error={errors.next} onChange={(e) => (setNext(e.target.value), clear('next'))} />
            <TextField id="confirm" label="Type the new password again" type={type} autoComplete="new-password" value={confirm} error={errors.confirm} onChange={(e) => (setConfirm(e.target.value), clear('confirm'))} />
            <Checkbox checked={showPw} onChange={(e) => setShowPw(e.target.checked)}>
              Show passwords
            </Checkbox>
            <Button type="submit" variant="primary" block loading={busy} className="mt-2">
              {busy ? 'Saving…' : 'Save new password'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
