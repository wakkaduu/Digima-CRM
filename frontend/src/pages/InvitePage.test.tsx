import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    <Route path="/dashboard" element={<p>Dashboard screen</p>} />
  </Routes>
);

describe('InvitePage', () => {
  it('welcomes the invited person and offers QuickBooks or a password', async () => {
    window.location.hash = '#tok-123';
    const fetchMock = mockApi({ 'POST /api/auth/invite': [200, invite] });
    renderWithProviders(tree, '/invite');

    expect(await screen.findByText(/Hi Sam Reyes/)).toHaveTextContent('Sales');
    expect(screen.getByRole('link', { name: /Sign in with QuickBooks to accept/ })).toHaveAttribute('href', '/api/auth/qbo/login?next=%2F');
    expect(screen.getByText('sam@x.co')).toBeInTheDocument(); // the email they will log in with
    // The token travels in the request body, never in a URL.
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('/api/auth/invite');
    expect(JSON.parse(String(init?.body))).toEqual({ token: 'tok-123' });
  });

  it('checks the password before sending anything', async () => {
    window.location.hash = '#tok-123';
    const fetchMock = mockApi({ 'POST /api/auth/invite': [200, invite] });
    renderWithProviders(tree, '/invite');

    await userEvent.type(await screen.findByLabelText('Choose a password'), 'short');
    await userEvent.type(screen.getByLabelText('Type it again'), 'different');
    await userEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));

    expect(await screen.findByText('Use at least 10 characters.')).toBeInTheDocument();
    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1); // only the invite check
  });

  it('sets the password with the link and signs the person in', async () => {
    window.location.hash = '#tok-123';
    const fetchMock = mockApi({
      'POST /api/auth/invite': [200, invite],
      'POST /api/auth/invite/password': [200, { user: { id: '9', name: 'Sam Reyes', email: 'sam@x.co', role: 'sales', hasPassword: true } }],
    });
    renderWithProviders(tree, '/invite');

    await userEvent.type(await screen.findByLabelText('Choose a password'), 'a-long-password');
    await userEvent.type(screen.getByLabelText('Type it again'), 'a-long-password');
    await userEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));

    await waitFor(() => expect(screen.getByText('Dashboard screen')).toBeInTheDocument());
    const call = fetchMock.mock.calls.find(([url]) => String(url) === '/api/auth/invite/password');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ token: 'tok-123', password: 'a-long-password' });
  });

  it('shows the server message when the link was used up while the form was open', async () => {
    window.location.hash = '#tok-123';
    mockApi({
      'POST /api/auth/invite': [200, invite],
      'POST /api/auth/invite/password': [404, { error: { message: 'This invite link is not valid, has expired, or was already used.' } }],
    });
    renderWithProviders(tree, '/invite');

    await userEvent.type(await screen.findByLabelText('Choose a password'), 'a-long-password');
    await userEvent.type(screen.getByLabelText('Type it again'), 'a-long-password');
    await userEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('was already used');
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
