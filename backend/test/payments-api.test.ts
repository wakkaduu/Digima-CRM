// Pure-logic tests (no database): validators, query building, serializers. Run with `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Payment } from '@prisma/client';

import { listQuerySchema, idempotencyKeySchema, receiptQuerySchema, estimateSearchSchema } from '../src/validators/payment.validator';
import { buildListWhere } from '../src/models/payment.model';
import { auditEvents, toDetail, toListItem, receiptUrls } from '../src/serializers/payment.serializer';
import { resizedPublicUrl } from '../src/utils/receiptUrl';

const REP = '3f0c5a4e-8f55-4c1e-9d1a-0a1b2c3d4e5f';
const ADMIN = { role: 'admin' as const, userId: 'admin-1' };
const SALES = { role: 'sales' as const, userId: 'sales-1' };

const payment = (over: Partial<Payment> = {}) =>
    ({
        id: 'p1',
        customerName: 'Acme Corp',
        qboEstimateId: '9',
        qboEstimateNumber: '1042',
        amountSubmitted: '2500',
        finalAmount: null,
        bankDepositedTo: 'BDO',
        status: 'pending',
        rejectionReason: null,
        createdAt: new Date('2026-10-15T01:00:00Z'),
        receivedOn: null,
        receivedBy: 'Sam',
        submittedBy: 'Sam',
        submittedById: 'sales-1',
        receivedById: 'sales-1',
        referenceNo: 'REF1234',
        approvedBy: null,
        approvedAt: null,
        salesSeenAt: null,
        qboPaymentId: null,
        qboDepositId: null,
        qboCustomerId: null,
        proofImageUrl: 'https://res.cloudinary.com/x/image/authenticated/v1/a.jpg',
        proofPublicId: 'a',
        ...over,
    }) as unknown as Payment;

test('list query: defaults, csv status, blank values ignored', () => {
    const q = listQuerySchema.parse({ status: 'approved, rejected', q: '', rep: '', page: '', pageSize: '' });
    assert.deepEqual(q.status, ['approved', 'rejected']);
    assert.equal(q.q, undefined);
    assert.equal(q.sort, 'createdAt:desc');
    assert.equal(q.page, 1);
    assert.equal(q.pageSize, 25);
});

test('list query: rejects bad input instead of passing it to the database', () => {
    for (const bad of [
        { status: 'deleted' },
        { sort: 'passwordHash:asc' },
        { sort: 'createdAt:sideways' },
        { rep: 'not-a-uuid' },
        { bank: 'Bitcoin' },
        { from: '16/10/2026' },
        { page: '0' },
        { pageSize: '101' },
        { q: 'x'.repeat(101) },
    ]) {
        assert.equal(listQuerySchema.safeParse(bad).success, false, JSON.stringify(bad));
    }
});

test('list where: sales are always limited to their own rows, whatever they ask for', () => {
    const q = listQuerySchema.parse({ rep: REP });
    const where = buildListWhere(q, SALES);
    assert.deepEqual(where, { AND: [{ submittedById: 'sales-1' }] });
    assert.deepEqual(buildListWhere(q, ADMIN), { AND: [{ submittedById: REP }] });
});

test('list where: filters combine; the "to" day is inclusive in Manila time; reference search is admin only', () => {
    const q = listQuerySchema.parse({ status: 'approved', bank: 'BDO', from: '2026-10-01', to: '2026-10-31', q: 'acme' });
    const and = (buildListWhere(q, ADMIN) as { AND: unknown[] }).AND as Record<string, any>[];
    assert.deepEqual(and[0], { status: { in: ['approved'] } });
    assert.deepEqual(and[1], { bankDepositedTo: 'BDO' });
    assert.equal(and[2].createdAt.gte.toISOString(), '2026-09-30T16:00:00.000Z'); // Oct 1 00:00 +08:00
    assert.equal(and[3].createdAt.lt.toISOString(), '2026-10-31T16:00:00.000Z'); // end of Oct 31 +08:00
    assert.equal(and[4].OR.length, 4);
    const salesOr = (buildListWhere(q, SALES) as { AND: Record<string, any>[] }).AND.find((c) => c.OR)!.OR;
    assert.equal(salesOr.length, 2);
    assert.deepEqual(buildListWhere(listQuerySchema.parse({}), ADMIN), {});
});

test('idempotency key and receipt width validation', () => {
    assert.equal(idempotencyKeySchema.safeParse('3f0c5a4e-8f55-4c1e-9d1a-0a1b2c3d4e5f').success, true);
    for (const bad of ['short', 'has space in it', 'x'.repeat(101), 'semi;colon-key-1']) {
        assert.equal(idempotencyKeySchema.safeParse(bad).success, false, bad);
    }
    assert.equal(receiptQuerySchema.parse({}).w, undefined);
    assert.equal(receiptQuerySchema.parse({ w: '800' }).w, 800);
    assert.equal(receiptQuerySchema.safeParse({ w: '801' }).success, false); // only the fixed widths
    assert.equal(receiptQuerySchema.safeParse({ w: '100000' }).success, false);
});

test('estimate search: limit is bounded and optional', () => {
    assert.equal(estimateSearchSchema.parse({}).limit, undefined);
    assert.equal(estimateSearchSchema.parse({ q: 'acme', limit: '20' }).limit, 20);
    assert.equal(estimateSearchSchema.safeParse({ limit: '500' }).success, false);
});

test('serializer: sales rows carry no other user, QuickBooks or reference data', () => {
    const row = toListItem(payment({ status: 'approved', approvedAt: new Date(), approvedBy: 'Ana' }), 'sales') as Record<string, unknown>;
    for (const hidden of ['submittedById', 'receivedById', 'referenceNo', 'qboPartiallyPosted', 'proofImageUrl']) {
        assert.equal(hidden in row, false, hidden);
    }
    assert.equal(row.unseen, true);
    assert.equal(row.thumbUrl, '/api/payments/p1/receipt?w=800');
});

test('serializer: admin rows flag partial posts only while pending', () => {
    assert.equal((toListItem(payment({ qboPaymentId: '77' }), 'admin') as any).qboPartiallyPosted, true);
    assert.equal((toListItem(payment({ qboPaymentId: '77', status: 'approved' }), 'admin') as any).qboPartiallyPosted, false);
    assert.equal(receiptUrls('p1').proofImageUrl, '/api/payments/p1/receipt');
});

test('audit trail: submitted, then the review with who, when and why', () => {
    const at = new Date('2026-10-16T02:00:00Z');
    assert.deepEqual(auditEvents(payment()).map((e) => e.type), ['submitted']);
    const rejected = auditEvents(payment({ status: 'rejected', approvedAt: at, approvedBy: 'Ana', rejectionReason: 'Blurry' }));
    assert.deepEqual(rejected.map((e) => e.type), ['submitted', 'rejected']);
    assert.equal(rejected[1]!.note, 'Blurry');
    assert.equal(rejected[1]!.by, 'Ana');
});

test('detail: fee is computed, QuickBooks ids are admin only', () => {
    const p = payment({ status: 'approved', finalAmount: '2462.5' as any, approvedAt: new Date(), approvedBy: 'Ana', qboPaymentId: '77', qboDepositId: '78' });
    assert.equal((toDetail(p, 'admin') as any).fee, 37.5);
    assert.deepEqual((toDetail(p, 'admin') as any).qbo, { paymentId: '77', depositId: '78', customerId: null });
    assert.equal('qbo' in toDetail(p, 'sales'), false);
});

test('legacy public receipt URLs get the same resize', () => {
    assert.equal(
        resizedPublicUrl('https://res.cloudinary.com/x/image/upload/v1/a.jpg', 800),
        'https://res.cloudinary.com/x/image/upload/c_limit,w_800,q_auto,f_auto/v1/a.jpg',
    );
});
