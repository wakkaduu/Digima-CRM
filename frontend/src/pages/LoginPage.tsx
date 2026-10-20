import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { homePath, ME_KEY, safeNext, useMe } from '../api/auth';
import type { User } from '../api/types';
import { Message } from '../components/Message';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Field, TextField } from '../components/Field';
import { Button } from '../components/ui/Button';
import { BrandLockup } from '../components/shell/BrandLockup';
import { Input } from '../components/ui/controls';
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
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2">
      <aside className="relative flex flex-col justify-between overflow-hidden p-8 text-white max-lg:hidden">
        <img src="/login-hero.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div aria-hidden className="absolute inset-0 bg-text/60" />
        <BrandLockup className="relative" />
        <div className="relative max-w-[560px]">
          <h2 className="mb-3 text-[3rem] font-bold leading-tight">Payments, reviewed in one place.</h2>
          <p className="text-input font-medium">
            Submit a receipt, match it to the estimate, and let the team approve it, with QuickBooks kept in step.
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-4 py-8 lg:px-16 lg:py-12">
        <div className="w-full max-w-[640px]">
          <BrandLockup className="mb-6 lg:hidden" />
          <h1 className="mb-8 text-[2.25rem] font-bold leading-tight">Log in to your account</h1>
          {message && <Message>{message}</Message>}

          <div>
            <form noValidate onSubmit={onSubmit} className="text-input [&_label]:text-input">
              <TextField
                id="email"
                label="Email address"
                type="email"
                autoComplete="username"
                placeholder="name@company.com"
                value={email}
                error={errors.email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((x) => ({ ...x, email: undefined }));
                }}
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
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setErrors((x) => ({ ...x, password: undefined }));
                      }}
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
                {busy ? 'Logging in…' : 'Log in'}
                {!busy && <ArrowRight aria-hidden className="size-4" />}
              </Button>
              <p className="mt-3 text-small text-text-muted">Forgot your password? Ask an admin to reset it.</p>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
