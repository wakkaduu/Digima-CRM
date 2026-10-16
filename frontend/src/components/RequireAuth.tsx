import { Navigate, Outlet, useLocation } from 'react-router';
import { homePath, useMe } from '../api/auth';
import type { Role } from '../api/types';
import { Message } from './Message';
import { Topbar } from './Topbar';

/**
 * Route guard + app shell: redirects to login / password change as needed.
 * `roles` limits the route to those roles; anyone else is sent to their own home page.
 */
export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { data: user, isPending, error } = useMe();
  const { pathname } = useLocation();

  if (isPending) return <p className="page hint">Loading…</p>;
  if (error) {
    return (
      <main className="page">
        <Message>{error.message}</Message>
      </main>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  if (user.mustChangePassword && pathname !== '/password') return <Navigate to="/password" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePath(user)} replace />;

  return (
    <>
      <Topbar user={user} />
      <Outlet />
    </>
  );
}
