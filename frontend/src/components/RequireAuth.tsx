import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { homePath, useMe } from '../api/auth';
import type { Role } from '../api/types';
import { Message } from './Message';
import { AppShell } from './shell/AppShell';
import { PageSkeleton } from './ui/Skeletons';

/**
 * Route guard + app shell: redirects to login / password change as needed.
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
  if (user.mustChangePassword && pathname !== '/password') return <Navigate to="/password" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePath(user)} replace />;

  return (
    <AppShell user={user}>
      {/* Inside the shell, so the sidebar stays put while a page's code loads. */}
      <Suspense fallback={<PageSkeleton />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
