import { NavLink, useNavigate } from 'react-router';
import { useLogout } from '../api/auth';
import type { Role, User } from '../api/types';

const NAV: { to: string; label: string; roles: Role[] }[] = [
  { to: '/', label: 'Submit payment', roles: ['sales'] },
  { to: '/admin', label: 'Pending approvals', roles: ['admin'] },
  { to: '/setup', label: 'QuickBooks', roles: ['admin'] },
];

export function Topbar({ user }: { user: User }) {
  const logout = useLogout();
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <span className="brand">Payment Portal</span>
        <nav className="nav" aria-label="Main">
          {!user.mustChangePassword &&
            NAV.filter((n) => n.roles.includes(user.role)).map((n) => (
              <NavLink key={n.to} to={n.to} end>
                {n.label}
              </NavLink>
            ))}
        </nav>
        <div className="user">
          <span>
            {user.name} ({user.role})
          </span>
          {!user.mustChangePassword && <NavLink to="/password">Change password</NavLink>}
          <button
            type="button"
            className="btn btn-link"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
