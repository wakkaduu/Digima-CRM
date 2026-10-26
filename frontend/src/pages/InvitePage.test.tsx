import { screen } from '@testing-library/react';
import { InvitePage } from './InvitePage';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = '';
});

describe('InvitePage', () => {
  it('welcomes the invited person and sends them to QuickBooks sign-in', async () => {
    window.location.hash = '#tok-123';
    const fetchMock = mockApi({ 'POST /api/auth/invite': [200, { name: 'Sam Reyes', role: 'sales' }] });
    renderWithProviders(<InvitePage />, '/invite');

    expect(await screen.findByText(/Hi Sam Reyes/)).toHaveTextContent('Sales');
    expect(screen.getByRole('link', { name: /Sign in with QuickBooks to accept/ })).toHaveAttribute('href', '/api/auth/qbo/login?next=%2F');
    // The token travels in the request body, never in a URL.
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('/api/auth/invite');
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'tok-123' });
  });

  it('explains a link that is not valid, expired or used', async () => {
    window.location.hash = '#old-link';
    mockApi({ 'POST /api/auth/invite': [404, { error: { message: 'This invite link is not valid, has expired, or was already used.' } }] });
    renderWithProviders(<InvitePage />, '/invite');

    expect(await screen.findByRole('heading', { name: 'Invite not valid' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Ask a SuperAdmin to send you a new one');
    expect(screen.queryByRole('link', { name: /Sign in with QuickBooks/ })).not.toBeInTheDocument();
  });

  it('does not call the server for a link with no token', () => {
    window.location.hash = '';
    const fetchMock = mockApi({});
    renderWithProviders(<InvitePage />, '/invite');

    expect(screen.getByRole('heading', { name: 'Invite not valid' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
