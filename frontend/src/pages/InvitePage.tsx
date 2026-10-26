import { ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { signInUrl } from '../api/auth';
import type { Role } from '../api/types';
import { Message } from '../components/Message';
import { AuthLayout } from '../components/shell/AuthLayout';
import { buttonClass } from '../components/ui/Button';
import { Skeleton } from '../components/ui/States';
import { roleLabel } from '../lib/roles';
import { useDocumentTitle } from '../lib/useDocumentTitle';

/**
 * Landing page of a one-time invite link: `/invite#<token>`. The token is in the URL fragment so it never reaches a
 * server log. The backend remembers it for this browser; signing in with QuickBooks then links that login to the account.
 */
export function InvitePage() {
  useDocumentTitle('Accept your invite');
  const token = window.location.hash.replace(/^#/, '');

  const invite = useQuery({
    queryKey: ['invite', token],
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
    queryFn: () => api<{ name: string; role: Role }>('/api/auth/invite', { method: 'POST', json: { token } }),
  });

  const invalid = !token || invite.isError;

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
          <Message>
            {invite.error?.message ?? 'This invite link is incomplete.'} Ask a SuperAdmin to send you a new one.
          </Message>
          <a href="/login" className={buttonClass({ block: true, size: 'lg' })}>
            Go to sign in
          </a>
        </>
      )}

      {invite.data && (
        <>
          <p className="mb-8 text-input text-text-muted">
            Hi {invite.data.name}, you have been added as <strong className="text-text">{roleLabel(invite.data.role)}</strong>. Sign
            in with the QuickBooks login you use for work to accept. This link works once.
          </p>
          {/* A real navigation: the backend redirects to Intuit, which sends the browser back signed in. */}
          <a href={signInUrl('/')} className={buttonClass({ variant: 'primary', size: 'lg', block: true })}>
            Sign in with QuickBooks to accept
            <ArrowRight aria-hidden className="size-4" />
          </a>
        </>
      )}
    </AuthLayout>
  );
}
