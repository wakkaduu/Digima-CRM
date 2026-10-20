import { Route, Routes } from 'react-router';
import { render, screen } from '@testing-library/react';
import AdminPendingPage from '../../pages/AdminPendingPage';
import CustomerDetailPage from '../../pages/CustomerDetailPage';
import CustomersPage from '../../pages/CustomersPage';
import DashboardPage from '../../pages/DashboardPage';
import { MyPaymentsPage } from '../../pages/MyPaymentsPage';
import { mockApi, renderWithProviders } from '../../test/renderWithProviders';
import { StatTile } from './StatTile';

afterEach(() => vi.unstubAllGlobals());

// A fetch that never answers keeps every query in its loading state.
const hang = () => vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
const me = (role: 'sales' | 'admin') => ({ user: { id: 'u', name: 'Ana Cruz', email: 'a@x.test', role, mustChangePassword: false } });

describe('loading skeletons', () => {
  it('a stat tile shows a placeholder, not "…", while its figure loads', () => {
    render(<StatTile label="Approved" value={3} loading />);
    expect(screen.getByRole('status', { name: 'Loading Approved' })).toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it.each([
    ['Customers', <CustomersPage />, '/customers', 'Loading customers'],
    ['My payments', <MyPaymentsPage />, '/payments', 'Loading payments'],
  ])('%s shows a labelled skeleton instead of text', (_n, page, route, label) => {
    hang();
    renderWithProviders(page, route);
    expect(screen.getByRole('status', { name: label })).toBeInTheDocument();
  });

  it('the customer page shows its header, tabs and tiles as placeholders', () => {
    hang();
    renderWithProviders(
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
      </Routes>,
      '/customers/58',
    );
    expect(screen.getByRole('status', { name: 'Loading customer' })).toBeInTheDocument();
  });

  it('the approvals screen shows the queue and the review panel while loading', () => {
    hang();
    renderWithProviders(
      <Routes>
        <Route path="/payments/review/:id?" element={<AdminPendingPage />} />
      </Routes>,
      '/payments/review',
    );
    expect(screen.getByRole('status', { name: 'Loading payments' })).toBeInTheDocument();
  });

  it('dashboards show placeholders for tiles and lists, then the data', async () => {
    mockApi({ 'GET /api/auth/me': [200, me('sales')] });
    renderWithProviders(<DashboardPage />, '/dashboard');
    expect(await screen.findByRole('status', { name: 'Loading Awaiting review' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading recent payments' })).toBeInTheDocument();
  });
});
