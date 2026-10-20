import { Link } from 'react-router';
import { TriangleAlert } from 'lucide-react';
import { useQboReauthFlag, useQboStatus } from '../../api/qbo';
import type { User } from '../../api/types';

const EXPIRY_WARNING_DAYS = 14;

/**
 * Admin-only warning shown on every page when QuickBooks is disconnected or expired, a post just failed on an
 * expired connection, or the connection lapses within two weeks, so nobody finds out only when an approval fails.
 */
export function QboBanner({ user }: { user: User }) {
  const enabled = user.role === 'admin' && !user.mustChangePassword;
  const status = useQboStatus(enabled);
  const reauth = useQboReauthFlag(enabled);
  if (!enabled) return null;

  const disconnected = status.data?.connected === false && !status.data.needsReauth;
  const expired = !!status.data?.needsReauth || reauth;
  const days = status.data?.expiresInDays;
  const expiringSoon = status.data?.connected === true && days !== undefined && days <= EXPIRY_WARNING_DAYS;
  if (!disconnected && !expired && !expiringSoon) return null;

  return (
    <div role="alert" className="border-b border-warning bg-warning-bg px-4 py-2 text-warning">
      <div className="mx-auto flex max-w-[1200px] items-start gap-2 lg:px-2">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>
          {disconnected
            ? 'QuickBooks is not connected. Approvals cannot be posted until an admin connects it.'
            : expired
              ? 'The QuickBooks connection has expired. Approvals cannot be posted until an admin reconnects it.'
              : `The QuickBooks connection expires in ${days} ${days === 1 ? 'day' : 'days'}. Reconnect it before then so approvals keep working.`}{' '}
          <Link to="/settings/integrations" className="font-semibold underline">
            Reconnect QuickBooks
          </Link>
        </p>
      </div>
    </div>
  );
}
