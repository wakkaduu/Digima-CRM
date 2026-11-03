import { ArrowRight } from 'lucide-react';
import { Navigate, useSearchParams } from 'react-router';
import { homePath, safeNext, signInUrl, useMe } from '../api/auth';
import { Message } from '../components/Message';
import { AuthLayout } from '../components/shell/AuthLayout';
import { buttonClass } from '../components/ui/Button';
import { signInError } from '../lib/signInErrors';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export function LoginPage() {
  useDocumentTitle('Sign in');
  const [params] = useSearchParams();
  const { data: me } = useMe();
  const next = safeNext(params.get('next'));
  const message = signInError(params.get('error'));

  // Already signed in? Skip the page.
  if (me) return <Navigate to={next ?? homePath(me)} replace />;

  return (
    <AuthLayout>
      <h1 className="mb-3 text-[2.25rem] font-bold leading-tight">Sign in</h1>
      <p className="mb-8 text-input text-text-muted">Use the QuickBooks login you work with. We never see your QuickBooks password.</p>
      {message && <Message focus>{message}</Message>}

      {/* A real navigation: the backend redirects to Intuit, which sends the browser back signed in. */}
      <a href={signInUrl(next)} className={buttonClass({ variant: 'primary', size: 'lg', block: true })}>
        Sign in with QuickBooks
        <ArrowRight aria-hidden className="size-4" />
      </a>
      <p className="mt-3 text-small text-text-muted">New here? Open the invite link a SuperAdmin sent you.</p>
    </AuthLayout>
  );
}
