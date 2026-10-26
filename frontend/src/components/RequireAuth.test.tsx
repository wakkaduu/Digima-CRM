import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { RequireAuth } from './RequireAuth';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

const tree = (
  <Routes>
    <Route path="/login" element={<p>Login screen</p>} />
    <Route element={<RequireAuth roles={['sales']} />}>
      <Route path="/" element={<p>Home screen</p>} />
    </Route>
    <Route element={<RequireAuth roles={['sales', 'admin', 'superadmin']} />}>
      <Route path="/dashboard" element={<p>Dashboard screen</p>} />
    </Route>
    <Route element={<RequireAuth roles={['admin']} />}>
      <Route path="/payments/review" element={<p>Admin screen</p>} />
    </Route>
  </Routes>
);
const admin = { id: '2', name: 'Ann', email: 'a@x.co', role: 'admin' };
const sales = { id: '1', name: 'Sam', email: 's@x.co', role: 'sales' };
const boss = { id: '3', name: 'Cy', email: 'c@x.co', role: 'superadmin' };

afterEach(() => vi.unstubAllGlobals());

describe('RequireAuth', () => {
  it('redirects anonymous visitors to the login page', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: null }] });
    renderWithProviders(tree, '/');
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
  });

  it('keeps sales users out of admin pages', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: sales }] });
    renderWithProviders(tree, '/payments/review');
    expect(await screen.findByText('Dashboard screen')).toBeInTheDocument();
  });

  it('keeps admins out of the sales submit page and sends them to the dashboard', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: admin }] });
    renderWithProviders(tree, '/');
    expect(await screen.findByText('Dashboard screen')).toBeInTheDocument();
    expect(screen.queryByText('Home screen')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Submit/ })).not.toBeInTheDocument();
  });

  it('keeps a SuperAdmin out of the pages that act on payments', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: boss }] });
    renderWithProviders(tree, '/payments/review');
    expect(await screen.findByText('Dashboard screen')).toBeInTheDocument();
    expect(screen.queryByText('Admin screen')).not.toBeInTheDocument();
  });

  it('shows the app shell with the right navigation for the role', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: sales }] });
    renderWithProviders(tree, '/');
    // Phone layout (jsdom has no media queries): the tab bar link is named by its visible text.
    expect(await screen.findByRole('link', { name: /^Submit/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Review/ })).not.toBeInTheDocument();
  });
});
