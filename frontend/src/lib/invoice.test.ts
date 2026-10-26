import { checkAgainstInvoices } from './invoice';
import type { InvoiceSummary } from '../api/types';

const inv = (balance: number, total = 1000): InvoiceSummary => ({
  invoices: [{ id: '1', docNumber: '5001', txnDate: '2026-10-01', dueDate: null, total, balance }],
  total,
  balance,
  paid: total - balance,
});

describe('checkAgainstInvoices', () => {
  it('shows nothing until QuickBooks has answered', () => {
    expect(checkAgainstInvoices(undefined, 100)).toBeNull();
  });

  it('notices an estimate with no invoice yet', () => {
    expect(checkAgainstInvoices({ invoices: [], total: 0, balance: 0, paid: 0 }, 100)).toEqual({ kind: 'none' });
  });

  it('notices an invoice that is already paid', () => {
    expect(checkAgainstInvoices(inv(0), 100)).toEqual({ kind: 'paid' });
  });

  it('accepts a payment up to the balance, and flags one above it', () => {
    expect(checkAgainstInvoices(inv(400), 400)).toEqual({ kind: 'ok', room: 400 });
    expect(checkAgainstInvoices(inv(400), 400.01)).toEqual({ kind: 'over', room: 400 });
  });

  it('counts payments still awaiting review against the balance', () => {
    expect(checkAgainstInvoices(inv(400), 300, 200)).toEqual({ kind: 'over', room: 200 });
    expect(checkAgainstInvoices(inv(400), 200, 200)).toEqual({ kind: 'ok', room: 200 });
  });
});
