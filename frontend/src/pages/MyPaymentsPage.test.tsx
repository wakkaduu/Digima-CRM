import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyPaymentsPage } from './MyPaymentsPage';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

const sales = { id: '1', name: 'Sam', email: 's@x.co', role: 'sales', mustChangePassword: false };
const base = {
  qboEstimateId: '9',
  amountSubmitted: '1000.00',
  finalAmount: null,
  bankDepositedTo: 'BDO',
  receivedOn: '2026-10-15',
  receivedBy: 'Sam',
  createdAt: '2026-10-15T08:00:00Z',
  rejectionReason: null,
  unseen: false,
};
const payments = [
  { ...base, id: 'a', customerName: 'Acme Corp', qboEstimateNumber: '1042', status: 'pending' },
  { ...base, id: 'b', customerName: 'Beta Ltd', qboEstimateNumber: '1043', status: 'rejected', rejectionReason: 'Blurry receipt', unseen: true },
];

afterEach(() => vi.unstubAllGlobals());

describe('MyPaymentsPage', () => {
  beforeEach(() =>
    mockApi({
      'GET /api/auth/me': [200, { user: sales }],
      'GET /api/payments/mine': [200, { payments, unseenCount: 1 }],
    }),
  );

  it('filters by status tab and shows the rejection reason', async () => {
    renderWithProviders(<MyPaymentsPage />);
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Rejected \d/ }));
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Ltd')).toBeInTheDocument();
    expect(screen.getByText(/Reason: Blurry receipt/)).toBeInTheDocument();
  });

  it('searches by customer and offers to clear when nothing matches', async () => {
    renderWithProviders(<MyPaymentsPage />);
    await screen.findByText('Acme Corp');
    await userEvent.type(screen.getByLabelText(/Search by customer/), 'zzz');
    expect(screen.getByText('No matching payments')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('opens a detail sheet for a payment', async () => {
    renderWithProviders(<MyPaymentsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Acme Corp/ }));
    const dialog = screen.getByRole('dialog', { name: 'Estimate #1042' });
    expect(within(dialog).getByRole('link', { name: /View receipt/ })).toHaveAttribute('href', '/api/payments/a/receipt');
  });

  it('tells the user how many reviews are new', async () => {
    renderWithProviders(<MyPaymentsPage />);
    expect(await screen.findByText(/1 of your submissions has been reviewed/)).toBeInTheDocument();
  });

  it('opens straight into the filtered view from a shared link', async () => {
    renderWithProviders(<MyPaymentsPage />, '/?tab=rejected&q=beta');
    expect(await screen.findByText('Beta Ltd')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Rejected/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Search: beta')).toBeInTheDocument();
  });
});
