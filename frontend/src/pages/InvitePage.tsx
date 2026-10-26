import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ME_KEY, homePath, signInUrl } from '../api/auth';
import { api, ApiError } from '../api/client';
import type { Role, User } from '../api/types';
import { TextField } from '../components/Field';
import { Message } from '../components/Message';
import { AuthLayout } from '../components/shell/AuthLayout';
import { Button, buttonClass } from '../components/ui/Button';
import { Checkbox } from '../components/ui/controls';
import { Skeleton } from '../components/ui/States';
import { roleLabel } from '../lib/roles';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const MIN_PASSWORD = 10;

/**
 * Landing page of a one-time invite link: `/invite#<token>`. The token is in the URL fragment so it never reaches a
 * server log. Two ways to use the link: sign in with QuickBooks (the backend remembers the invite for this browser and
 * links that login to the account), or choose a password and sign in with email from then on.
 */
export function InvitePage() {
  useDocumentTitle('Accept your invite');
  const token = window.location.hash.replace(/^#/, '');
  const navigate = useNavigate();
  const qc = useQueryClient();

  const invite = useQuery({
    queryKey: ['invite', token],
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    queryFn: () => api<{ name: string; email: string; role: Role }>('/api/auth/invite', { method: 'POST', json: { token } }),
  });

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const found: typeof errors = {};
    if (password.length < MIN_PASSWORD) found.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (confirm !== password) found.confirm = 'The two passwords do not match.';
    setErrors(found);
    if (found.password || found.confirm) return document.getElementById(found.password ? 'new-password' : 'confirm-password')?.focus();

    setBusy(true);
    try {
      const { user } = await api<{ user: User }>('/api/auth/invite/password', { method: 'POST', json: { token, password } });
      qc.setQueryData(ME_KEY, user);
      navigate(homePath(user), { replace: true });
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  const invalid = !token || invite.isError;
  const type = show ? 'text' : 'password';

  return (
    <AuthLayout>
      <h1 className="mb-2 text-[2.25rem] font-bold leading-tight">{invalid ? 'Invite not valid' : 'You are invited'}</h1>

      {invite.isPending && !!token && (
        <div role="status" aria-label="Checking your invite">
          <Skeleton className="mb-3 h-5 w-3/4" />
          <Skeleton className="h-12" />
        </div>
      )}

      {invalid && (
        <>
          <Message>{invite.error?.message ?? 'This invite link is incomplete.'} Ask a SuperAdmin to send you a new one.</Message>
          <a href="/login" className={buttonClass({ block: true, size: 'lg' })}>
            Go to sign in
          </a>
        </>
      )}

      {invite.data && (
        <>
          <p className="mb-6 text-input text-text-muted">
            Hi {invite.data.name}, you have been added as <strong className="text-text">{roleLabel(invite.data.role)}</strong>. This link
            works once. Choose how you want to sign in:
          </p>

          <h2 className="mb-2 text-body font-semibold">With QuickBooks</h2>
          {/* A real navigation: the backend redirects to Intuit, which sends the browser back signed in. */}
          <a href={signInUrl('/')} className={buttonClass({ variant: 'primary', size: 'lg', block: true })}>
            Sign in with QuickBooks to accept
            <ArrowRight aria-hidden className="size-4" />
          </a>

          <div className="my-6 flex items-center gap-3 text-small text-text-muted" role="separator" aria-label="or">
            <span aria-hidden className="h-px flex-1 bg-border" /> or <span aria-hidden className="h-px flex-1 bg-border" />
          </div>

          <h2 className="mb-1 text-body font-semibold">With email and a password</h2>
          <p className="mb-3 text-small text-text-muted">
            You will sign in with <strong className="text-text">{invite.data.email}</strong>.
          </p>
          {message && <Message focus>{message}</Message>}
          <form noValidate onSubmit={onSubmit}>
            <TextField
              id="new-password"
              label="Choose a password"
              type={type}
              autoComplete="new-password"
              hint={`At least ${MIN_PASSWORD} characters.`}
              value={password}
              error={errors.password}
              onChange={(e) => (setPassword(e.target.value), setErrors((x) => ({ ...x, password: undefined })))}
            />
            <TextField
              id="confirm-password"
              label="Type it again"
              type={type}
              autoComplete="new-password"
              value={confirm}
              error={errors.confirm}
              onChange={(e) => (setConfirm(e.target.value), setErrors((x) => ({ ...x, confirm: undefined })))}
            />
            <Checkbox checked={show} onChange={(e) => setShow(e.target.checked)}>
              Show passwords
            </Checkbox>
            <Button type="submit" size="lg" block loading={busy} className="mt-2">
              {busy ? 'Saving…' : 'Set password and sign in'}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
