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
const signedOut = { 'GET /api/auth/me': [200, { user: null }] as [number, unknown] };
const user = { id: '1', name: 'Ann', email: 'a@b.co', role: 'admin', hasPassword: false };

afterEach(() => vi.unstubAllGlobals());

describe('LoginPage', () => {
  it('offers Sign in with QuickBooks and nothing else: no email or password fields', async () => {
    mockApi(signedOut);
    renderWithProviders(page, '/login');

    expect(await screen.findByRole('link', { name: /Sign in with QuickBooks/ })).toHaveAttribute('href', '/api/auth/qbo/login');
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('keeps the return path on the QuickBooks button', async () => {
    mockApi(signedOut);
    renderWithProviders(page, '/login?next=%2Fcustomers');
    expect(await screen.findByRole('link', { name: /Sign in with QuickBooks/ })).toHaveAttribute('href', '/api/auth/qbo/login?next=%2Fcustomers');
  });

  it('ignores a return path that leaves the site', async () => {
    mockApi(signedOut);
    renderWithProviders(page, '/login?next=%2F%2Fevil.example');
    expect(await screen.findByRole('link', { name: /Sign in with QuickBooks/ })).toHaveAttribute('href', '/api/auth/qbo/login');
  });

  it('explains why a QuickBooks sign-in was refused, and says what an unknown code means', async () => {
    mockApi(signedOut);
    const first = renderWithProviders(page, '/login?error=not_authorized');
    expect(await screen.findByRole('alert')).toHaveTextContent('has not been invited yet');
    expect(screen.getByRole('alert')).not.toHaveTextContent(/password/i);
    first.unmount();

    renderWithProviders(page, '/login?error=whatever');
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-in did not complete');
  });

  it('skips the page when already signed in', async () => {
    mockApi({ 'GET /api/auth/me': [200, { user }] });
    renderWithProviders(page, '/login?next=%2Fcustomers');
    expect(await screen.findByText('Customers screen')).toBeInTheDocument();
  });
});
