import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubmitPaymentPage } from './SubmitPaymentPage';
import { todayManila } from '../lib/format';
import { mockApi, renderWithProviders } from '../test/renderWithProviders';

const sales = { id: '1', name: 'Sam Reyes', email: 's@x.co', role: 'sales', mustChangePassword: false };

const estimate = {
  id: '9',
  docNumber: '1042',
  customerName: 'Acme Corp',
  totalAmount: 10000,
  txnDate: '2026-10-01',
  expirationDate: null,
  status: 'Accepted',
  email: null,
  pendingAmount: 0,
  approvedAmount: 0,
};
const baseRoutes: Record<string, [number, unknown]> = {
  'GET /api/auth/me': [200, { user: sales }],
  'GET /api/qbo/estimates?limit=1': [200, { count: 0, total: 0, estimates: [] }],
  'GET /api/payments/recent-estimates': [200, { estimates: [] }],
  'GET /api/payments/mine': [200, { payments: [], unseenCount: 0 }],
  'GET /api/payments/receivers': [
    200,
    { receivers: [{ id: '1', name: 'Sam Reyes' }, { id: '2', name: 'Tina Lopez' }] },
  ],
};

beforeEach(() => {
  mockApi(baseRoutes);
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

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

  it('summarises the defaults in one row instead of two full fields', async () => {
    renderWithProviders(<SubmitPaymentPage />);
    expect(await screen.findByText('Received today by you')).toBeInTheDocument();
    expect(screen.getAllByRole('group').map((g) => g.querySelector('legend')?.textContent)).toEqual(['Paid via', 'Receipt']);
  });

  it('preselects the estimate when arriving from "Record payment" on an estimate', async () => {
    mockApi({
      ...baseRoutes,
      'GET /api/estimates/9': [200, { estimate: { ...estimate, customerId: '58', lines: [], memo: null, linkedInvoiceIds: [] } }],
    });
    renderWithProviders(<SubmitPaymentPage />, '/payments/new?estimateId=9');
    expect((await screen.findAllByText('Acme Corp')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Change estimate' })).toBeInTheDocument();
  });

  describe('invoice check against QuickBooks', () => {
    const open = (invoices: unknown) => {
      mockApi({
        ...baseRoutes,
        'GET /api/estimates/9': [200, { estimate: { ...estimate, customerId: '58', lines: [], memo: null, linkedInvoiceIds: [] } }],
        'GET /api/estimates/9/invoices': [200, invoices],
      });
      renderWithProviders(<SubmitPaymentPage />, '/payments/new?estimateId=9');
    };
    const summary = (balance: number) => ({
      invoices: [{ id: '5', docNumber: '5001', txnDate: '2026-10-02', dueDate: null, total: 10000, balance }],
      total: 10000,
      balance,
      paid: 10000 - balance,
    });

    it('tells the rep when no invoice exists yet, but lets them carry on', async () => {
      open({ invoices: [], total: 0, balance: 0, paid: 0 });
      expect(await screen.findByText(/QuickBooks has no invoice for this estimate yet/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeEnabled();
    });

    it('warns when the amount is more than the invoice can still take', async () => {
      open(summary(400));
      await userEvent.type(await screen.findByLabelText(/Amount received/), '500');
      expect(await screen.findByText(/more than the ₱400.00 the invoice can still take/)).toBeInTheDocument();
    });

    it('stays quiet when the amount fits', async () => {
      open(summary(400));
      await userEvent.type(await screen.findByLabelText(/Amount received/), '300');
      await waitFor(() => expect(screen.queryByText(/the invoice can still take/)).not.toBeInTheDocument());
    });

    it('warns when the invoice is already paid', async () => {
      open(summary(0));
      expect(await screen.findByText(/already fully paid in QuickBooks/)).toBeInTheDocument();
    });
  });

  it('hides the reference number for cash only', async () => {
    renderWithProviders(<SubmitPaymentPage />);
    await screen.findByRole('radio', { name: 'Cash' });
    expect(screen.getByLabelText(/Bank reference number/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Cash' }));
    expect(screen.queryByLabelText(/Bank reference number/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'BDO' }));
    expect(screen.getByLabelText(/Bank reference number/)).toBeInTheDocument();
  });

  it('preselects the bank used last time', async () => {
    localStorage.setItem('digima.lastBank.1', JSON.stringify('UnionBank'));
    renderWithProviders(<SubmitPaymentPage />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'UnionBank' })).toBeChecked());
  });

  it('echoes the amount formatted and tidies it on blur', async () => {
    renderWithProviders(<SubmitPaymentPage />);
    const amount = await screen.findByLabelText(/Amount received/);
    await userEvent.type(amount, '₱ 2500');
    expect(screen.getByText('₱2,500.00')).toBeInTheDocument();
    await userEvent.tab();
    expect(amount).toHaveValue('2,500.00');
  });

  it('keeps the submit button enabled and explains what is missing instead', async () => {
    renderWithProviders(<SubmitPaymentPage />);
    const button = await screen.findByRole('button', { name: 'Submit for approval' });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(await screen.findByText(/Search for the customer or estimate number/)).toBeInTheDocument();
    expect(screen.getByText(/Enter an amount greater than 0/)).toBeInTheDocument();
    expect(screen.getByText('Select how the payment was received.')).toBeInTheDocument();
    expect(screen.getByText(/Attach a screenshot or photo/)).toBeInTheDocument();
  });

  it('restores a saved draft and lets the user discard it', async () => {
    localStorage.setItem(
      'digima.draft.1',
      JSON.stringify({ estimate: null, receivedOn: todayManila(), receivedById: null, amount: '1,200.00', bank: 'BDO', refNo: 'ABC12345' }),
    );
    renderWithProviders(<SubmitPaymentPage />);
    expect(await screen.findByText(/Draft restored/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount received/)).toHaveValue('1,200.00');
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByLabelText(/Amount received/)).toHaveValue('');
    expect(localStorage.getItem('digima.draft.1')).toBeNull();
  });

  it('offers the modes of payment the API lists, not a hard-coded set', async () => {
    mockApi({
      ...baseRoutes,
      'GET /api/config/banks': [
        200,
        {
          banks: [
            { id: 'Maya', key: 'Maya', label: 'Maya', referenceNumber: 'optional' },
            { id: 'Petty cash', key: 'PettyCash', label: 'Petty cash', referenceNumber: 'none' },
          ],
          defaultFeePercent: 2,
        },
      ],
    });
    renderWithProviders(<SubmitPaymentPage />);
    expect(await screen.findByRole('radio', { name: 'Maya' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'BDO' })).not.toBeInTheDocument();
    // "no reference number" comes from the API too, not from the word Cash.
    await userEvent.click(screen.getByRole('radio', { name: 'Petty cash' }));
    expect(screen.queryByLabelText(/Bank reference number/)).not.toBeInTheDocument();
  });

  it('searches estimates on the server and lists recent ones first', async () => {
    const fetchMock = mockApi({
      ...baseRoutes,
      'GET /api/payments/recent-estimates': [200, { estimates: [estimate] }],
      'GET /api/qbo/estimates?q=beta&limit=30': [200, { count: 1, total: 1, estimates: [{ ...estimate, id: '12', docNumber: '1050', customerName: 'Beta Ltd' }] }],
    });
    renderWithProviders(<SubmitPaymentPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Customer or estimate' }));
    const sheet = await screen.findByRole('dialog', { name: 'Choose an estimate' });
    expect(await within(sheet).findByText('Recent estimates')).toBeInTheDocument();
    expect(within(sheet).getByText(/Acme Corp/)).toBeInTheDocument();

    await userEvent.type(within(sheet).getByLabelText('Customer name or estimate number'), 'beta');
    expect(await within(sheet).findByText(/Beta Ltd/)).toBeInTheDocument();
    expect(within(sheet).getByText('1 found.')).toBeInTheDocument();

    // Never the whole list: only the one-row probe and the capped search.
    const urls = fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/api/qbo/estimates'));
    expect(urls.sort()).toEqual(['/api/qbo/estimates?limit=1', '/api/qbo/estimates?q=beta&limit=30']);
  });
});

describe('SubmitPaymentPage retry safety', () => {
  const sent: Record<string, string>[] = [];
  const outcomes: ('network' | 'ok')[] = [];

  class FakeXhr {
    upload = {};
    onload?: () => void;
    onerror?: () => void;
    status = 201;
    statusText = '';
    response: unknown = { payment: { id: 'p1', status: 'pending' } };
    headers: Record<string, string> = {};
    open() {}
    abort() {}
    setRequestHeader(k: string, v: string) {
      this.headers[k] = v;
    }
    send() {
      sent.push(this.headers);
      queueMicrotask(() => (outcomes.shift() === 'ok' ? this.onload?.() : this.onerror?.()));
    }
  }

  async function fillForm() {
    await userEvent.click(await screen.findByRole('button', { name: 'Customer or estimate' }));
    const sheet = await screen.findByRole('dialog', { name: 'Choose an estimate' });
    await userEvent.click(await within(sheet).findByRole('button', { name: /Acme Corp/ }));
    await userEvent.type(await screen.findByLabelText(/Amount received/), '2500');
    await userEvent.click(screen.getByRole('radio', { name: 'BDO' }));
    const file = new File([new Uint8Array(2048)], 'receipt.png', { type: 'image/png' });
    await userEvent.upload(document.querySelectorAll<HTMLInputElement>('input[type=file]')[0]!, file);
    await screen.findByText(/receipt\.png/);
  }

  beforeEach(() => {
    sent.length = 0;
    outcomes.length = 0;
    mockApi({
      ...baseRoutes,
      'GET /api/payments/recent-estimates': [200, { estimates: [estimate] }],
    });
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  });

  it('reuses the Idempotency-Key when retrying the same payment, and issues a new one if it changes', async () => {
    outcomes.push('network', 'network', 'ok');
    renderWithProviders(<SubmitPaymentPage />);
    await fillForm();

    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[0]!['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent[1]!['Idempotency-Key']).toBe(sent[0]!['Idempotency-Key']); // a lost response cannot double-post

    // Edit the amount: that is a different payment, so it must not be swallowed by the earlier key.
    const amount = screen.getByLabelText(/Amount received/);
    await userEvent.clear(amount);
    await userEvent.type(amount, '3000');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    await waitFor(() => expect(sent).toHaveLength(3));
    expect(sent[2]!['Idempotency-Key']).not.toBe(sent[0]!['Idempotency-Key']);
    expect(await screen.findByRole('heading', { name: 'Submitted' })).toBeInTheDocument();
  });
});
