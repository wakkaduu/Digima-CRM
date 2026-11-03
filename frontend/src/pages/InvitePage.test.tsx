import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { InvitePage } from './InvitePage';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = '';
});

const invite = { name: 'Sam Reyes', email: 'sam@x.co', role: 'sales' };
const tree = (
  <Routes>
    <Route path="/invite" element={<InvitePage />} />
  </Routes>
);

describe('InvitePage', () => {
  it('welcomes the invited person and offers only QuickBooks', async () => {
    window.location.hash = '#tok-123';
    const fetchMock = mockApi({ 'POST /api/auth/invite': [200, invite] });
    renderWithProviders(tree, '/invite');

    expect(await screen.findByText(/Hi Sam Reyes/)).toHaveTextContent('Sales');
    expect(screen.getByRole('link', { name: /Sign in with QuickBooks to accept/ })).toHaveAttribute('href', '/api/auth/qbo/login?next=%2F');
    // No way to set a password: QuickBooks is the only way in.
    expect(screen.queryByLabelText('Choose a password')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /password/i })).not.toBeInTheDocument();
    // The token travels in the request body, never in a URL.
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('/api/auth/invite');
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'tok-123' });
    expect(fetchMock.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(1);
  });

  it('explains a link that is not valid, expired or used', async () => {
    window.location.hash = '#old-link';
    mockApi({ 'POST /api/auth/invite': [404, { error: { message: 'This invite link is not valid, has expired, or was already used.' } }] });
    renderWithProviders(tree, '/invite');

    expect(await screen.findByRole('heading', { name: 'Invite not valid' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Ask a SuperAdmin to send you a new one');
    expect(screen.queryByRole('link', { name: /Sign in with QuickBooks/ })).not.toBeInTheDocument();
  });

  it('does not call the server for a link with no token', () => {
    window.location.hash = '';
    const fetchMock = mockApi({});
    renderWithProviders(tree, '/invite');

    expect(screen.getByRole('heading', { name: 'Invite not valid' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
