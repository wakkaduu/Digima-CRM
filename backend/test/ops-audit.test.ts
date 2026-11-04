import test from 'node:test';
import assert from 'node:assert/strict';
import * as audit from '../src/services/audit';
import { checkHealth } from '../src/services/health';
import { requestId } from '../src/middleware/requestId';
import HttpError from '../src/utils/HttpError';

/* eslint-disable @typescript-eslint/no-explicit-any */

// env.ts exits the process when the environment is incomplete, so give it throwaway values before the imports that need it.
Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000', DATABASE_URL: 'postgresql://u:p@localhost/db', S3_ENDPOINT: 'http://localhost:9000',
    S3_BUCKET: 'b', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's', QBO_CLIENT_ID: 'c', QBO_CLIENT_SECRET: 's',
    QBO_REDIRECT_URI: 'http://localhost:3000/cb', QBO_REALM_ID: '1', SESSION_SECRET: 'x'.repeat(20),
});

const ana = { id: 'u-ana', name: 'Ana Reyes', role: 'admin' };
const payment = { id: 'p1', customerName: 'Cool Cars', qboEstimateId: '160', qboEstimateNumber: '1006', amountSubmitted: '20000.00' };

/* ── Activity sentences ── */

test('activity: an approval says how much, from whom, what it netted and which invoice', () => {
    const created = audit.approved(ana, payment, { finalAmount: 19700, invoiceNumber: '1043', invoiceCreated: true, qboPaymentId: '88' });
    assert.equal(created.summary, 'Approved ₱20,000.00 from Cool Cars (estimate #1006), ₱19,700.00 after bank fees; created invoice #1043');
    assert.equal(created.action, 'payment.approved');
    assert.equal(created.paymentId, 'p1');

    const reused = audit.approved(ana, payment, { finalAmount: 20000, invoiceNumber: '1043', invoiceCreated: false, qboPaymentId: '89' });
    assert.equal(reused.summary, 'Approved ₱20,000.00 from Cool Cars (estimate #1006); recorded on invoice #1043');
});

test('activity: a refused approval is logged as failed, with the reason and its code', () => {
    const e = audit.approveFailed(ana, payment, { message: 'Invoice #1043 does not match the estimate.', code: 'INVOICE_TOTAL_MISMATCH' });
    assert.equal(e.outcome, 'failed');
    assert.match(e.summary, /^Could not approve ₱20,000\.00 from Cool Cars \(estimate #1006\): Invoice #1043/);
    assert.equal((e.details as any).code, 'INVOICE_TOTAL_MISMATCH');
});

test('activity: rejections and voids quote the reason', () => {
    assert.equal(audit.rejected(ana, payment, 'Amount does not match').summary, 'Rejected ₱20,000.00 from Cool Cars (estimate #1006): “Amount does not match”');
    assert.match(audit.voided(ana, payment, 'Duplicate').summary, /^Voided .* in QuickBooks: “Duplicate”$/);
});

test('activity: a team change lists only what changed, and nothing when nothing did', () => {
    const before = { id: 'u2', name: 'Ben Cruz', email: 'ben@x.ph', role: 'sales' as const, active: true };
    assert.equal(audit.updated(ana, before, { ...before, role: 'admin', active: false })!.summary, 'Changed Ben Cruz: role Sales → Admin; deactivated');
    assert.equal(audit.updated(ana, before, { ...before }), null);
    assert.equal(audit.invited(ana, before).summary, 'Invited Ben Cruz (ben@x.ph) as Sales');
});

test('activity: a refused sign-in has no account, and says why', () => {
    const e = audit.signInRefused('not_authorized');
    assert.equal(e.actor.id, null);
    assert.equal(e.outcome, 'failed');
    assert.equal(e.summary, 'A QuickBooks sign-in was refused by someone who has not been invited');
});

test('activity: every action belongs to exactly one filter tab', () => {
    for (const action of audit.ACTIONS) {
        const tabs = Object.values(audit.CATEGORIES).filter((prefixes) => prefixes.some((p) => action.startsWith(p)));
        assert.equal(tabs.length, 1, action);
    }
});

test('activity: the query filters by tab, person, failures and Manila days', async () => {
    const { eventWhere } = await import('../src/models/audit.model.js');
    const where: any = eventWhere({ category: 'access', actorId: 'u-ana', failedOnly: true, from: new Date('2026-11-01T00:00:00+08:00') });
    assert.deepEqual(where.OR, [{ action: { startsWith: 'auth.' } }, { action: { startsWith: 'qbo.' } }]);
    assert.equal(where.actorId, 'u-ana');
    assert.equal(where.outcome, 'failed');
    assert.equal(where.at.gte.toISOString(), '2026-10-31T16:00:00.000Z');

    const { activityQuery } = await import('../src/controllers/activity.controller.js');
    assert.equal(activityQuery.safeParse({ from: '2026-11-04', to: '2026-11-01' }).success, false);
    assert.equal(activityQuery.safeParse({ actor: 'not-a-uuid' }).success, false);
    const q = activityQuery.parse({});
    assert.deepEqual([q.page, q.pageSize, q.failed], [1, 50, false]);
});

/* ── Health ── */

test('health: ok when the database answers, 503-worthy when it fails or hangs', async () => {
    assert.equal((await checkHealth(async () => 1)).database, 'up');

    const down = await checkHealth(async () => {
        throw new Error('connection refused');
    });
    assert.deepEqual([down.ok, down.database, down.error], [false, 'down', 'connection refused']);

    const hung = await checkHealth(() => new Promise(() => {}), 50);
    assert.equal(hung.database, 'down');
    assert.match(hung.error!, /timed out after 50 ms/);
});

/* ── Request ids and error replies ── */

test('request id: kept from a proxy when it looks safe, otherwise a fresh one, always echoed back', () => {
    const run = (header?: string) => {
        const headers: Record<string, string> = {};
        const req: any = { get: () => header };
        requestId(req, { set: (k: string, v: string) => (headers[k] = v) } as any, () => {});
        return { id: req.id, echoed: headers['X-Request-Id'] };
    };
    assert.equal(run('abc-123-xyz').id, 'abc-123-xyz');
    assert.match(run().id, /^[0-9a-f-]{36}$/);
    assert.notEqual(run('bad id; drop table').id, 'bad id; drop table');
    const r = run();
    assert.equal(r.echoed, r.id);
});

test('errors: every error reply carries the request id, so a user can quote it', async () => {
    const { errorHandler } = await import('../src/middleware/errorHandler.js');
    let out: any;
    const res: any = { status: () => res, json: (b: unknown) => (out = b) };
    errorHandler(new HttpError(409, 'Already approved'), { id: 'req-42', method: 'POST', originalUrl: '/x' } as any, res, () => {});
    assert.equal(out.error.requestId, 'req-42');
});

test('client errors: long reports are cut to size, unknown kinds refused', async () => {
    const { clientErrorSchema } = await import('../src/controllers/ops.controller.js');
    const r = clientErrorSchema.parse({ message: 'x'.repeat(900), stack: 's'.repeat(5000), path: '/reports' });
    assert.equal(r.message.length, 500);
    assert.equal(r.stack!.length, 4000);
    assert.equal(r.kind, 'crash');
    assert.equal(clientErrorSchema.safeParse({ message: 'x', kind: 'other' }).success, false);
});

/* ── Product tour ── */

test('tour: only "finished" and "dismissed" are recorded; anything else is refused', async () => {
    const { tourSchema } = await import('../src/controllers/auth.controller.js');
    assert.equal(tourSchema.safeParse({ outcome: 'finished' }).success, true);
    assert.equal(tourSchema.safeParse({ outcome: 'dismissed' }).success, true);
    assert.equal(tourSchema.safeParse({ outcome: 'skipped' }).success, false); // skipping sends nothing: it comes back next sign-in
    assert.equal(tourSchema.safeParse({}).success, false);
    // Page tours name their page, from the fixed list.
    assert.equal(tourSchema.safeParse({ outcome: 'finished', page: 'submit' }).success, true);
    assert.equal(tourSchema.safeParse({ outcome: 'dismissed', page: 'reports' }).success, true);
    assert.equal(tourSchema.safeParse({ outcome: 'finished', page: 'nowhere' }).success, false);
});
