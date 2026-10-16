const { z } = require('zod');
const { prisma } = require('../config/prisma');
const qboPayment = require('../services/qboPayment.service');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');

const { toCents, fromCents } = qboPayment;

const idSchema = z.string().uuid('Invalid payment id');

const money = z
    .string()
    .trim()
    .transform((s) => s.replace(/,/g, ''))
    .pipe(z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Amount must be a number with up to 2 decimals'));

const approveSchema = z.object({ finalAmount: money });
const rejectSchema = z.object({ reason: z.string().trim().min(3, 'Please give a reason').max(300) });

const inFlight = new Set(); // blocks double-clicks / two tabs (single server instance)

function parseId(raw) {
    const r = idSchema.safeParse(raw);
    if (!r.success) throw new HttpError(400, r.error.issues[0].message);
    return r.data;
}

// GET /api/payments/pending
exports.listPending = asyncHandler(async (req, res) => {
    const payments = await prisma.payment.findMany({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' }, // oldest first
    });
    res.json({
        count: payments.length,
        payments: payments.map(({ proofPublicId, ...p }) => ({
            ...p,
            proofImageUrl: `/api/payments/${p.id}/receipt`,
            qboPartiallyPosted: Boolean(p.qboPaymentId),
        })),
    });
});

// POST /api/payments/approve/:id   body: { finalAmount: "24625.00" }
exports.approve = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const parsed = approveSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

    if (inFlight.has(id)) throw new HttpError(409, 'This payment is already being processed.');
    inFlight.add(id);

    try {
        const payment = await prisma.payment.findUnique({ where: { id } });
        if (!payment) throw new HttpError(404, 'Payment not found');
        if (payment.status !== 'pending') throw new HttpError(409, `This payment is already ${payment.status}.`);

        const grossCents = toCents(payment.amountSubmitted);

        // If an earlier attempt already posted to QBO, keep the amount it used.
        const finalCents = payment.qboPaymentId
            ? toCents(payment.finalAmount)
            : toCents(parsed.data.finalAmount);

        if (finalCents <= 0) throw new HttpError(422, 'Final amount must be greater than 0');
        if (finalCents > grossCents) {
            throw new HttpError(422, 'Final amount cannot be more than the amount submitted');
        }

        if (!payment.qboPaymentId) {
            await prisma.payment.update({
                where: { id },
                data: { finalAmount: fromCents(finalCents).toFixed(2) },
            });
        }

        const result = await qboPayment.pushToQbo({
            payment,
            finalCents,
            approver: req.session.user.name,
        });

        const updated = await prisma.payment.update({
            where: { id },
            data: {
                status: 'approved',
                finalAmount: fromCents(finalCents).toFixed(2),
                approvedBy: req.session.user.name,
                approvedAt: new Date(),
                qboPaymentId: result.paymentId,
                qboDepositId: result.depositId || null,
            },
        });

        res.json({
            payment: updated,
            qbo: {
                paymentId: result.paymentId,
                depositId: result.depositId,
                fee: fromCents(result.feeCents),
                unappliedCredit: fromCents(result.unappliedCents),
            },
        });
    } finally {
        inFlight.delete(id);
    }
});

// POST /api/payments/reject/:id   body: { reason }
exports.reject = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new HttpError(404, 'Payment not found');
    if (payment.qboPaymentId) {
        throw new HttpError(
            409,
            'This payment was already partly posted to QuickBooks. Void it in QuickBooks first, or finish approving it.'
        );
    }

    const { count } = await prisma.payment.updateMany({
        where: { id, status: 'pending' },
        data: {
            status: 'rejected',
            rejectionReason: parsed.data.reason,
            approvedBy: req.session.user.name,
            approvedAt: new Date(),
        },
    });
    if (!count) throw new HttpError(409, 'This payment was already processed.');
    res.json({ ok: true });
});

// GET /api/payments/qbo-accounts  (helper for filling in .env)
exports.listQboAccounts = asyncHandler(async (req, res) => {
    res.json({ accounts: await qboPayment.listAccounts() });
});