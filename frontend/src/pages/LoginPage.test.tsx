import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
const user = { id: '1', name: 'Ann', email: 'a@b.co', role: 'admin', hasPassword: true };

afterEach(() => vi.unstubAllGlobals());

describe('LoginPage', () => {
  it('offers email and password, and Sign in with QuickBooks', async () => {
    mockApi(signedOut);
    renderWithProviders(page, '/login');

    expect(await screen.findByLabelText('Email address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sign in with QuickBooks/ })).toHaveAttribute('href', '/api/auth/qbo/login');
  });

  it('shows field errors and does not call the API when the form is empty', async () => {
    const fetchMock = mockApi(signedOut);
    renderWithProviders(page, '/login');

    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText(/Enter your email address, for example/)).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('shows the server error for a wrong password', async () => {
    mockApi({ ...signedOut, 'POST /api/auth/login': [401, { error: { message: 'Incorrect email or password.' } }] });
    renderWithProviders(page, '/login');

    await userEvent.type(await screen.findByLabelText('Email address'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  });

  it('signs in with email and goes to the dashboard', async () => {
    const fetchMock = mockApi({ ...signedOut, 'POST /api/auth/login': [200, { user }] });
    renderWithProviders(page, '/login');

    await userEvent.type(await screen.findByLabelText('Email address'), '  a@b.co ');
    await userEvent.type(screen.getByLabelText('Password'), 'secret-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(screen.getByText('Dashboard screen')).toBeInTheDocument());
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ email: 'a@b.co', password: 'secret-password' });
  });

  it('returns to the page the visitor was heading to', async () => {
    mockApi({ ...signedOut, 'POST /api/auth/login': [200, { user }] });
    renderWithProviders(page, '/login?next=%2Fcustomers');

    await userEvent.type(await screen.findByLabelText('Email address'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'secret-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Customers screen')).toBeInTheDocument();
  });

  it('keeps the return path on the QuickBooks button, and ignores one that leaves the site', async () => {
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
