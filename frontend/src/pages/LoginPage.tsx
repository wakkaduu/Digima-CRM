import { ArrowRight } from 'lucide-react';
import { Navigate, useSearchParams } from 'react-router';
import { homePath, safeNext, signInUrl, useMe } from '../api/auth';
import { Message } from '../components/Message';
import { buttonClass } from '../components/ui/Button';
import { AuthLayout } from '../components/shell/AuthLayout';
import { useDocumentTitle } from '../lib/useDocumentTitle';

/** Why the backend sent the browser back here (see GET /api/auth/qbo/callback). */
const ERRORS: Record<string, string> = {
  access_denied: 'Sign-in was cancelled. You can try again whenever you are ready.',
  not_authorized: 'This QuickBooks login has not been invited yet. Ask a SuperAdmin for an invite link, open it, then sign in.',
  invite_invalid: 'That invite link is not valid, has expired, or was already used. Ask a SuperAdmin for a new one.',
  already_linked: 'That QuickBooks login already belongs to another account, so this invite cannot be used with it. Use the login you were invited with, or ask a SuperAdmin for help.',
  deactivated: 'This account has been deactivated. Please contact a SuperAdmin.',
  wrong_company: 'That QuickBooks login belongs to a different company. Sign in with your company account.',
};
const FALLBACK_ERROR = 'Sign-in did not complete. Please try again.';

export function LoginPage() {
  useDocumentTitle('Sign in');
  const [params] = useSearchParams();
  const { data: me } = useMe();
  const next = safeNext(params.get('next'));
  const error = params.get('error');

  // Already signed in? Skip the page.
  if (me) return <Navigate to={next ?? homePath(me)} replace />;

  return (
    <AuthLayout>
      <h1 className="mb-2 text-[2.25rem] font-bold leading-tight">Sign in</h1>
      <p className="mb-8 text-input text-text-muted">
        Use the QuickBooks account for your work. Your QuickBooks access carries over, so there is no separate password.
      </p>
      {error && <Message focus>{ERRORS[error] ?? FALLBACK_ERROR}</Message>}

      {/* A real navigation: the backend redirects to Intuit, which sends the browser back signed in. */}
      <a href={signInUrl(next)} className={buttonClass({ variant: 'primary', size: 'lg', block: true })}>
        Sign in with QuickBooks
        <ArrowRight aria-hidden className="size-4" />
      </a>
      <p className="mt-3 text-small text-text-muted">New here? Open the invite link a SuperAdmin sent you.</p>
    </AuthLayout>
  );
}
