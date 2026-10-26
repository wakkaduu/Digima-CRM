// Pure money logic for posting an approved payment to QuickBooks (no I/O, so it is unit-tested directly).

/* eslint-disable @typescript-eslint/no-explicit-any */

// Money is handled in integer centavos to avoid floating point errors.
export const toCents = (v: unknown) => Math.round(Number(String(v)) * 100);
export const fromCents = (c: number) => c / 100;

/** Manila's calendar date as YYYY-MM-DD. */
export const manilaDate = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

/**
 * The date QuickBooks books the payment on: the day the money was received (as entered by Sales),
 * not the day it was approved. Older rows have no received date, so they fall back to today.
 */
export function postingDate(receivedOn: Date | null | undefined, now = new Date()) {
    // `received_on` is a Postgres DATE, which Prisma returns as that day at 00:00 UTC.
    return receivedOn ? receivedOn.toISOString().slice(0, 10) : manilaDate(now);
}

/** Spread the gross amount over open invoices (oldest first); anything left stays as unapplied credit. */
export function allocate(invoices: any[], grossCents: number) {
    let remaining = grossCents;
    const lines: unknown[] = [];
    for (const inv of invoices) {
        if (remaining <= 0) break;
        const apply = Math.min(remaining, toCents(inv.Balance));
        if (apply <= 0) continue;
        lines.push({
            Amount: fromCents(apply),
            LinkedTxn: [{ TxnId: inv.Id, TxnType: 'Invoice' }],
        });
        remaining -= apply;
    }
    return { lines, unappliedCents: remaining };
}

/** QBO Payment for the gross amount. No fee: straight into the bank. Fee: park in Undeposited Funds, then Deposit. */
export function buildPaymentBody({
    customerRef,
    grossCents,
    feeCents,
    bankAccountId,
    txnDate,
    note,
    referenceNo,
    lines,
}: {
    customerRef: unknown;
    grossCents: number;
    feeCents: number;
    bankAccountId: string;
    txnDate: string;
    note: string;
    referenceNo?: string | null;
    lines: unknown[];
}) {
    return {
        CustomerRef: customerRef,
        TotalAmt: fromCents(grossCents),
        TxnDate: txnDate,
        PrivateNote: note,
        Line: lines,
        ...(feeCents === 0 ? { DepositToAccountRef: { value: bankAccountId } } : {}),
        ...(referenceNo ? { PaymentRefNum: referenceNo.slice(0, 21) } : {}),
    };
}

/** QBO Deposit: the gross payment in, the fee out as a negative expense line, so the bank shows the net. */
export function buildDepositBody({
    paymentId,
    grossCents,
    feeCents,
    bankAccountId,
    feeAccountId,
    txnDate,
    note,
}: {
    paymentId: string;
    grossCents: number;
    feeCents: number;
    bankAccountId: string;
    feeAccountId: string;
    txnDate: string;
    note: string;
}) {
    return {
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
                DepositLineDetail: { AccountRef: { value: feeAccountId } },
            },
        ],
    };
}
