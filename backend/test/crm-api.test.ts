import test from 'node:test';
import assert from 'node:assert/strict';
import { customerListSchema, estimateListSchema } from '../src/validators/crm.validator';
import { customerStatusCounts, estimateStatusCounts, isOpenEstimate, queryCustomers, queryEstimates } from '../src/crm/query';
import { listQuerySchema } from '../src/validators/payment.validator';
import { buildListWhere } from '../src/models/payment.model';
import type { CustomerDto, EstimateDto } from '../src/services/qbo.service';

const customer = (o: Partial<CustomerDto>): CustomerDto => ({
    id: '1', name: 'Acme', company: null, email: null, phone: null, active: true, balance: 0, updatedAt: null, ...o,
});
const estimate = (o: Partial<EstimateDto>): EstimateDto => ({
    id: '1', docNumber: '1001', customerId: '1', customerName: 'Acme', totalAmount: 100, txnDate: '2026-10-01',
    expirationDate: null, status: 'Pending', email: null, ...o,
});

const CUSTOMERS = [
    customer({ id: '1', name: 'Acme Corp', balance: 500, email: 'ap@acme.test' }),
    customer({ id: '2', name: 'beta Ltd', balance: 1500 }),
    customer({ id: '3', name: 'Cobalt', active: false }),
];
const ESTIMATES = [
    estimate({ id: '10', customerId: '1', status: 'Pending' }),
    estimate({ id: '11', customerId: '1', status: 'Accepted', txnDate: '2026-10-05' }),
    estimate({ id: '12', customerId: '1', status: 'Closed' }),
    estimate({ id: '13', customerId: '2', status: 'Rejected', customerName: 'beta Ltd', docNumber: '2002' }),
];
const STATS = new Map([['2', { paidToDate: 10, pendingCount: 0, lastPaymentAt: new Date('2026-10-10T00:00:00Z') }]]);
const cq = (o: Record<string, string>) => customerListSchema.parse(o);
const eq = (o: Record<string, string>) => estimateListSchema.parse(o);

test('customer list: defaults, bounds and bad sorts', () => {
    const q = cq({});
    assert.deepEqual([q.sort, q.page, q.pageSize], ['name:asc', 1, 25]);
    for (const bad of [{ sort: 'owner:asc' }, { status: 'maybe' }, { pageSize: '101' }, { page: '0' }, { q: 'x'.repeat(101) }]) {
        assert.equal(customerListSchema.safeParse(bad).success, false, JSON.stringify(bad));
    }
});

test('customers: open estimates count only Pending and Accepted, and the name sort ignores case', () => {
    const { items } = queryCustomers(CUSTOMERS, ESTIMATES, STATS, cq({}));
    assert.deepEqual(items.map((c) => [c.name, c.openEstimates]), [['Acme Corp', 2], ['beta Ltd', 0], ['Cobalt', 0]]);
    assert.equal(items[1]!.lastPaymentAt, '2026-10-10T00:00:00.000Z');
});

test('customers: search covers name and email, status filters, balance sorts both ways', () => {
    assert.deepEqual(queryCustomers(CUSTOMERS, ESTIMATES, STATS, cq({ q: 'AP@ACME' })).items.map((c) => c.id), ['1']);
    assert.deepEqual(queryCustomers(CUSTOMERS, ESTIMATES, STATS, cq({ status: 'inactive' })).items.map((c) => c.id), ['3']);
    assert.deepEqual(queryCustomers(CUSTOMERS, ESTIMATES, STATS, cq({ sort: 'balance:desc' })).items.map((c) => c.id), ['2', '1', '3']);
    assert.deepEqual(customerStatusCounts(CUSTOMERS), { all: 3, active: 2, inactive: 1 });
});

test('customers: paging reports the total before the page cut', () => {
    const r = queryCustomers(CUSTOMERS, ESTIMATES, STATS, cq({ pageSize: '2', page: '2' }));
    assert.equal(r.total, 3);
    assert.deepEqual(r.items.map((c) => c.id), ['3']);
});

test('estimates: filter by status, customer and text; newest first by default', () => {
    assert.deepEqual(queryEstimates(ESTIMATES, eq({})).items.map((e) => e.id), ['11', '10', '12', '13']);
    assert.deepEqual(queryEstimates(ESTIMATES, eq({ status: 'Closed' })).items.map((e) => e.id), ['12']);
    assert.deepEqual(queryEstimates(ESTIMATES, eq({ customerId: '2' })).items.map((e) => e.id), ['13']);
    assert.deepEqual(queryEstimates(ESTIMATES, eq({ q: '2002' })).items.map((e) => e.id), ['13']);
    assert.equal(estimateListSchema.safeParse({ status: 'Voided' }).success, false);
    assert.equal(estimateListSchema.safeParse({ customerId: 'abc' }).success, false);
});

test('estimates: counts ignore the status filter but respect search and customer', () => {
    assert.deepEqual(estimateStatusCounts(ESTIMATES, {}), { all: 4, Pending: 1, Accepted: 1, Closed: 1, Rejected: 1 });
    assert.equal(estimateStatusCounts(ESTIMATES, { customerId: '1' }).all, 3);
    assert.equal(isOpenEstimate({ status: 'Closed' }), false);
    assert.equal(isOpenEstimate({ status: undefined }), true);
});

test('payments list can be narrowed to one customer or estimate (and sales stay limited to their own)', () => {
    const q = listQuerySchema.parse({ customerId: '58', estimateId: '900' });
    const and = (buildListWhere(q, { role: 'sales', userId: 'u1' }) as { AND: unknown[] }).AND;
    assert.deepEqual(and, [{ submittedById: 'u1' }, { qboCustomerId: '58' }, { qboEstimateId: '900' }]);
    assert.equal(listQuerySchema.safeParse({ customerId: "1' or 1=1" }).success, false);
});
