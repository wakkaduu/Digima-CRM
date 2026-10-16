const env = require('../config/env');
const { prisma } = require('../config/prisma');
const qbo = require('./qbo.service');
const { HttpError } = require('../middleware/errorHandler');

// Prisma enum key -> QBO account ID (the account the money actually landed in)
const DEPOSIT_ACCOUNT_BY_BANK = {
    BDO: env.QBO_DEPOSIT_ACCOUNT_BDO,
    UnionBank: env.QBO_DEPOSIT_ACCOUNT_UNIONBANK,
    Digima: env.QBO_DEPOSIT_ACCOUNT_DIGIMA,
    HappyMeal: env.QBO_DEPOSIT_ACCOUNT_HAPPYMEAL,
};

// Money is handled in integer centavos to avoid floating point errors.
const toCents = (v) => Math.round(Number(String(v)) * 100);
const fromCents = (c) => c / 100;

const todayManila = () =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); // YYYY-MM-DD

/* Invoices linked to the estimate that still have a balance (oldest first). */
async function getOpenInvoices(estimateId) {
    const estimate = await qbo.getEstimateById(estimateId);
    const invoiceIds = new Set(estimate.linkedInvoiceIds);

    // Fallback: the invoice also points back to its estimate via LinkedTxn.
    if (!invoiceIds.size && estimate.customerId) {
        const json = await qbo.runQuery(
            `select * from Invoice where CustomerRef = '${estimate.customerId}' MAXRESULTS 1000`
        );
        const customerInvoices = (json.QueryResponse && json.QueryResponse.Invoice) || [];
        for (const inv of customerInvoices) {
            const linkedToEstimate = (inv.LinkedTxn || []).some(
                (t) => t.TxnType === 'Estimate' && String(t.TxnId) === String(estimateId)
            );
            if (linkedToEstimate) invoiceIds.add(inv.Id);
        }
    }

    if (!invoiceIds.size) {
        throw new HttpError(
            409,
            'No invoice is linked to this estimate yet. In QuickBooks, open the estimate and choose "Create invoice", then approve again.',
            { code: 'NO_INVOICE' }
        );
    }

    const invoices = [];
    for (const invoiceId of invoiceIds) {
        const json = await qbo.qboRequest(`/invoice/${invoiceId}`);
        invoices.push(json.Invoice);
    }

    const open = invoices
        .filter((i) => toCents(i.Balance) > 0)
        .sort((a, b) => String(a.TxnDate).localeCompare(String(b.TxnDate)));

    if (!open.length) {
        throw new HttpError(
            409,
            'The invoice linked to this estimate is already fully paid in QuickBooks.',
            { code: 'INVOICE_PAID' }
        );
    }
    return open;
}

/* Spread the gross amount over open invoices; anything left stays as unapplied credit. */
function allocate(invoices, grossCents) {
    let remaining = grossCents;
    const lines = [];
    for (const inv of invoices) {
        if (remaining <= 0) break;
        const apply = Math.min(remaining, toCents(inv.Balance));
        lines.push({
            Amount: fromCents(apply),
            LinkedTxn: [{ TxnId: inv.Id, TxnType: 'Invoice' }],
        });
        remaining -= apply;
    }
    return { lines, unappliedCents: remaining };
}

/*
 * Pushes an approved payment to QBO. Resumable: IDs are saved to the DB as soon as
 * each QBO object is created, so a retry skips what already exists.
 */
async function pushToQbo({ payment, finalCents, approver }) {
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
    const txnDate = todayManila();
    const note =
        `Portal payment ${payment.id} | ${payment.bankDepositedTo} | ` +
        `submitted by ${payment.submittedBy} | approved by ${approver}`;

    /* Step 1: Payment (gross) applied to the invoice(s) */
    if (!paymentId) {
        const invoices = await getOpenInvoices(payment.qboEstimateId);
        const { lines, unappliedCents: leftover } = allocate(invoices, grossCents);
        unappliedCents = leftover;

        const body = {
            CustomerRef: invoices[0].CustomerRef,
            TotalAmt: fromCents(grossCents),
            TxnDate: txnDate,
            PrivateNote: note,
            Line: lines,
            // No fee: money goes straight to the bank. Fee: park in Undeposited Funds, then Deposit.
            ...(feeCents === 0 ? { DepositToAccountRef: { value: bankAccountId } } : {}),
            ...(payment.referenceNo ? { PaymentRefNum: payment.referenceNo.slice(0, 21) } : {}),
        };

        const json = await qbo.qboRequest('/payment', {
            method: 'POST',
            params: { requestid: `pay-${payment.id}` },
            body,
        });
        paymentId = json.Payment.Id;
        await prisma.payment.update({ where: { id: payment.id }, data: { qboPaymentId: paymentId } });
    }

    /* Step 2: Deposit (net into bank, fee as a negative expense line) */
    if (feeCents > 0 && !depositId) {
        const body = {
            DepositToAccountRef: { value: bankAccountId },
            TxnDate: txnDate,
            PrivateNote: note,
            Line: [
                {
                    Amount: fromCents(grossCents),
                    LinkedTxn: [{ TxnId: paymentId, TxnType: 'Payment', TxnLineId: '0' }],
                },
                {
                    Amount: -fromCents(feeCents),
                    DetailType: 'DepositLineDetail',
                    Description: 'Bank / QR fee',
                    DepositLineDetail: { AccountRef: { value: env.QBO_BANK_FEE_ACCOUNT_ID } },
                },
            ],
        };

        const json = await qbo.qboRequest('/deposit', {
            method: 'POST',
            params: { requestid: `dep-${payment.id}` },
            body,
        });
        depositId = json.Deposit.Id;
        await prisma.payment.update({ where: { id: payment.id }, data: { qboDepositId: depositId } });
    }

    return { paymentId, depositId, feeCents, unappliedCents };
}

/* Helper to find the account IDs you need for .env */
async function listAccounts() {
    const json = await qbo.runQuery('select * from Account MAXRESULTS 1000');
    const all = (json.QueryResponse && json.QueryResponse.Account) || [];
    const wanted = new Set(['Bank', 'Expense', 'Other Expense', 'Other Current Asset']);
    return all
        .filter((a) => a.Active !== false && wanted.has(a.AccountType))
        .map((a) => ({ id: a.Id, name: a.Name, type: a.AccountType, subType: a.AccountSubType }))
        .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

module.exports = { pushToQbo, listAccounts, toCents, fromCents };