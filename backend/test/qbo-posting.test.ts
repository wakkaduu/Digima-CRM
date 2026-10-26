// The money logic behind "approve": allocation, dates and the bodies sent to QuickBooks. No network, no database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { allocate, buildDepositBody, buildPaymentBody, fromCents, manilaDate, postingDate, toCents } from '../src/services/qboPosting';

const inv = (Id: string, Balance: string) => ({ Id, Balance, TxnDate: '2026-10-01' });

test('cents: decimal strings convert without float drift', () => {
    assert.equal(toCents('0.1') + toCents('0.2'), toCents('0.3'));
    assert.equal(toCents('24625.00'), 2462500);
    assert.equal(toCents('1,000'.replace(/,/g, '')), 100000);
    assert.equal(fromCents(2462500), 24625);
});

test('allocate: a partial payment goes to the oldest invoice and nothing is left over', () => {
    const { lines, unappliedCents } = allocate([inv('1', '1000.00'), inv('2', '500.00')], toCents('400'));
    assert.deepEqual(lines, [{ Amount: 400, LinkedTxn: [{ TxnId: '1', TxnType: 'Invoice' }] }]);
    assert.equal(unappliedCents, 0);
});

test('allocate: a payment that clears the first invoice spills into the next', () => {
    const { lines, unappliedCents } = allocate([inv('1', '1000.00'), inv('2', '500.00')], toCents('1200'));
    assert.deepEqual(
        lines.map((l: any) => [l.LinkedTxn[0].TxnId, l.Amount]),
        [['1', 1000], ['2', 200]]
    );
    assert.equal(unappliedCents, 0);
});

test('allocate: money beyond every balance stays as unapplied credit', () => {
    const { lines, unappliedCents } = allocate([inv('1', '300.00')], toCents('500'));
    assert.equal(lines.length, 1);
    assert.equal(unappliedCents, 20000);
});

test('allocate: applied lines plus leftover always add up to the amount paid', () => {
    for (const [balances, paid] of [[['99.99', '0.01'], '100'], [['10.10', '20.20', '30.30'], '45.45'], [['5'], '0.01']] as const) {
        const { lines, unappliedCents } = allocate(balances.map((b, i) => inv(String(i), b)), toCents(paid));
        const applied = lines.reduce<number>((n, l: any) => n + toCents(l.Amount), 0);
        assert.equal(applied + unappliedCents, toCents(paid));
    }
});

test('allocate: invoices with nothing owing are skipped', () => {
    const { lines } = allocate([inv('1', '0.00'), inv('2', '50.00')], toCents('50'));
    assert.deepEqual(lines.map((l: any) => l.LinkedTxn[0].TxnId), ['2']);
});

test('posting date: the day the money was received, not the day it was approved', () => {
    const approvedOn = new Date('2026-10-26T03:00:00Z'); // 26 Oct in Manila
    assert.equal(postingDate(new Date('2026-10-20T00:00:00Z'), approvedOn), '2026-10-20');
    // Rows from before the received date existed fall back to today in Manila.
    assert.equal(postingDate(null, approvedOn), '2026-10-26');
});

test('posting date: Manila is a day ahead of UTC late in the evening', () => {
    assert.equal(manilaDate(new Date('2026-10-25T17:30:00Z')), '2026-10-26');
});

test('payment body: no fee goes straight to the bank, with the reference number trimmed to what QuickBooks allows', () => {
    const body = buildPaymentBody({
        customerRef: { value: '5' },
        grossCents: 250000,
        feeCents: 0,
        bankAccountId: '35',
        txnDate: '2026-10-20',
        note: 'n',
        referenceNo: 'R'.repeat(40),
        lines: [],
    });
    assert.deepEqual(body.DepositToAccountRef, { value: '35' });
    assert.equal(body.TotalAmt, 2500);
    assert.equal(body.TxnDate, '2026-10-20');
    assert.equal(body.PaymentRefNum?.length, 21);
});

test('payment body: with a fee the money waits in Undeposited Funds for the deposit', () => {
    const body = buildPaymentBody({
        customerRef: { value: '5' },
        grossCents: 250000,
        feeCents: 3750,
        bankAccountId: '35',
        txnDate: '2026-10-20',
        note: 'n',
        lines: [],
    });
    assert.equal('DepositToAccountRef' in body, false);
    assert.equal('PaymentRefNum' in body, false);
});

test('deposit body: gross in, fee out, so the bank shows the net', () => {
    const body = buildDepositBody({
        paymentId: '77',
        grossCents: 250000,
        feeCents: 3750,
        bankAccountId: '35',
        feeAccountId: '61',
        txnDate: '2026-10-20',
        note: 'n',
    });
    const [gross, fee] = body.Line as any[];
    assert.equal(gross.Amount, 2500);
    assert.deepEqual(gross.LinkedTxn, [{ TxnId: '77', TxnType: 'Payment', TxnLineId: '0' }]);
    assert.equal(fee.Amount, -37.5);
    assert.equal(fee.DepositLineDetail.AccountRef.value, '61');
    assert.equal(gross.Amount + fee.Amount, 2462.5);
    assert.equal(body.TxnDate, '2026-10-20');
});

/* ── Reversing a posted payment ── */
import { voidPosted, type QboRequest } from '../src/services/qboVoid';
import { auditEvents } from '../src/serializers/payment.serializer';
import { listQuerySchema } from '../src/validators/payment.validator';

const fakeQbo = (state: { payment?: any; deposit?: any | 'gone' }) => {
    const calls: string[] = [];
    const request: QboRequest = async (path, opts = {}) => {
        calls.push(`${opts.method ?? 'GET'} ${path}${opts.params ? '?' + new URLSearchParams(opts.params) : ''}`);
        if (path.startsWith('/deposit/')) {
            if (state.deposit === 'gone') throw Object.assign(new Error('gone'), { details: { fault: { Error: [{ code: '610' }] } } });
            return { Deposit: state.deposit };
        }
        if (path.startsWith('/payment/')) return { Payment: state.payment };
        return {};
    };
    return { request, calls };
};

test('void: the deposit is deleted before the payment is voided, each with its current SyncToken', async () => {
    const { request, calls } = fakeQbo({
        deposit: { Id: '78', SyncToken: '2' },
        payment: { Id: '77', SyncToken: '1', TotalAmt: 2500, PrivateNote: 'Portal payment' },
    });
    await voidPosted(request, { paymentId: '77', depositId: '78' });
    assert.deepEqual(calls, [
        'GET /deposit/78',
        'POST /deposit?operation=delete',
        'GET /payment/77',
        'POST /payment?operation=update&include=void',
    ]);
});

test('void: a payment with no fee has no deposit to delete', async () => {
    const { request, calls } = fakeQbo({ payment: { Id: '77', SyncToken: '0', TotalAmt: 2500 } });
    await voidPosted(request, { paymentId: '77' });
    assert.deepEqual(calls, ['GET /payment/77', 'POST /payment?operation=update&include=void']);
});

test('void: running it again after a partial failure skips what is already done', async () => {
    const { request, calls } = fakeQbo({
        deposit: 'gone',
        payment: { Id: '77', SyncToken: '3', TotalAmt: 0, PrivateNote: 'Portal payment | Voided' },
    });
    await voidPosted(request, { paymentId: '77', depositId: '78' });
    assert.deepEqual(calls, ['GET /deposit/78', 'GET /payment/77']);
});

test('void: a QuickBooks error other than "already gone" stops the reversal', async () => {
    const request: QboRequest = async () => {
        throw Object.assign(new Error('period closed'), { details: { fault: { Error: [{ code: '6000' }] } } });
    };
    await assert.rejects(voidPosted(request, { paymentId: '77', depositId: '78' }), /period closed/);
});

test('void: the history shows it, and the voided status can be filtered', () => {
    const p: any = {
        status: 'voided', createdAt: new Date('2026-10-15T01:00:00Z'), submittedBy: 'Sam',
        approvedAt: new Date('2026-10-16T01:00:00Z'), approvedBy: 'Ana',
        voidedAt: new Date('2026-10-20T01:00:00Z'), voidedBy: 'Ana', voidReason: 'Wrong estimate',
    };
    assert.deepEqual(auditEvents(p).map((e) => [e.type, e.by, e.note ?? null]), [
        ['submitted', 'Sam', null], ['approved', 'Ana', null], ['voided', 'Ana', 'Wrong estimate'],
    ]);
    assert.deepEqual(listQuerySchema.parse({ status: 'approved,voided' }).status, ['approved', 'voided']);
});
