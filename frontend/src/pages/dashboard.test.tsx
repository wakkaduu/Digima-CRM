import { Route, Routes } from 'react-router';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette } from '../components/shell/CommandPalette';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';
import DashboardPage, { greeting } from './DashboardPage';

afterEach(() => vi.unstubAllGlobals());

const sales = { id: 's1', name: 'Sam Reyes', email: 's@x.test', role: 'sales' as const, mustChangePassword: false };
const admin = { id: 'a1', name: 'Ana Admin', email: 'a@x.test', role: 'admin' as const, mustChangePassword: false };
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const counts = { all: 10, Pending: 3, Accepted: 4, Closed: 2, Rejected: 1 };

describe('greeting', () => {
  it('follows the hour in Manila', () => {
    expect(greeting(new Date('2026-10-19T00:00:00Z'))).toBe('Good morning'); // 08:00
    expect(greeting(new Date('2026-10-19T06:00:00Z'))).toBe('Good afternoon'); // 14:00
    expect(greeting(new Date('2026-10-19T12:00:00Z'))).toBe('Good evening'); // 20:00
  });
});

describe('Sales dashboard', () => {
  it('summarises my payments and links to what to do next', async () => {
    mockApi({
      'GET /api/auth/me': [200, { user: sales }],
      'GET /api/payments/mine': [
        200,
        {
          unseenCount: 1,
          payments: [
            { id: 'p1', customerName: 'Acme Corp', qboEstimateId: '9', qboEstimateNumber: '1042', amountSubmitted: '1000', finalAmount: null, bankDepositedTo: 'BDO', status: 'pending', rejectionReason: null, createdAt: hoursAgo(2), unseen: false },
            { id: 'p2', customerName: 'Beta Ltd', qboEstimateId: '10', qboEstimateNumber: '1043', amountSubmitted: '2500', finalAmount: '2462.5', bankDepositedTo: 'Cash', status: 'approved', rejectionReason: null, createdAt: hoursAgo(30), unseen: true },
            { id: 'p3', customerName: 'Gamma Inc', qboEstimateId: '11', qboEstimateNumber: null, amountSubmitted: '700', finalAmount: null, bankDepositedTo: 'UnionBank', status: 'rejected', rejectionReason: 'Blurry', createdAt: hoursAgo(50), unseen: false },
          ],
        },
      ],
      'GET /api/payments/recent-estimates': [200, { estimates: [] }],
      'GET /api/estimates?page=1&pageSize=1': [200, { items: [], total: 0, page: 1, pageSize: 1, counts, lookbackDays: 90 }],
    });
    renderWithProviders(<DashboardPage />, '/dashboard');

    expect(await screen.findByRole('heading', { name: /, Sam$/ })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Approved.*₱2,462\.50 posted/ })).toHaveAttribute('href', '/payments?tab=approved');
    expect(screen.getByRole('link', { name: /Awaiting review.*1/ })).toHaveAttribute('href', '/payments?tab=pending');
    expect(screen.getByRole('link', { name: /Rejected.*Check the reasons/ })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Open estimates.*7/ })).toBeInTheDocument(); // Pending 3 + Accepted 4
    expect(screen.getByText(/1 of your submissions has been reviewed/)).toBeInTheDocument();
    const recent = screen.getByRole('region', { name: 'Recent payments' });
    expect(within(recent).getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Submit a payment/ })).toHaveAttribute('href', '/payments/new');
    expect(await screen.findByText(/Estimates you submit payments for will appear here/)).toBeInTheDocument();
  });

  it('still renders when QuickBooks is down', async () => {
    mockApi({
      'GET /api/auth/me': [200, { user: sales }],
      'GET /api/payments/mine': [200, { payments: [], unseenCount: 0 }],
      'GET /api/payments/recent-estimates': [502, { error: { message: 'down' } }],
      'GET /api/estimates?page=1&pageSize=1': [502, { error: { message: 'down' } }],
    });
    renderWithProviders(<DashboardPage />, '/dashboard');
    expect(await screen.findByText(/No payments yet/)).toBeInTheDocument();
    expect(await screen.findByText('QuickBooks unavailable')).toBeInTheDocument();
  });
});

describe('Admin dashboard', () => {
  it('shows the queue oldest first with a text warning when it is stale, and the QuickBooks state', async () => {
    mockApi({
      'GET /api/auth/me': [200, { user: admin }],
      'GET /api/payments/pending': [
        200,
        {
          count: 2,
          payments: [
            { id: 'n1', customerName: 'Newer Co', submittedBy: 'Sam', bankDepositedTo: 'BDO', amountSubmitted: '500', createdAt: hoursAgo(1), qboPartiallyPosted: false },
            { id: 'o1', customerName: 'Older Co', submittedBy: 'Tina', bankDepositedTo: 'Cash', amountSubmitted: '1500', createdAt: hoursAgo(50), qboPartiallyPosted: true },
          ],
        },
      ],
      'GET /api/payments?status=approved%2Crejected&sort=createdAt%3Adesc&page=1&pageSize=5': [
        200,
        { items: [{ id: 'r1', customerName: 'Done Co', status: 'approved', amountSubmitted: '900', finalAmount: '886.5', reviewedBy: 'Ana Admin', reviewedAt: hoursAgo(3) }], total: 1, page: 1, pageSize: 5 },
      ],
      'GET /api/auth/qbo/status': [200, { connected: true, expiresInDays: 90, lastVerifiedAt: hoursAgo(1) }],
      'GET /api/customers?status=active&page=1&pageSize=1': [200, { items: [], total: 0, page: 1, pageSize: 1, counts: { all: 20, active: 18, inactive: 2 } }],
      'GET /api/estimates?page=1&pageSize=1': [200, { items: [], total: 0, page: 1, pageSize: 1, counts, lookbackDays: 90 }],
    });
    renderWithProviders(<DashboardPage />, '/dashboard');

    const queue = await screen.findByRole('region', { name: 'Needs your review' });
    const rows = await within(queue).findAllByRole('link', { name: /Co/ });
    expect(rows[0]).toHaveTextContent('Older Co'); // oldest first
    expect(rows[0]).toHaveTextContent('over a day');
    expect(screen.getByRole('link', { name: /Awaiting review.*2.*1 need attention/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Longest wait.*2d.*Over 24 hours/ })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Active customers.*18/ })).toBeInTheDocument();
    expect(await screen.findByText('Done Co')).toBeInTheDocument();
    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Submit payment/ })).not.toBeInTheDocument(); // admins review, reps submit
  });
});

describe('Command palette', () => {
  const routes = {
    'GET /api/customers?q=acme&page=1&pageSize=5': [200, { items: [{ id: '58', name: 'Acme Corp', email: 'ap@acme.test', phone: null }], total: 1, page: 1, pageSize: 5, counts: { all: 1, active: 1, inactive: 0 } }] as [number, unknown],
    'GET /api/estimates?q=acme&page=1&pageSize=5': [200, { items: [{ id: '900', docNumber: '1042', customerName: 'Acme Corp', totalAmount: 10000 }], total: 1, page: 1, pageSize: 5, counts, lookbackDays: 90 }] as [number, unknown],
  };
  const view = (onClose = vi.fn()) =>
    renderWithProviders(
      <>
        <CommandPalette open onClose={onClose} user={sales} />
        <Routes>
          <Route path="/customers/:id" element={<p>Customer screen</p>} />
          <Route path="*" element={null} />
        </Routes>
      </>,
      '/dashboard',
    );

  it('lists pages at once and filters them as you type', async () => {
    mockApi({});
    view();
    expect(await screen.findByRole('option', { name: 'Customers' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('combobox'), 'est');
    expect(screen.getByRole('option', { name: 'Estimates' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Customers' })).not.toBeInTheDocument();
  });

  it('finds customers and estimates in QuickBooks and opens the chosen one from the keyboard', async () => {
    mockApi(routes);
    const onClose = vi.fn();
    view(onClose);
    await userEvent.type(await screen.findByRole('combobox'), 'acme');
    expect(await screen.findByRole('option', { name: /Acme Corp.*ap@acme\.test/ })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: /Estimate #1042/ })).toBeInTheDocument();
    // Pages that do not match are gone, so the first result is the customer.
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('Customer screen')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('says so when QuickBooks cannot be searched, and keeps page search working', async () => {
    mockApi({
      'GET /api/customers?q=acme&page=1&pageSize=5': [502, { error: { message: 'down' } }],
      'GET /api/estimates?q=acme&page=1&pageSize=5': [502, { error: { message: 'down' } }],
    });
    view();
    await userEvent.type(await screen.findByRole('combobox'), 'acme');
    expect(await screen.findByText(/Could not search QuickBooks right now/)).toBeInTheDocument();
  });
});
