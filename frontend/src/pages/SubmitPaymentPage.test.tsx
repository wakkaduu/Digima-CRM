import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubmitPaymentPage } from './SubmitPaymentPage';
import { todayManila } from '../lib/format';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

const sales = { id: '1', name: 'Sam Reyes', email: 's@x.co', role: 'sales', mustChangePassword: false };

beforeEach(() => {
  mockApi({
    'GET /api/auth/me': [200, { user: sales }],
    'GET /api/qbo/estimates': [200, { count: 0, estimates: [] }],
    'GET /api/payments/mine': [200, { payments: [], unseenCount: 0 }],
    'GET /api/payments/receivers': [
      200,
      { receivers: [{ id: '1', name: 'Sam Reyes' }, { id: '2', name: 'Tina Lopez' }] },
    ],
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('SubmitPaymentPage', () => {
  it('has a date-received calendar (defaults to today, no future dates) and a received-by field', async () => {
    renderWithProviders(<SubmitPaymentPage />);
    const date = (await screen.findByLabelText('Date the payment was received')) as HTMLInputElement;
    expect(date.type).toBe('date');
    expect(date.value).toBe(todayManila());
    expect(date.max).toBe(todayManila());
    // A dropdown of sales employees; the logged-in sales user is preselected.
    const receivedBy = screen.getByLabelText('Who received this payment?') as HTMLSelectElement;
    expect(receivedBy.tagName).toBe('SELECT');
    await waitFor(() => expect(receivedBy.value).toBe('1'));
    const names = [...receivedBy.options].map((o) => o.textContent);
    expect(names).toEqual(['Select an employee', 'Sam Reyes', 'Tina Lopez']);
  });

  it('keeps the sections in order: estimate, date, payment details, received by, receipt', async () => {
    renderWithProviders(<SubmitPaymentPage />);
    await screen.findByLabelText('Date the payment was received');
    const legends = screen.getAllByRole('group').map((g) => g.querySelector('legend')?.textContent);
    expect(legends).toEqual(['1. Estimate', '2. Date received', '3. Payment details', '4. Received by', '5. Receipt']);
  });

  it('hides the reference number for cash only', async () => {
    renderWithProviders(<SubmitPaymentPage />);
    const mode = await screen.findByLabelText(/Mode of payment/);
    expect(screen.getByLabelText(/Bank reference number/)).toBeInTheDocument();
    await userEvent.selectOptions(mode, 'Cash');
    expect(screen.queryByLabelText(/Bank reference number/)).not.toBeInTheDocument();
    await userEvent.selectOptions(mode, 'BDO');
    expect(screen.getByLabelText(/Bank reference number/)).toBeInTheDocument();
  });
});
