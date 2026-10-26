import type { InvoiceSummary } from '../api/types';

export type InvoiceCheck =
  | { kind: 'none' } // QuickBooks has no invoice for this estimate yet
  | { kind: 'paid' } // every linked invoice is already paid
  | { kind: 'over'; room: number } // this payment is more than the invoice can still take
  | { kind: 'ok'; room: number };

/**
 * Compares a payment to what QuickBooks says is still owed. `awaiting` is money already submitted in the portal
 * and not yet approved: it will use up part of the balance before this payment does.
 * Returns null while QuickBooks has not answered (the caller shows nothing).
 */
export function checkAgainstInvoices(summary: InvoiceSummary | undefined, amount: number, awaiting = 0): InvoiceCheck | null {
  if (!summary) return null;
  if (!summary.invoices.length) return { kind: 'none' };
  if (summary.balance <= 0) return { kind: 'paid' };
  const room = Math.max(0, Math.round((summary.balance - awaiting) * 100) / 100);
  return amount > room ? { kind: 'over', room } : { kind: 'ok', room };
}
