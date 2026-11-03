import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoGroup, bucketOf, bucketsFor, buildReport, percentile, type ReportRow } from '../src/services/report';
import { reportQuery } from '../src/controllers/report.controller';
import { maintenanceGate } from '../src/middleware/maintenance';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Manila is UTC+8: 2026-10-05T02:00Z is 10:00 on Oct 5 in Manila; 2026-10-04T17:00Z is 01:00 on Oct 5.
let n = 0;
const row = (over: Partial<ReportRow>): ReportRow => ({
    id: `p${++n}`,
    status: 'approved',
    customerName: 'Cool Cars',
    bankDepositedTo: 'BDO',
    amountSubmitted: '1000.00',
    finalAmount: '985.00',
    submittedBy: 'Ana',
    submittedById: 'u-ana',
    createdAt: new Date('2026-10-05T00:00:00Z'),
    approvedAt: new Date('2026-10-05T02:00:00Z'),
    ...over,
});

const base = { from: '2026-10-01', to: '2026-10-07', group: 'day' as const, submitted: [], pending: [], now: Date.parse('2026-10-08T00:00:00Z') };

test('collections: net, gross and fees add up from the approved rows, by day in Manila time', () => {
    const r = buildReport({
        ...base,
        decided: [
            row({}),
            row({ amountSubmitted: '500', finalAmount: null, approvedAt: new Date('2026-10-04T17:00:00Z') }), // 01:00 Oct 5 in Manila
            row({ status: 'rejected', finalAmount: null }),
            row({ status: 'voided' }),
        ],
    });
    assert.equal(r.collections.count, 2);
    assert.equal(r.collections.gross, 1500);
    assert.equal(r.collections.net, 1485);
    assert.equal(r.collections.fees, 15);
    assert.equal(r.collections.voided, 1);
    assert.equal(r.collections.series.length, 7);
    assert.deepEqual(r.collections.series.find((b) => b.start === '2026-10-05'), { start: '2026-10-05', count: 2, net: 1485 });
    // The series sums to the total shown above it.
    assert.equal(r.collections.series.reduce((s, b) => s + b.net, 0), r.collections.net);
});

test('the previous period is the same length right before, and only its approvals count', () => {
    const r = buildReport({
        ...base,
        decided: [row({ approvedAt: new Date('2026-09-28T02:00:00Z'), finalAmount: '200' }), row({ status: 'rejected', approvedAt: new Date('2026-09-28T02:00:00Z') })],
    });
    assert.deepEqual(r.previous, { from: '2026-09-24', to: '2026-09-30' });
    assert.equal(r.collections.previousNet, 200);
    assert.equal(r.collections.previousCount, 1);
    assert.equal(r.collections.net, 0);
    assert.equal(r.turnaround.decided, 0); // decisions of the previous period are not this period's
});

test('every bank is listed, in order, zeros included', () => {
    const r = buildReport({ ...base, decided: [row({ bankDepositedTo: 'Cash', amountSubmitted: '300', finalAmount: '300' })] });
    assert.deepEqual(r.banks.map((b) => b.bank), ['BDO', 'UnionBank', 'Digima', 'HappyMed', 'Cash']);
    assert.deepEqual(r.banks[4], { bank: 'Cash', count: 1, gross: 300, fees: 0, net: 300 });
    assert.equal(r.banks[0]!.count, 0);
});

test('sales reps: submitted, approved, rejected, collected and waiting, most collected first', () => {
    const r = buildReport({
        ...base,
        decided: [row({}), row({ status: 'rejected' }), row({ submittedBy: 'Ben', submittedById: 'u-ben', finalAmount: '2000', amountSubmitted: '2000' })],
        submitted: [row({}), row({}), row({ submittedBy: 'Ben', submittedById: 'u-ben' })],
        pending: [row({ status: 'pending', approvedAt: null, submittedBy: 'Cy', submittedById: 'u-cy' })],
    });
    assert.deepEqual(r.reps.map((x) => x.name), ['Ben', 'Ana', 'Cy']);
    assert.deepEqual(r.reps[1], { id: 'u-ana', name: 'Ana', submitted: 2, approved: 1, rejected: 1, waiting: 0, collected: 985 });
    assert.equal(r.reps[2]!.waiting, 1);
});

test('turnaround: median and 90th percentile of the time to a decision, bands that sum to the decisions', () => {
    const created = new Date('2026-10-01T00:00:00Z'); // early enough that the slowest decision still lands in the range
    const after = (mins: number) => new Date(created.getTime() + mins * 60_000);
    const decided = [30, 90, 300, 2000, 6000].map((m) => row({ createdAt: created, approvedAt: after(m) }));
    decided.push(row({ status: 'rejected', createdAt: created, approvedAt: after(45) }));
    const r = buildReport({ ...base, decided });
    assert.equal(r.turnaround.decided, 6);
    assert.equal(r.turnaround.rejected, 1);
    assert.equal(r.turnaround.medianMinutes, 90);
    assert.equal(r.turnaround.p90Minutes, 6000);
    assert.deepEqual(r.turnaround.bands.map((b) => b.count), [2, 1, 1, 1, 1]);
    assert.equal(r.turnaround.bands.reduce((s, b) => s + b.count, 0), r.turnaround.decided);
});

test('waiting now: count, amount and the oldest first', () => {
    const pending = [
        row({ status: 'pending', approvedAt: null, amountSubmitted: '100', createdAt: new Date('2026-10-07T00:00:00Z') }),
        row({ status: 'pending', approvedAt: null, amountSubmitted: '250.50', createdAt: new Date('2026-10-06T00:00:00Z'), customerName: 'Older' }),
    ];
    const r = buildReport({ ...base, decided: [], pending });
    assert.equal(r.turnaround.waiting.count, 2);
    assert.equal(r.turnaround.waiting.amount, 350.5);
    assert.equal(r.turnaround.waiting.oldest[0]!.customerName, 'Older');
    assert.equal(r.turnaround.waiting.oldest[0]!.waitingMinutes, 2 * 24 * 60);
});

test('an empty period is zeros and dashes, not errors', () => {
    const r = buildReport({ ...base, decided: [] });
    assert.equal(r.collections.net, 0);
    assert.equal(r.turnaround.medianMinutes, null);
    assert.equal(r.reps.length, 0);
    assert.equal(r.collections.series.every((b) => b.count === 0), true);
});

test('buckets: weeks start on Monday, months on the 1st, and every period is present', () => {
    assert.equal(bucketOf('2026-10-07', 'week'), '2026-10-05'); // a Wednesday -> its Monday
    assert.equal(bucketOf('2026-10-05', 'week'), '2026-10-05');
    assert.equal(bucketOf('2026-10-11', 'week'), '2026-10-05'); // Sunday belongs to the week before
    assert.equal(bucketOf('2026-10-31', 'month'), '2026-10-01');
    assert.deepEqual(bucketsFor('2026-09-30', '2026-11-02', 'month'), ['2026-09-01', '2026-10-01', '2026-11-01']);
    assert.equal(autoGroup(30), 'day');
    assert.equal(autoGroup(90), 'week');
    assert.equal(autoGroup(365), 'month');
});

test('percentile uses the nearest rank', () => {
    assert.equal(percentile([], 50), null);
    assert.equal(percentile([5], 90), 5);
    assert.equal(percentile([1, 2, 3, 4], 50), 2);
});

test('query: defaults to the last 30 days; rejects a reversed or over-long range', () => {
    const q = reportQuery.parse({});
    assert.equal(Math.round((Date.parse(q.to) - Date.parse(q.from)) / 86_400_000), 29);
    assert.equal(reportQuery.safeParse({ from: '2026-10-07', to: '2026-10-01' }).success, false);
    assert.equal(reportQuery.safeParse({ from: '2025-01-01', to: '2026-10-01' }).success, false);
    assert.equal(reportQuery.safeParse({ from: '2026-10-01', to: '2026-10-31', group: 'week' }).success, true);
});

function fakeRes() {
    const res: any = { headers: {}, statusCode: 200, body: undefined };
    res.set = (k: string, v: string) => ((res.headers[k] = v), res);
    res.status = (s: number) => ((res.statusCode = s), res);
    res.json = (b: unknown) => ((res.body = b), res);
    return res;
}

test('maintenance: off passes through; on answers 503 with the details, but never for the health check', () => {
    let passed = 0;
    const next = () => void passed++;
    maintenanceGate({ enabled: false })({ path: '/api/payments' } as any, fakeRes(), next);
    assert.equal(passed, 1);

    const on = maintenanceGate({ enabled: true, until: '2099-01-01T10:00:00+08:00', message: 'Moving to a new server' });
    on({ path: '/api/health' } as any, fakeRes(), next);
    assert.equal(passed, 2);

    const res = fakeRes();
    on({ path: '/api/auth/me' } as any, res, next);
    assert.equal(passed, 2);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.error.details.code, 'MAINTENANCE');
    assert.equal(res.body.error.details.message, 'Moving to a new server');
    assert.equal(res.headers['Retry-After'], '3600');
});
