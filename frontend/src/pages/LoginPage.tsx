import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { homePath, ME_KEY, safeNext, useMe } from '../api/auth';
import type { User } from '../api/types';
import { Message } from '../components/Message';
import { TextField } from '../components/Field';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function LoginPage() {
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
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Payment Portal</span>
        </div>
      </header>

      <main className="page page-narrow">
        <h1>Log in</h1>
        {message && <Message>{message}</Message>}

        <form className="panel" noValidate onSubmit={onSubmit}>
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
          <label className="check">
            <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} /> Show password
          </label>
          <button className="btn btn-primary btn-block mt-2" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
          <p className="hint mt-3">Forgot your password? Ask an admin to reset it.</p>
        </form>
      </main>
    </>
  );
}
