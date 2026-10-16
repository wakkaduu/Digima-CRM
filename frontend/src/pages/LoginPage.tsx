import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { homePath, ME_KEY, safeNext, useMe } from '../api/auth';
import type { User } from '../api/types';
import { Message } from '../components/Message';
import { TextField } from '../components/Field';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Checkbox } from '../components/ui/controls';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function LoginPage() {
  useDocumentTitle('Log in');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const destination = (user: User) =>
    user.mustChangePassword ? '/password' : (safeNext(params.get('next')) ?? homePath(user));

  // Already logged in? Skip the form.
  if (me) return <Navigate to={destination(me)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter your email address, for example name@company.com.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (next.email || next.password) {
      document.getElementById(next.email ? 'email' : 'password')?.focus();
      return;
    }

    setBusy(true);
    try {
      const { user } = await api<{ user: User }>('/api/auth/login', {
        method: 'POST',
        json: { email: email.trim(), password },
      });
      qc.setQueryData(ME_KEY, user);
      navigate(destination(user), { replace: true });
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setPassword('');
      document.getElementById('password')?.focus();
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-4 py-8">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <img src="/logo-mark.svg" alt="" width={48} height={48} className="size-12" />
        <h1 className="text-title font-semibold">Log in to Digima</h1>
      </div>
      {message && <Message>{message}</Message>}

      <Card>
        <form noValidate onSubmit={onSubmit}>
          <TextField
            id="email"
            label="Email address"
            type="email"
            autoComplete="username"
            value={email}
            error={errors.email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((x) => ({ ...x, email: undefined }));
            }}
          />
          <TextField
            id="password"
            label="Password"
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            error={errors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((x) => ({ ...x, password: undefined }));
            }}
          />
          <Checkbox checked={showPw} onChange={(e) => setShowPw(e.target.checked)}>
            Show password
          </Checkbox>
          <Button type="submit" variant="primary" block loading={busy} className="mt-2">
            {busy ? 'Logging in…' : 'Log in'}
          </Button>
          <p className="mt-3 text-small text-text-muted">Forgot your password? Ask an admin to reset it.</p>
        </form>
      </Card>
    </main>
  );
}
