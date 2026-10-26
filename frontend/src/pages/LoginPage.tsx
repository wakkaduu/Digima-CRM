import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ME_KEY, homePath, safeNext, signInUrl, useMe } from '../api/auth';
import { api, ApiError } from '../api/client';
import type { User } from '../api/types';
import { Field, TextField } from '../components/Field';
import { Message } from '../components/Message';
import { AuthLayout } from '../components/shell/AuthLayout';
import { Button, buttonClass } from '../components/ui/Button';
import { Input } from '../components/ui/controls';
import { signInError } from '../lib/signInErrors';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function LoginPage() {
  useDocumentTitle('Sign in');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const next = safeNext(params.get('next'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [message, setMessage] = useState<string | null>(signInError(params.get('error')));
  const [busy, setBusy] = useState(false);

  // Already signed in? Skip the page.
  if (me) return <Navigate to={next ?? homePath(me)} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    const found: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) found.email = 'Enter your email address, for example name@company.com.';
    if (!password) found.password = 'Enter your password.';
    setErrors(found);
    if (found.email || found.password) return document.getElementById(found.email ? 'email' : 'password')?.focus();

    setBusy(true);
    try {
      const { user } = await api<{ user: User }>('/api/auth/login', { method: 'POST', json: { email: email.trim(), password } });
      qc.setQueryData(ME_KEY, user);
      navigate(next ?? homePath(user), { replace: true });
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setPassword('');
      document.getElementById('password')?.focus();
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="mb-8 text-[2.25rem] font-bold leading-tight">Sign in</h1>
      {message && <Message focus>{message}</Message>}

      <form noValidate onSubmit={onSubmit} className="text-input [&_label]:text-input">
        <TextField
          id="email"
          label="Email address"
          type="email"
          autoComplete="username"
          placeholder="name@company.com"
          value={email}
          error={errors.email}
          onChange={(e) => (setEmail(e.target.value), setErrors((x) => ({ ...x, email: undefined })))}
        />
        <Field id="password" label="Password" error={errors.password}>
          {(aria) => (
            <div className="relative">
              <Input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                className="pr-12"
                value={password}
                onChange={(e) => (setPassword(e.target.value), setErrors((x) => ({ ...x, password: undefined })))}
                {...aria}
              />
              <button
                type="button"
                aria-label={showPw ? 'Hide password' : 'Show password'}
                aria-pressed={showPw}
                onClick={() => setShowPw((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-control text-text-muted hover:text-text"
              >
                {showPw ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
              </button>
            </div>
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={busy} className="mt-2">
          {busy ? 'Signing in…' : 'Sign in'}
          {!busy && <ArrowRight aria-hidden className="size-4" />}
        </Button>
        <p className="mt-3 text-small text-text-muted">Forgot your password? Ask a SuperAdmin for a new invite link.</p>
      </form>

      <div className="my-6 flex items-center gap-3 text-small text-text-muted" role="separator" aria-label="or">
        <span aria-hidden className="h-px flex-1 bg-border" /> or <span aria-hidden className="h-px flex-1 bg-border" />
      </div>

      {/* A real navigation: the backend redirects to Intuit, which sends the browser back signed in. */}
      <a href={signInUrl(next)} className={buttonClass({ size: 'lg', block: true })}>
        Sign in with QuickBooks
      </a>
      <p className="mt-3 text-small text-text-muted">New here? Open the invite link a SuperAdmin sent you.</p>
    </AuthLayout>
  );
}
