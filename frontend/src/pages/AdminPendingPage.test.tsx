import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import AdminPendingPage from './AdminPendingPage';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const base = {
  qboEstimateId: '9',
  finalAmount: null,
  status: 'pending',
  referenceNo: 'REF12345',
  receivedOn: '2026-10-15',
  receivedBy: 'Sam',
  qboPartiallyPosted: false,
};
const payments = [
  // Deliberately out of order: the queue must show the oldest first.
  { ...base, id: 'new', customerName: 'Beta Ltd', qboEstimateNumber: '1043', amountSubmitted: '1000.00', bankDepositedTo: 'UnionBank', submittedBy: 'Tina', createdAt: hoursAgo(2), proofImageUrl: '/api/payments/new/receipt' },
  { ...base, id: 'old', customerName: 'Acme Corp', qboEstimateNumber: '1042', amountSubmitted: '2500.00', bankDepositedTo: 'BDO', submittedBy: 'Sam', createdAt: hoursAgo(50), proofImageUrl: '/api/payments/old/receipt' },
  { ...base, id: 'part', customerName: 'Gamma Inc', qboEstimateNumber: '1044', amountSubmitted: '800.00', finalAmount: '788.00', bankDepositedTo: 'BDO', submittedBy: 'Sam', createdAt: hoursAgo(5), qboPartiallyPosted: true, proofImageUrl: '/api/payments/part/receipt' },
];

function setup(extra: Record<string, [number, unknown]> = {}) {
  const fetchMock = mockApi({
    'GET /api/payments/pending': [200, { count: payments.length, payments }],
    ...extra,
  });
  renderWithProviders(
    <Routes>
      <Route path="/admin/:id?" element={<AdminPendingPage />} />
    </Routes>,
    '/admin',
  );
  return fetchMock;
}
const posts = (fn: ReturnType<typeof mockApi>) =>
  fn.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url, init]) => [String(url), init?.body ? JSON.parse(String(init.body)) : null]);

afterEach(() => vi.unstubAllGlobals());

describe('AdminPendingPage queue', () => {
  it('lists the oldest payment first and says how long each has waited', async () => {
    setup();
    const list = await screen.findByRole('list', { name: 'Payments awaiting review' });
    const names = within(list).getAllByRole('link').map((a) => a.textContent);
    expect(names[0]).toContain('Acme Corp');
    expect(names[0]).toContain('Waiting 2d');
    expect(names[1]).toContain('Gamma Inc');
    expect(names[2]).toContain('Beta Ltd');
  });

  it('filters by view, search and rep, and offers to clear', async () => {
    setup();
    await screen.findByText('Acme Corp');
    await userEvent.click(screen.getByRole('button', { name: /^Needs attention/ }));
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
    expect(screen.getByText('Gamma Inc')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^Pending/ }));
    await userEvent.type(screen.getByLabelText('Search by customer or estimate number'), '1043');
    expect(screen.getByText('Beta Ltd')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search by customer or estimate number'), 'zzz');
    expect(screen.getByText('No matching payments')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('shows an all-caught-up state without emoji when the queue is empty', async () => {
    mockApi({ 'GET /api/payments/pending': [200, { count: 0, payments: [] }] });
    renderWithProviders(
      <Routes>
        <Route path="/admin/:id?" element={<AdminPendingPage />} />
      </Routes>,
      '/admin',
    );
    expect(await screen.findByText('All caught up')).toBeInTheDocument();
  });
});

describe('AdminPendingPage review', () => {
  async function open(name: string) {
    await userEvent.click(await screen.findByRole('link', { name: new RegExp(name) }));
    return screen.findByRole('heading', { name });
  }

  it('approves through a dialog that states the consequences, then moves to the next payment', async () => {
    const fetchMock = setup({ 'POST /api/payments/approve/old': [200, { qbo: { paymentId: '77', depositId: '78', fee: 37.5, unappliedCredit: 0 } }] });
    await open('Acme Corp');

    await userEvent.click(screen.getByRole('button', { name: /− 1.5% fee/ }));
    expect(screen.getByLabelText(/Final amount/)).toHaveValue('2462.50');
    await userEvent.click(screen.getByRole('button', { name: 'Approve ₱2,462.50' }));

    const dialog = await screen.findByRole('dialog', { name: 'Approve Acme Corp?' });
    expect(dialog).toHaveTextContent('Net to BDO');
    expect(dialog).toHaveTextContent('closes the invoice for the full ₱2,500.00');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve and post ₱2,462.50' }));

    await waitFor(() => expect(posts(fetchMock)).toEqual([['/api/payments/approve/old', { finalAmount: '2462.50' }]]));
    expect(await screen.findByText(/Approved Acme Corp and posted to QuickBooks \(payment #77, deposit #78\)/)).toBeInTheDocument();
    // Auto-advance: the next payment in the queue (Gamma Inc) is now open.
    expect(await screen.findByRole('heading', { name: 'Gamma Inc' })).toBeInTheDocument();
  });

  it('does not open the dialog for a bad amount; it focuses the field instead', async () => {
    setup();
    await open('Acme Corp');
    const amount = screen.getByLabelText(/Final amount/);
    await userEvent.clear(amount);
    await userEvent.type(amount, '9999');
    expect(screen.getByText('The final amount cannot be more than the amount paid.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(amount).toHaveFocus();
  });

  it('locks the amount and explains a partly posted payment', async () => {
    setup();
    await open('Gamma Inc');
    expect(screen.getByText(/An earlier approval was only partly posted to QuickBooks/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Final amount/)).toHaveAttribute('readonly');
    expect(screen.getByLabelText(/Final amount/)).toHaveValue('788.00');
    expect(screen.getByRole('button', { name: /− 1.5% fee/ })).toBeDisabled();
  });

  it('requires a reason to reject, offers quick reasons, and sends the reason', async () => {
    const fetchMock = setup({ 'POST /api/payments/reject/old': [200, { ok: true }] });
    await open('Acme Corp');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));

    const dialog = await screen.findByRole('dialog', { name: 'Reject Acme Corp?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject payment' }));
    expect(within(dialog).getByText(/at least 3 characters/)).toBeInTheDocument();
    expect(posts(fetchMock)).toEqual([]);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Receipt is unclear' }));
    expect(within(dialog).getByLabelText('Reason for rejecting')).toHaveValue('Receipt is unclear');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject payment' }));
    await waitFor(() => expect(posts(fetchMock)).toEqual([['/api/payments/reject/old', { reason: 'Receipt is unclear' }]]));
  });

  it('keeps the dialog flow safe from the keyboard: J selects, A only opens the confirmation', async () => {
    const fetchMock = setup();
    await screen.findByText('Acme Corp');
    await userEvent.keyboard('j');
    expect(await screen.findByRole('heading', { name: 'Acme Corp' })).toBeInTheDocument();
    await userEvent.keyboard('j');
    expect(await screen.findByRole('heading', { name: 'Gamma Inc' })).toBeInTheDocument();
    await userEvent.keyboard('k');
    expect(await screen.findByRole('heading', { name: 'Acme Corp' })).toBeInTheDocument();

    await userEvent.keyboard('a');
    expect(await screen.findByRole('dialog', { name: 'Approve Acme Corp?' })).toBeInTheDocument();
    expect(posts(fetchMock)).toEqual([]);
  });

  it('ignores shortcuts while typing in a field', async () => {
    setup();
    await screen.findByText('Acme Corp');
    await userEvent.type(screen.getByLabelText('Search by customer or estimate number'), 'jar');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Acme Corp' })).not.toBeInTheDocument();
  });

  it('lists the shortcuts on ?', async () => {
    setup();
    await screen.findByText('Acme Corp');
    await userEvent.keyboard('?');
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveTextContent('Next / previous payment');
  });
});

describe('AdminPendingPage history, config and undo', () => {
  const reviewed = {
    ...base,
    id: 'h1',
    customerName: 'Delta LLC',
    qboEstimateNumber: '1001',
    amountSubmitted: '900.00',
    finalAmount: '886.50',
    status: 'rejected',
    rejectionReason: 'Receipt is unclear',
    bankDepositedTo: 'BDO',
    submittedBy: 'Sam',
    submittedById: 's1',
    createdAt: hoursAgo(80),
    reviewedBy: 'Ana',
    reviewedAt: hoursAgo(70),
    proofImageUrl: '/api/payments/h1/receipt',
    thumbUrl: '/api/payments/h1/receipt?w=800',
  };
  const detail = {
    ...reviewed,
    fee: 13.5,
    events: [
      { type: 'submitted', at: reviewed.createdAt, by: 'Sam' },
      { type: 'rejected', at: reviewed.reviewedAt, by: 'Ana', note: 'Receipt is unclear' },
    ],
    qbo: { paymentId: null, depositId: null, customerId: null },
  };

  it('lists reviewed payments from the server and opens one read-only with its audit trail', async () => {
    const fetchMock = setup({
      'GET /api/payments?status=approved%2Crejected&sort=createdAt%3Adesc&page=1&pageSize=25': [200, { items: [reviewed], total: 1, page: 1, pageSize: 25 }],
      'GET /api/payments/h1': [200, { payment: detail }],
    });
    await screen.findByText('Acme Corp');
    await userEvent.click(screen.getByRole('button', { name: 'History' }));

    const list = await screen.findByRole('list', { name: 'Reviewed payments' });
    expect(within(list).getByText('Delta LLC')).toBeInTheDocument();
    expect(within(list).getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–1 of 1')).toBeInTheDocument();

    await userEvent.click(within(list).getByRole('link', { name: /Delta LLC/ }));
    expect(await screen.findByRole('heading', { name: 'Delta LLC' })).toBeInTheDocument();
    expect(await screen.findByText('Reason: Receipt is unclear')).toBeInTheDocument();
    const history = screen.getByRole('region', { name: 'History' });
    expect(within(history).getByText('Submitted')).toBeInTheDocument();
    expect(within(history).getByText('Rejected')).toBeInTheDocument();
    expect(within(history).getByText(/Ana/)).toBeInTheDocument();
    // Read-only: no approve / reject controls on a reviewed payment.
    expect(screen.queryByRole('button', { name: /^Approve/ })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('takes the fee rate from the API config', async () => {
    setup({ 'GET /api/config/banks': [200, { banks: [], defaultFeePercent: 2 }] });
    await userEvent.click(await screen.findByRole('link', { name: /Acme Corp/ }));
    const apply = await screen.findByRole('button', { name: '− 2% fee' });
    await userEvent.click(apply);
    expect(screen.getByLabelText(/Final amount/)).toHaveValue('2450.00');
  });

  it('offers Undo after a rejection for the window the server allows, and restores the payment', async () => {
    const fetchMock = setup({
      'POST /api/payments/reject/old': [200, { ok: true, undoUntil: new Date(Date.now() + 30_000).toISOString() }],
      'POST /api/payments/reject/old/undo': [200, { ok: true }],
    });
    await userEvent.click(await screen.findByRole('link', { name: /Acme Corp/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject Acme Corp?' });
    await userEvent.type(within(dialog).getByLabelText('Reason for rejecting'), 'Wrong amount');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject payment' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(posts(fetchMock).map(([u]) => u)).toContain('/api/payments/reject/old/undo'));
    expect(await screen.findByText('Restored Acme Corp to the queue.')).toBeInTheDocument();
  });

  it('does not offer Undo when the server gave no window', async () => {
    setup({ 'POST /api/payments/reject/old': [200, { ok: true }] });
    await userEvent.click(await screen.findByRole('link', { name: /Acme Corp/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reject Acme Corp?' });
    await userEvent.type(within(dialog).getByLabelText('Reason for rejecting'), 'Wrong amount');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject payment' }));
    expect(await screen.findByText(/Rejected Acme Corp/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });
});
