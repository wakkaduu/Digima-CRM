// Pure filtering, sorting and paging for the Customers and Estimates lists (no I/O, so it is unit-tested directly).
import type { CustomerDto, EstimateDto } from '../services/qbo.service';
import type { CustomerListQuery, EstimateListQuery } from '../validators/crm.validator';

export interface CustomerStats {
    paidToDate: number;
    pendingCount: number;
    lastPaymentAt: Date | null;
}
export type CustomerRow = CustomerDto & { openEstimates: number; lastPaymentAt: string | null };

/** Estimates still being worked on (not yet converted to an invoice, not rejected). */
export const isOpenEstimate = (e: Pick<EstimateDto, 'status'>) => !e.status || e.status === 'Pending' || e.status === 'Accepted';

const text = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const direction = (sort: string) => (sort.endsWith(':desc') ? -1 : 1);
const page = <T>(rows: T[], p: number, size: number) => rows.slice((p - 1) * size, p * size);

export function queryCustomers(
    customers: CustomerDto[],
    estimates: EstimateDto[],
    stats: Map<string, CustomerStats>,
    q: CustomerListQuery
) {
    const open = new Map<string, number>();
    for (const e of estimates) if (e.customerId && isOpenEstimate(e)) open.set(e.customerId, (open.get(e.customerId) ?? 0) + 1);

    const needle = q.q?.toLowerCase();
    const rows: CustomerRow[] = customers
        .filter((c) => (q.status ? c.active === (q.status === 'active') : true))
        .filter((c) => !needle || [c.name, c.company, c.email, c.phone].some((v) => v?.toLowerCase().includes(needle)))
        .map((c) => ({
            ...c,
            openEstimates: open.get(c.id) ?? 0,
            lastPaymentAt: stats.get(c.id)?.lastPaymentAt?.toISOString() ?? null,
        }));

    const [field] = q.sort.split(':');
    const dir = direction(q.sort);
    rows.sort((a, b) => {
        let d = 0;
        if (field === 'openEstimates') d = a.openEstimates - b.openEstimates;
        else if (field === 'balance') d = a.balance - b.balance;
        else if (field === 'lastPayment') d = (a.lastPaymentAt ?? '').localeCompare(b.lastPaymentAt ?? '');
        else d = text(a.name, b.name);
        return d * dir || text(a.name, b.name) || a.id.localeCompare(b.id); // ties fall back to name, so pages are stable
    });

    return { total: rows.length, items: page(rows, q.page, q.pageSize) };
}

/** Status tab counts for the customers list (before the status filter, after the search). */
export function customerStatusCounts(customers: CustomerDto[], search?: string) {
    const needle = search?.toLowerCase();
    const hit = (c: CustomerDto) => !needle || [c.name, c.company, c.email, c.phone].some((v) => v?.toLowerCase().includes(needle));
    const matching = customers.filter(hit);
    return { all: matching.length, active: matching.filter((c) => c.active).length, inactive: matching.filter((c) => !c.active).length };
}

export function queryEstimates<E extends EstimateDto>(estimates: E[], q: EstimateListQuery) {
    const needle = q.q?.toLowerCase();
    const rows = estimates
        .filter((e) => (q.status ? e.status === q.status : true))
        .filter((e) => (q.customerId ? e.customerId === q.customerId : true))
        .filter((e) => !needle || (e.docNumber ?? '').toLowerCase().includes(needle) || (e.customerName ?? '').toLowerCase().includes(needle));

    const [field] = q.sort.split(':');
    const dir = direction(q.sort);
    rows.sort((a, b) => {
        let d = 0;
        if (field === 'number') d = text(a.docNumber ?? '', b.docNumber ?? '');
        else if (field === 'customer') d = text(a.customerName ?? '', b.customerName ?? '');
        else if (field === 'total') d = a.totalAmount - b.totalAmount;
        else d = a.txnDate.localeCompare(b.txnDate);
        return d * dir || b.txnDate.localeCompare(a.txnDate) || a.id.localeCompare(b.id);
    });

    return { total: rows.length, items: page(rows, q.page, q.pageSize) };
}

export const estimateStatusCounts = (estimates: EstimateDto[], q: { q?: string; customerId?: string }) => {
    const needle = q.q?.toLowerCase();
    const counts: Record<string, number> = { all: 0, Pending: 0, Accepted: 0, Closed: 0, Rejected: 0 };
    for (const e of estimates) {
        if (q.customerId && e.customerId !== q.customerId) continue;
        if (needle && !((e.docNumber ?? '').toLowerCase().includes(needle) || (e.customerName ?? '').toLowerCase().includes(needle))) continue;
        counts.all++;
        if (e.status && e.status in counts) counts[e.status]++;
    }
    return counts;
};
