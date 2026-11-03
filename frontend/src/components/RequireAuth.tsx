import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { homePath, useMe } from '../api/auth';
import type { Role } from '../api/types';
import { ErrorPage } from '../pages/ErrorPage';
import { ErrorBoundary } from './ErrorBoundary';
import { Message } from './Message';
import { AppShell } from './shell/AppShell';
import { PageSkeleton } from './ui/Skeletons';

/**
 * Route guard + app shell: sends signed-out visitors to the sign-in page.
 * `roles` limits the route to those roles; anyone else is sent to their own home page.
 */
export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { data: user, isPending, error } = useMe();
  const { pathname } = useLocation();

  if (isPending) {
    return (
      <div className="mx-auto max-w-[720px] p-6">
        <PageSkeleton label="Loading" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-[720px] p-6">
        <Message>{error.message}</Message>
      </div>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePath(user)} replace />;

  return (
    <AppShell user={user}>
      {/* Inside the shell, so the sidebar stays put while a page's code loads, and when a page crashes. */}
      <ErrorBoundary resetKey={pathname} fallback={(err, reset) => <ErrorPage error={err} onRetry={reset} />}>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
