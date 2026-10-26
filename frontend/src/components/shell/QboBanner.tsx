import { TriangleAlert } from 'lucide-react';
import { useLocation } from 'react-router';
import { signInUrl } from '../../api/auth';
import { useQboReauthFlag, useQboStatus } from '../../api/qbo';

const EXPIRY_WARNING_DAYS = 14;

/**
 * Warning shown on every page when the signed-in user's own QuickBooks connection has expired, a call just failed on
 * an expired connection, or it lapses within two weeks. Signing in with QuickBooks again renews it.
 */
export function QboBanner() {
  const { pathname, search } = useLocation();
  const status = useQboStatus();
  const reauth = useQboReauthFlag();

  const expired = status.data?.connected === false || !!status.data?.needsReauth || reauth;
  const days = status.data?.expiresInDays;
  const expiringSoon = status.data?.connected === true && days !== undefined && days <= EXPIRY_WARNING_DAYS;
  if (!expired && !expiringSoon) return null;

  return (
    <div role="alert" className="border-b border-warning bg-warning-bg px-4 py-2 text-warning">
      <div className="mx-auto flex max-w-[1200px] items-start gap-2 lg:px-2">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>
          {expired
            ? 'Your QuickBooks connection has expired. QuickBooks data and payment posting will not work until you sign in again.'
            : `Your QuickBooks connection expires in ${days} ${days === 1 ? 'day' : 'days'}. Sign in again before then so everything keeps working.`}{' '}
          {/* A real navigation: the backend redirects to Intuit and back. */}
          <a href={signInUrl(pathname + search)} className="font-semibold underline">
            Sign in with QuickBooks
          </a>
        </p>
      </div>
    </div>
  );
}
