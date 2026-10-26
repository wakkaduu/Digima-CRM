import type { Payment } from '@prisma/client';
import env from '../config/env';
import * as paymentModel from '../models/payment.model';
import * as qbo from './qbo.service';
import HttpError from '../utils/HttpError';
import { allocate, buildDepositBody, buildPaymentBody, fromCents, postingDate, toCents } from './qboPosting';
import { voidPosted } from './qboVoid';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Prisma enum key -> QBO account ID (the account the money actually landed in)
const DEPOSIT_ACCOUNT_BY_BANK: Record<string, string | undefined> = {
    BDO: env.QBO_DEPOSIT_ACCOUNT_BDO,
    UnionBank: env.QBO_DEPOSIT_ACCOUNT_UNIONBANK,
    Digima: env.QBO_DEPOSIT_ACCOUNT_DIGIMA,
    HappyMed: env.QBO_DEPOSIT_ACCOUNT_HAPPYMED,
    Cash: env.QBO_DEPOSIT_ACCOUNT_CASH,
};

export { toCents, fromCents };

/* Every invoice linked to the estimate (any balance), oldest first. Empty when nothing was invoiced yet. */
async function getLinkedInvoices(estimateId: string) {
    const estimate = await qbo.getEstimateById(estimateId);
    const invoiceIds = new Set(estimate.linkedInvoiceIds);

    // Fallback: the invoice also points back to its estimate via LinkedTxn.
    if (!invoiceIds.size && estimate.customerId && /^\d+$/.test(estimate.customerId)) {
        const json = await qbo.runQuery(
            `select * from Invoice where CustomerRef = '${estimate.customerId}' MAXRESULTS 1000`
        );
        const customerInvoices = (json.QueryResponse && json.QueryResponse.Invoice) || [];
        for (const inv of customerInvoices as any[]) {
            const linkedToEstimate = (inv.LinkedTxn || []).some(
                (t: any) => t.TxnType === 'Estimate' && String(t.TxnId) === String(estimateId)
            );
            if (linkedToEstimate) invoiceIds.add(inv.Id);
        }
    }

    const invoices: any[] = [];
    for (const invoiceId of invoiceIds) {
        const json = await qbo.qboRequest(`/invoice/${invoiceId}`);
        invoices.push(json.Invoice);
    }
    return invoices.sort((a: any, b: any) => String(a.TxnDate).localeCompare(String(b.TxnDate)));
}

export interface InvoiceSummary {
    invoices: { id: string; docNumber: string | null; txnDate: string; dueDate: string | null; total: number; balance: number }[];
    /** Sum of the linked invoices. */
    total: number;
    /** Still owed in QuickBooks across the linked invoices. */
    balance: number;
    /** Total minus balance, as QuickBooks sees it (includes payments recorded outside the portal). */
    paid: number;
}

/** What QuickBooks says about the invoices created from an estimate. */
export async function getInvoiceSummary(estimateId: string): Promise<InvoiceSummary> {
    const invoices = (await getLinkedInvoices(estimateId)).map((i: any) => ({
        id: String(i.Id),
        docNumber: i.DocNumber ?? null,
        txnDate: i.TxnDate,
        dueDate: i.DueDate ?? null,
        total: Number(i.TotalAmt) || 0,
        balance: Number(i.Balance) || 0,
    }));
    const cents = (pick: (i: (typeof invoices)[number]) => number) => invoices.reduce((n, i) => n + toCents(pick(i)), 0);
    const total = cents((i) => i.total);
    const balance = cents((i) => i.balance);
    return { invoices, total: fromCents(total), balance: fromCents(balance), paid: fromCents(total - balance) };
}

/* Invoices linked to the estimate that still have a balance (oldest first). */
async function getOpenInvoices(estimateId: string) {
    const invoices = await getLinkedInvoices(estimateId);

    if (!invoices.length) {
        throw new HttpError(
            409,
            'No invoice is linked to this estimate yet. In QuickBooks, open the estimate and choose "Create invoice", then approve again.',
            { code: 'NO_INVOICE' }
        );
    }

    const open = invoices.filter((i: any) => toCents(i.Balance) > 0);
    if (!open.length) {
        throw new HttpError(
            409,
            'The invoice linked to this estimate is already fully paid in QuickBooks.',
            { code: 'INVOICE_PAID' }
        );
    }
    return open;
}

/*
 * Pushes an approved payment to QBO. Resumable: IDs are saved to the DB as soon as
 * each QBO object is created, so a retry skips what already exists.
 */
export async function pushToQbo({
    payment,
    finalCents,
    approver,
}: {
    payment: Payment;
    finalCents: number;
    approver: string;
}) {
    const grossCents = toCents(payment.amountSubmitted);
    const feeCents = grossCents - finalCents;

    const bankAccountId = DEPOSIT_ACCOUNT_BY_BANK[payment.bankDepositedTo];
    if (!bankAccountId) {
        throw new HttpError(
            422,
            `No QuickBooks deposit account is configured for ${payment.bankDepositedTo}. Set it in .env.`
        );
    }
    if (feeCents > 0 && !env.QBO_BANK_FEE_ACCOUNT_ID) {
        throw new HttpError(422, 'QBO_BANK_FEE_ACCOUNT_ID is not set in .env, so the bank fee cannot be recorded.');
    }

    let paymentId = payment.qboPaymentId;
    let depositId = payment.qboDepositId;
    let unappliedCents = 0;
    const txnDate = postingDate(payment.receivedOn);
    const note =
        `Portal payment ${payment.id} | ${payment.bankDepositedTo} | ` +
        `submitted by ${payment.submittedBy} | approved by ${approver}`;

    /* Step 1: Payment (gross) applied to the invoice(s) */
    if (!paymentId) {
        const invoices = await getOpenInvoices(payment.qboEstimateId);
        const { lines, unappliedCents: leftover } = allocate(invoices, grossCents);
        unappliedCents = leftover;

        const body = buildPaymentBody({
            customerRef: invoices[0].CustomerRef,
            grossCents,
            feeCents,
            bankAccountId,
            txnDate,
            note,
            referenceNo: payment.referenceNo,
            lines,
        });

        const json = await qbo.qboRequest('/payment', {
            method: 'POST',
            params: { requestid: `pay-${payment.id}` },
            body,
        });
        paymentId = json.Payment.Id;
        await paymentModel.update(payment.id, { qboPaymentId: paymentId });
    }

    /* Step 2: Deposit (net into bank, fee as a negative expense line) */
    if (feeCents > 0 && !depositId) {
        const body = buildDepositBody({
            paymentId: paymentId!,
            grossCents,
            feeCents,
            bankAccountId,
            feeAccountId: env.QBO_BANK_FEE_ACCOUNT_ID!,
            txnDate,
            note,
        });

        const json = await qbo.qboRequest('/deposit', {
            method: 'POST',
            params: { requestid: `dep-${payment.id}` },
            body,
        });
        depositId = json.Deposit.Id;
        await paymentModel.update(payment.id, { qboDepositId: depositId });
    }

    return { paymentId, depositId, feeCents, unappliedCents };
}

/* Reverses an approved payment in QuickBooks (see qboVoid.ts). */
export async function voidInQbo(payment: Payment) {
    if (!payment.qboPaymentId) throw new HttpError(409, 'This payment was never posted to QuickBooks, so there is nothing to void.');
    await voidPosted(qbo.qboRequest, { paymentId: payment.qboPaymentId, depositId: payment.qboDepositId });
}

/* Helper to find the account IDs you need for .env */
export async function listAccounts() {
    const json = await qbo.runQuery('select * from Account MAXRESULTS 1000');
    const all = (json.QueryResponse && json.QueryResponse.Account) || [];
    const wanted = new Set(['Bank', 'Expense', 'Other Expense', 'Other Current Asset']);
    return all
        .filter((a: any) => a.Active !== false && wanted.has(a.AccountType))
        .map((a: any) => ({ id: a.Id, name: a.Name, type: a.AccountType, subType: a.AccountSubType }))
        .sort((a: { type: string; name: string }, b: { type: string; name: string }) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}
