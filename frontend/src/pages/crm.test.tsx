import { Route, Routes } from 'react-router';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';
import CustomerDetailPage from './CustomerDetailPage';
import CustomersPage from './CustomersPage';
import EstimateDetailPage from './EstimateDetailPage';

afterEach(() => vi.unstubAllGlobals());

const user = (role: 'sales' | 'admin') => ({ user: { id: 'u1', name: 'Ana', email: 'a@x.test', role, mustChangePassword: false } });
const customer = { id: '58', name: 'Acme Corp', company: null, email: 'ap@acme.test', phone: '0917 000 0000', active: true, balance: 5000, openEstimates: 2, lastPaymentAt: '2026-10-10T02:00:00.000Z' };
const estimate = {
  id: '900', docNumber: '1042', customerId: '58', customerName: 'Acme Corp', totalAmount: 10000, txnDate: '2026-10-01', expirationDate: null,
  status: 'Accepted', email: null, pendingAmount: 2000, approvedAmount: 3000,
};

describe('Customers', () => {
  it('lists customers with open estimates and balance, and opens one', async () => {
    mockApi({
      'GET /api/customers?sort=name%3Aasc&page=1&pageSize=25': [200, { items: [customer], total: 1, page: 1, pageSize: 25, counts: { all: 1, active: 1, inactive: 0 } }],
    });
    renderWithProviders(
      <Routes>
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:id" element={<p>Detail screen</p>} />
      </Routes>,
      '/customers',
    );
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('₱5,000.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All 1/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByText('Acme Corp'));
    expect(await screen.findByText('Detail screen')).toBeInTheDocument();
  });

  it('shows a clear empty state when a search finds nothing', async () => {
    mockApi({
      'GET /api/customers?q=zzz&sort=name%3Aasc&page=1&pageSize=25': [200, { items: [], total: 0, page: 1, pageSize: 25, counts: { all: 0, active: 0, inactive: 0 } }],
    });
    renderWithProviders(<CustomersPage />, '/customers?q=zzz');
    expect(await screen.findByText('No customers match')).toBeInTheDocument();
  });

  it('offers a retry when the list cannot load', async () => {
    mockApi({ 'GET /api/customers?sort=name%3Aasc&page=1&pageSize=25': [502, { error: { message: 'QuickBooks is down' } }] });
    renderWithProviders(<CustomersPage />, '/customers');
    expect(await screen.findByText(/QuickBooks is down/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('Customer detail', () => {
  const routes = {
    'GET /api/auth/me': [200, user('admin')],
    'GET /api/customers/58': [200, { customer: { ...customer, paidToDate: 3000, pendingPayments: 1, outstanding: 5000 }, lookbackDays: 90 }],
    'GET /api/payments?customerId=58&pageSize=50&page=1&sort=createdAt%3Adesc': [
      200,
      { items: [{ id: 'p1', customerName: 'Acme Corp', qboEstimateId: '900', qboEstimateNumber: '1042', amountSubmitted: '3000', finalAmount: '2955', bankDepositedTo: 'BDO', status: 'approved', createdAt: '2026-10-10T02:00:00.000Z', submittedBy: 'Ana' }], total: 1, page: 1, pageSize: 50 },
    ],
  } as Record<string, [number, unknown]>;

  it('shows the three summary figures, then the payments tab', async () => {
    mockApi({ ...routes });
    renderWithProviders(
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
      </Routes>,
      '/customers/58',
    );
    expect(await screen.findByRole('heading', { name: 'Acme Corp' })).toBeInTheDocument();
    expect(screen.getByText('Open estimates')).toBeInTheDocument();
    expect(screen.getByText('₱3,000.00')).toBeInTheDocument();
    expect(screen.getByText('1 more awaiting review')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Payments' }));
    expect(await screen.findByText('Estimate #1042')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Estimate #1042/ })).toHaveAttribute('href', '/payments/review/p1'); // admins can open it
  });

  it('says so when the customer is not in QuickBooks', async () => {
    mockApi({ 'GET /api/auth/me': [200, user('admin')], 'GET /api/customers/99': [404, { error: { message: 'Customer not found in QuickBooks' } }] });
    renderWithProviders(
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
      </Routes>,
      '/customers/99',
    );
    expect(await screen.findByText('That customer was not found in QuickBooks.')).toBeInTheDocument();
  });
});

describe('Estimate detail', () => {
  const routes = (role: 'sales' | 'admin') => ({
    'GET /api/auth/me': [200, user(role)] as [number, unknown],
    'GET /api/estimates/900': [200, { estimate: { ...estimate, lines: [{ description: 'Installation', quantity: 2, amount: 10000 }], memo: null, linkedInvoiceIds: [] } }] as [number, unknown],
    'GET /api/payments?estimateId=900&pageSize=50&page=1&sort=createdAt%3Adesc': [200, { items: [], total: 0, page: 1, pageSize: 50 }] as [number, unknown],
  });
  const view = () =>
    renderWithProviders(
      <Routes>
        <Route path="/estimates/:id" element={<EstimateDetailPage />} />
      </Routes>,
      '/estimates/900',
    );

  it('writes the payment progress out in words and lets a rep record a payment', async () => {
    mockApi(routes('sales'));
    view();
    expect(await screen.findByRole('heading', { name: 'Estimate #1042' })).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('₱3,000.00')).toBeInTheDocument();
    expect(screen.getByText('Awaiting review')).toBeInTheDocument();
    expect(screen.getByText('₱5,000.00')).toBeInTheDocument(); // still to collect: 10,000 - 3,000 - 2,000
    expect(screen.getByRole('link', { name: /Record payment/ })).toHaveAttribute('href', '/payments/new?estimateId=900');
    expect(screen.getByText('Installation')).toBeInTheDocument();
    expect(await screen.findByText('No payments yet')).toBeInTheDocument();
  });

  it('does not offer admins a way to record a payment (admins review, reps submit)', async () => {
    mockApi(routes('admin'));
    view();
    await screen.findByRole('heading', { name: 'Estimate #1042' });
    expect(screen.queryByRole('link', { name: /Record payment/ })).not.toBeInTheDocument();
  });
});

describe('old addresses', () => {
  it('/setup still works and keeps the QuickBooks result in the address', async () => {
    mockApi({
      'GET /api/auth/me': [200, user('admin')],
      'GET /api/auth/qbo/status?verify=true': [200, { connected: true, realmId: '1', companyName: 'Digima Inc' }],
    });
    renderWithProviders(<App />, '/setup?qbo=connected');
    expect(await screen.findByText('Digima Inc')).toBeInTheDocument();
  });

  it('/admin/:id lands on the review queue', async () => {
    mockApi({
      'GET /api/auth/me': [200, user('admin')],
      'GET /api/payments/pending': [200, { count: 0, payments: [] }],
    });
    renderWithProviders(<App />, '/admin/abc');
    expect(await screen.findByRole('heading', { name: 'Approvals' })).toBeInTheDocument();
  });
});
