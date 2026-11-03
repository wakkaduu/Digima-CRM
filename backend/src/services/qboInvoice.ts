// Creating the QuickBooks invoice for an estimate when its first payment is approved. The request function is passed
// in, so the body and the call order can be tested without QuickBooks.
import { isGone, type QboRequest } from './qboVoid';

/* eslint-disable @typescript-eslint/no-explicit-any */

const PORTAL_INVOICE_NOTE = 'Created by the payment portal';

/** True for an invoice this portal created (an invoice made by hand may legitimately differ from its estimate). */
export const isPortalInvoice = (invoice: any) => String(invoice?.PrivateNote ?? '').startsWith(PORTAL_INVOICE_NOTE);

/**
 * The portal's own invoice whose total no longer matches the estimate, or null. Checked on every approval that reuses
 * it, so an invoice that came out wrong cannot take payments just because Approve was clicked again.
 */
export function findTotalMismatch(invoices: any[], estimateTotal: number) {
    return invoices.find((i) => isPortalInvoice(i) && cents(i.TotalAmt) !== cents(estimateTotal)) ?? null;
}

/**
 * The invoice for the FULL estimate, linked back to it. Later payments are recorded against this same invoice, so it
 * stays open (partially paid) until the balance is zero. No BillEmail or SalesTermRef is sent: QuickBooks applies the
 * customer's default terms and the portal never emails the invoice.
 */
export function buildInvoiceBody(estimate: any) {
    let lines = ((estimate.Line as any[]) || [])
        // The estimate's subtotal row is derived by QuickBooks; sending it on an invoice is rejected.
        .filter((l) => l.DetailType !== 'SubTotalLineDetail')
        .map(({ Id: _id, ...line }) => line);

    // Staff tax an estimate by picking a rate under the subtotal, leaving every item line non-taxable. The estimate
    // keeps that tax, but QuickBooks recalculates an invoice from the lines and taxed nothing. So when the whole
    // estimate was taxed, the lines are marked taxable and the same rate applies to the same subtotal. When some lines
    // are already taxable, staff chose which ones carry tax, and the lines are copied as they are.
    const itemLines = lines.filter((l) => l.DetailType === 'SalesItemLineDetail');
    const taxedAsAWhole =
        estimate.TxnTaxDetail?.TxnTaxCodeRef &&
        Number(estimate.TxnTaxDetail.TotalTax) > 0 &&
        itemLines.length > 0 &&
        itemLines.every((l) => (l.SalesItemLineDetail?.TaxCodeRef?.value ?? 'NON') === 'NON');
    if (taxedAsAWhole) {
        lines = lines.map((l) =>
            l.DetailType === 'SalesItemLineDetail'
                ? { ...l, SalesItemLineDetail: { ...l.SalesItemLineDetail, TaxCodeRef: { value: 'TAX' } } }
                : l
        );
    }

    const body: Record<string, unknown> = {
        CustomerRef: estimate.CustomerRef,
        Line: lines,
        LinkedTxn: [{ TxnId: String(estimate.Id), TxnType: 'Estimate' }],
        // Marks the invoice as the portal's, so a later approval knows to check it still matches the estimate.
        PrivateNote: [`${PORTAL_INVOICE_NOTE} from estimate #${estimate.DocNumber ?? estimate.Id}.`, estimate.PrivateNote]
            .filter(Boolean)
            .join('\n'),
    };
    for (const key of ['CurrencyRef', 'ExchangeRate', 'GlobalTaxCalculation', 'CustomerMemo', 'ClassRef', 'DepartmentRef', 'BillAddr', 'ShipAddr', 'ShipFromAddr']) {
        // The addresses matter for tax: with automatic sales tax QuickBooks works the rate out from where it ships.
        if (estimate[key] != null) body[key] = estimate[key];
    }
    // The whole tax block, not only the tax code: sent with just the code, QuickBooks recalculated the tax to 0 and the
    // invoice came out lower than the estimate. With the estimate's tax lines and total it keeps the same tax.
    if (estimate.TxnTaxDetail) {
        const { TxnTaxCodeRef, TotalTax, TaxLine } = estimate.TxnTaxDetail;
        body.TxnTaxDetail = {
            ...(TxnTaxCodeRef ? { TxnTaxCodeRef } : {}),
            ...(TotalTax != null ? { TotalTax } : {}),
            ...(TaxLine?.length ? { TaxLine } : {}),
        };
    }
    return body;
}

function cents(n: unknown) {
    return Math.round(Number(n || 0) * 100);
}

/** The invoice as QuickBooks has it now, or null when it was deleted. */
async function readInvoice(request: QboRequest, invoiceId: string) {
    try {
        return (await request(`/invoice/${invoiceId}`)).Invoice;
    } catch (err) {
        if (isGone(err)) return null;
        throw err;
    }
}

/**
 * Reads the estimate and posts the invoice. `requestid` makes a retry return the same invoice, not a second one.
 * `matchesEstimate` is false when QuickBooks priced the invoice differently from the estimate (usually tax).
 */
export async function createInvoiceFromEstimate(request: QboRequest, estimateId: string) {
    const estimate = (await request(`/estimate/${estimateId}`)).Estimate;
    if (!estimate?.Line?.length) throw new Error(`Estimate ${estimateId} has no lines to invoice.`);

    const body = buildInvoiceBody(estimate);
    const post = async (requestid: string) => (await request('/invoice', { method: 'POST', params: { requestid }, body })).Invoice;

    // QuickBooks answers a repeated requestid with its saved first answer, even when that invoice has since been
    // deleted (or edited). So the answer is read back: gone means it was a replay, and a fresh requestid makes a real one.
    const posted = await post(`inv-${estimateId}`);
    let invoice = await readInvoice(request, String(posted.Id));
    if (!invoice) {
        const fresh = await post(`inv-${estimateId}-${Date.now()}`);
        invoice = (await readInvoice(request, String(fresh.Id))) ?? fresh;
    }
    if (cents(invoice.TotalAmt) !== cents(estimate.TotalAmt)) {
        // Enough to see where QuickBooks priced the two differently (in practice: tax), without the whole documents.
        console.warn(`[qbo] invoice ${invoice.DocNumber ?? invoice.Id} total differs from estimate ${estimate.DocNumber ?? estimateId}`, {
            estimate: { total: estimate.TotalAmt, tax: estimate.TxnTaxDetail, lineTax: estimate.Line?.map((l: any) => l.SalesItemLineDetail?.TaxCodeRef?.value) },
            invoice: { total: invoice.TotalAmt, tax: invoice.TxnTaxDetail, lineTax: invoice.Line?.map((l: any) => l.SalesItemLineDetail?.TaxCodeRef?.value) },
        });
    }
    return { invoice, estimateTotal: Number(estimate.TotalAmt) || 0, matchesEstimate: cents(invoice.TotalAmt) === cents(estimate.TotalAmt) };
}
