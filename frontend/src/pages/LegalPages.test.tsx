import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { DisconnectedPage } from './DisconnectedPage';
import { LoginPage } from './LoginPage';
import { PrivacyPage } from './PrivacyPage';
import { TermsPage } from './TermsPage';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

const pages = (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/privacy" element={<PrivacyPage />} />
    <Route path="/terms" element={<TermsPage />} />
    <Route path="/disconnect" element={<DisconnectedPage />} />
  </Routes>
);
const signedOut = { 'GET /api/auth/me': [200, { user: null }] as [number, unknown] };
const user = { id: '1', name: 'Ann', email: 'a@b.co', role: 'admin', hasPassword: true };

afterEach(() => vi.unstubAllGlobals());

describe('public legal pages', () => {
  it('shows the privacy policy to a visitor who is not signed in, without asking the API for anything private', async () => {
    const fetchMock = mockApi(signedOut);
    renderWithProviders(pages, '/privacy');

    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Disconnecting QuickBooks' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([url]) => String(url) === '/api/auth/me')).toBe(true);
  });

  it('shows the terms of use', async () => {
    mockApi(signedOut);
    renderWithProviders(pages, '/terms');
    expect(await screen.findByRole('heading', { level: 1, name: 'Terms of use' })).toBeInTheDocument();
  });

  it('links to both from the sign-in page', async () => {
    mockApi(signedOut);
    renderWithProviders(pages, '/login');
    expect(await screen.findByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: 'Terms of use' })).toHaveAttribute('href', '/terms');
  });
});

describe('DisconnectedPage (the disconnect URL given to Intuit)', () => {
  it('changes nothing when it is opened, and sends a visitor to sign in first', async () => {
    const fetchMock = mockApi(signedOut);
    renderWithProviders(pages, '/disconnect');

    expect(await screen.findByRole('heading', { level: 1, name: 'QuickBooks disconnected' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in to remove it now' })).toHaveAttribute('href', '/login?next=%2Fdisconnect');
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('lets a signed-in user remove their connection now', async () => {
    const fetchMock = mockApi({ 'GET /api/auth/me': [200, { user }], 'POST /api/auth/qbo/disconnect': [200, { ok: true }] });
    renderWithProviders(pages, '/disconnect');

    await userEvent.click(await screen.findByRole('button', { name: 'Remove my QuickBooks connection' }));

    expect(await screen.findByText('Your QuickBooks connection was removed.')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1));
  });
});
