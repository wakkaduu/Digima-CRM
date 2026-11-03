import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { QBO_STATUS_KEY } from '../api/qbo';
import { useMe } from '../api/auth';
import { Message } from '../components/Message';
import { LegalShell } from '../components/shell/LegalLayout';
import { Button, buttonClass } from '../components/ui/Button';
import { APP_NAME, CONTACT_EMAIL } from '../lib/legal';
import { useDocumentTitle } from '../lib/useDocumentTitle';

/**
 * The "disconnect URL" given to Intuit: where people land after removing the app from QuickBooks. Public, and it changes
 * nothing on load (a link someone else sends must not be able to disconnect you); a signed-in user can finish the cleanup here.
 */
export function DisconnectedPage() {
  useDocumentTitle('QuickBooks disconnected');
  const qc = useQueryClient();
  const { data: me } = useMe();

  const remove = useMutation({
    mutationFn: () => api('/api/auth/qbo/disconnect', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QBO_STATUS_KEY }),
  });

  return (
    <LegalShell
      title="QuickBooks disconnected"
      lead={`${APP_NAME} no longer has access to QuickBooks, and will not read or change your company file until someone connects it again.`}
    >
      <div className="mx-auto max-w-[720px] space-y-5 rounded-card bg-surface p-5 text-[1.0625rem] leading-[1.7] sm:p-8">
        <p>
          If you disconnected from QuickBooks, we discard the stored connection the next time it stops working. To remove it right
          now, sign in and use the button below.
        </p>

        {remove.isSuccess && <Message type="ok">Your QuickBooks connection was removed.</Message>}
        {remove.isError && <Message type="error">Could not remove the connection: {remove.error.message}</Message>}

        <div className="flex flex-wrap gap-2">
          {me ? (
            <Button variant="primary" size="lg" loading={remove.isPending} disabled={remove.isSuccess} onClick={() => remove.mutate()}>
              Remove my QuickBooks connection
            </Button>
          ) : (
            <Link to="/login?next=%2Fdisconnect" className={buttonClass({ variant: 'primary', size: 'lg' })}>
              Sign in to remove it now
            </Link>
          )}
          <Link to={me ? '/settings/integrations' : '/login'} className={buttonClass({ size: 'lg' })}>
            {me ? 'Back to QuickBooks settings' : 'Go to sign in'}
          </Link>
        </div>

        <p className="text-body text-text-muted">
          Payment records already created stay in the portal for audit purposes. To have anything deleted, write to{' '}
          <a className="text-accent underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </LegalShell>
  );
}

export default DisconnectedPage;
