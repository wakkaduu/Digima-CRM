import * as paymentModel from '../models/payment.model';
import * as qbo from '../services/qbo.service';
import { customerStatusCounts, estimateStatusCounts, isOpenEstimate, queryCustomers, queryEstimates } from '../crm/query';
import { customerListSchema, estimateListSchema, qboIdSchema } from '../validators/crm.validator';
import HttpError from '../utils/HttpError';
import asyncHandler from '../utils/asyncHandler';

const parse = <T>(result: { success: true; data: T } | { success: false; error: { issues: { message: string }[] } }) => {
    if (!result.success) throw new HttpError(400, result.error.issues[0].message);
    return result.data;
};

// GET /api/customers  -> QuickBooks customers with CRM figures, filtered, sorted and paged
export const listCustomers = asyncHandler(async (req, res) => {
    const q = parse(customerListSchema.safeParse(req.query));
    const [customers, estimates, stats] = await Promise.all([
        qbo.loadCustomers(),
        qbo.loadAllEstimates(),
        paymentModel.customerPaymentStats(),
    ]);
    const { items, total } = queryCustomers(customers, estimates, stats, q);
    res.json({ items, total, page: q.page, pageSize: q.pageSize, counts: customerStatusCounts(customers, q.q) });
});

// GET /api/customers/:id  -> one customer with the three summary figures
export const customerDetail = asyncHandler(async (req, res) => {
    const id = parse(qboIdSchema.safeParse(req.params.id));
    const [customer, estimates, stats] = await Promise.all([
        qbo.getCustomerById(id),
        qbo.loadAllEstimates(),
        paymentModel.customerPaymentStats(),
    ]);
    const mine = stats.get(id);
    res.json({
        customer: {
            ...customer,
            openEstimates: estimates.filter((e) => e.customerId === id && isOpenEstimate(e)).length,
            paidToDate: mine?.paidToDate ?? 0,
            pendingPayments: mine?.pendingCount ?? 0,
            outstanding: customer.balance,
            lastPaymentAt: mine?.lastPaymentAt ?? null,
        },
        lookbackDays: qbo.ESTIMATE_LOOKBACK_DAYS,
    });
});

// GET /api/estimates  -> every recent estimate (any status) with payment progress
export const listEstimates = asyncHandler(async (req, res) => {
    const q = parse(estimateListSchema.safeParse(req.query));
    const all = await qbo.loadAllEstimates();
    const { items, total } = queryEstimates(all, q);
    res.json({
        items: await qbo.attachPortalTotals(items), // totals only for the page being shown
        total,
        page: q.page,
        pageSize: q.pageSize,
        counts: estimateStatusCounts(all, q),
        lookbackDays: qbo.ESTIMATE_LOOKBACK_DAYS,
    });
});

// GET /api/estimates/:id  -> one estimate with its lines and payment progress
export const estimateDetail = asyncHandler(async (req, res) => {
    const id = parse(qboIdSchema.safeParse(req.params.id));
    const estimate = await qbo.getEstimateDetail(id);
    const [withTotals] = await qbo.attachPortalTotals([estimate]);
    res.json({ estimate: withTotals });
});
