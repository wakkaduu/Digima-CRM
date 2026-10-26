import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { LoginPage } from './LoginPage';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

const page = (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/dashboard" element={<p>Dashboard screen</p>} />
    <Route path="/customers" element={<p>Customers screen</p>} />
  </Routes>
);

afterEach(() => vi.unstubAllGlobals());

describe('LoginPage', () => {
  it('offers Sign in with QuickBooks as the only way in', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: null }] });
    renderWithProviders(page, '/login');

    expect(await screen.findByRole('link', { name: /Sign in with QuickBooks/ })).toHaveAttribute('href', '/api/auth/qbo/login');
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('remembers where the visitor was heading', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: null }] });
    renderWithProviders(page, '/login?next=%2Fcustomers');

    expect(await screen.findByRole('link', { name: /Sign in with QuickBooks/ })).toHaveAttribute(
      'href',
      '/api/auth/qbo/login?next=%2Fcustomers',
    );
  });

  it('ignores a return path that leaves the site', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: null }] });
    renderWithProviders(page, '/login?next=%2F%2Fevil.example');

    expect(await screen.findByRole('link', { name: /Sign in with QuickBooks/ })).toHaveAttribute('href', '/api/auth/qbo/login');
  });

  it('explains why a sign-in was refused', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: null }] });
    renderWithProviders(page, '/login?error=not_authorized');

    expect(await screen.findByRole('alert')).toHaveTextContent('has not been invited yet');
  });

  it('tells someone with a dead invite link to ask for a new one', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: null }] });
    renderWithProviders(page, '/login?error=invite_invalid');

    expect(await screen.findByRole('alert')).toHaveTextContent('Ask a SuperAdmin for a new one');
  });

  it('falls back to a generic message for an unknown error code', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: null }] });
    renderWithProviders(page, '/login?error=whatever');

    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in did not complete');
  });

  it('skips the page when already signed in', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user: { id: '1', name: 'Ann', email: 'a@b.co', role: 'admin' } }] });
    renderWithProviders(page, '/login?next=%2Fcustomers');

    expect(await screen.findByText('Customers screen')).toBeInTheDocument();
  });
});
