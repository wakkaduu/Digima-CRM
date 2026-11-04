import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { ApiError } from '../api/client';
import { ME_KEY } from '../api/auth';
import { OfflineBanner } from '../components/shell/OfflineBanner';
import { markSessionEnded } from '../lib/session';
import { queryClient } from '../queryClient';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';
import ActivityPage from './ActivityPage';
import HelpPage from './HelpPage';
import { LoginPage } from './LoginPage';

const signedOut = { 'GET /api/auth/me': [200, { user: null }] as [number, unknown] };
const me = (role: string) => ({ 'GET /api/auth/me': [200, { user: { id: 'u1', name: 'Ann Cruz', email: 'a@b.co', role } }] as [number, unknown] });

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('session ended', () => {
  it('tells the person why they are on the sign-in page, once', async () => {
    mockApi(signedOut);
    markSessionEnded();
    const page = (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    );
    const first = renderWithProviders(page, '/login?next=%2Freports');
    expect(await screen.findByText(/You were signed out because your session ended\./)).toBeInTheDocument();
    expect(screen.getByText(/Sign in again to go back to the page you were on\./)).toBeInTheDocument();
    first.unmount();

    renderWithProviders(page, '/login');
    await screen.findByRole('link', { name: /Sign in with QuickBooks/ });
    expect(screen.queryByText(/your session ended/)).not.toBeInTheDocument();
  });

  it('is marked when a signed-in session gets a 401, but not for a visitor who never signed in', async () => {
    const fail401 = () => Promise.reject(new ApiError('Please sign in first', 401));

    queryClient.setQueryData(ME_KEY, null);
    await queryClient.fetchQuery({ queryKey: ['x1'], queryFn: fail401 }).catch(() => undefined);
    expect(sessionStorage.getItem('digima.sessionEnded')).toBeNull();

    queryClient.setQueryData(ME_KEY, { id: 'u1', name: 'Ann', email: 'a@b.co', role: 'sales' });
    await queryClient.fetchQuery({ queryKey: ['x2'], queryFn: fail401 }).catch(() => undefined);
    expect(sessionStorage.getItem('digima.sessionEnded')).toBe('1');
    expect(queryClient.getQueryData(ME_KEY)).toBeNull();
  });
});

describe('offline notice', () => {
  it('says what still works when the connection drops, and that it is back', async () => {
    let online = true;
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    renderWithProviders(<OfflineBanner />);
    expect(screen.queryByText(/You are offline/)).not.toBeInTheDocument();

    online = false;
    act(() => void window.dispatchEvent(new Event('offline')));
    expect(screen.getByText(/You are offline\./)).toBeInTheDocument();
    expect(screen.getByText(/Loading and saving wait until the connection is back/)).toBeInTheDocument();

    online = true;
    act(() => void window.dispatchEvent(new Event('online')));
    expect(screen.getByText(/Back online/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});

describe('help', () => {
  it('shows a sales rep how to submit, not how to approve', async () => {
    mockApi(me('sales'));
    renderWithProviders(<HelpPage />);
    expect(await screen.findByRole('heading', { name: 'Submitting a payment' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reviewing payments' })).not.toBeInTheDocument();
    expect(screen.getByText(/JPG, PNG or WebP, up to 5 MB/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'carlinfotech@gmail.com' }).getAttribute('href')).toMatch(/^mailto:carlinfotech@gmail\.com\?subject=/);
    // The main job, one click away: the title button (and again in the side panel).
    for (const link of screen.getAllByRole('link', { name: /Submit a payment/ })) expect(link).toHaveAttribute('href', '/payments/new');
  });

  it('shows an admin the review steps, including what happens when QuickBooks refuses', async () => {
    mockApi(me('admin'));
    renderWithProviders(<HelpPage />);
    expect(await screen.findByRole('heading', { name: 'Reviewing payments' })).toBeInTheDocument();
    expect(screen.getByText(/30 seconds to undo a rejection/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'When QuickBooks says no' })).toBeInTheDocument();
  });

  it('shows a SuperAdmin the team, reports and activity', async () => {
    mockApi(me('superadmin'));
    renderWithProviders(<HelpPage />);
    const guide = await screen.findByRole('region', { name: 'Running the portal' });
    for (const name of ['Team', 'Reports', 'Activity']) expect(within(guide).getByRole('link', { name })).toBeInTheDocument();
    expect(within(guide).getByText(/expires after 7 days/)).toBeInTheDocument();
  });
});

describe('activity log', () => {
  const event = (over: Record<string, unknown>) => ({
    id: String(Math.random()),
    at: new Date().toISOString(),
    actorId: 'u2',
    actorName: 'Ben Admin',
    actorRole: 'admin',
    action: 'payment.approved',
    outcome: 'ok',
    paymentId: 'p1',
    targetUserId: null,
    summary: 'Approved ₱20,000.00 from Cool Cars (estimate #1006); created invoice #1043',
    details: { estimateId: '160', estimateNumber: '1006' },
    ...over,
  });
  const team = [{ id: 'u2', name: 'Ben Admin', email: 'b@x.ph', role: 'admin', active: true, linked: true, invitePending: false, inviteExpiresAt: null, createdAt: '' }];

  it('lists what happened today, marks failures and links to the estimate', async () => {
    mockApi({
      'GET /api/users': [200, { users: team }],
      'GET /api/activity?page=1&pageSize=50': [
        200,
        {
          items: [
            event({}),
            event({ actorId: null, actorName: 'Unknown visitor', actorRole: null, action: 'auth.sign_in_refused', outcome: 'failed', paymentId: null, summary: 'A QuickBooks sign-in was refused by someone who has not been invited', details: { code: 'not_authorized' } }),
          ],
          total: 2,
          page: 1,
          pageSize: 50,
        },
      ],
      'GET /api/activity?page=1&pageSize=10&failed=true': [200, { items: [], total: 1, page: 1, pageSize: 10 }],
    });
    renderWithProviders(<ActivityPage />, '/activity');
    expect(await screen.findByText(/2 events, newest first\./)).toBeInTheDocument();
    // The answer to "did anything fail?" leads, with one click to see only those.
    expect(await screen.findByRole('button', { name: '1 attempt failed' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByText(/created invoice #1043/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open estimate #1006/ })).toHaveAttribute('href', '/estimates/160');
    expect(screen.getAllByText('Failed')).toHaveLength(1);
  });

  it('asks the server for one kind of activity, one person and failures only', async () => {
    const fetchMock = mockApi({ 'GET /api/users': [200, { users: team }] });
    renderWithProviders(<ActivityPage />, '/activity');
    await userEvent.click(await screen.findByRole('tab', { name: 'Payments' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('category=payments'))).toBe(true));
    await userEvent.selectOptions(await screen.findByLabelText('Person'), 'u2');
    await userEvent.click(screen.getByLabelText('Only failed attempts'));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => /category=payments&actor=u2&failed=true/.test(String(u)))).toBe(true));
  });

  it('says plainly when nothing matches', async () => {
    mockApi({ 'GET /api/users': [200, { users: team }], 'GET /api/activity?page=1&pageSize=50&failed=true': [200, { items: [], total: 0, page: 1, pageSize: 50 }] });
    renderWithProviders(<ActivityPage />, '/activity?failed=true');
    expect(await screen.findByText('No failed attempts')).toBeInTheDocument();
    expect(screen.getByText('Every approval, void and sign-in in this view went through.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show everything' })).toBeInTheDocument();
  });
});
