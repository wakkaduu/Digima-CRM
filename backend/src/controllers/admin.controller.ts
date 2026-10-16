import type { Request, Response } from 'express';
import * as paymentModel from '../models/payment.model';
import { idSchema, approveSchema, rejectSchema } from '../validators/payment.validator';
import * as qboPayment from '../services/qboPayment.service';
import { toListItem } from '../serializers/payment.serializer';
import HttpError from '../utils/HttpError';
import asyncHandler from '../utils/asyncHandler';

const { toCents, fromCents } = qboPayment;

const inFlight = new Set(); // blocks double-clicks / two tabs (single server instance)

function parseId(raw: unknown) {
    const r = idSchema.safeParse(raw);
    if (!r.success) throw new HttpError(400, r.error.issues[0].message);
    return r.data;
}

// GET /api/payments/pending
export const listPending = asyncHandler(async (req, res) => {
    const payments = await paymentModel.listPending();
    res.json({ count: payments.length, payments: payments.map((p) => toListItem(p, 'admin')) });
});

// POST /api/payments/approve/:id   body: { finalAmount: "24625.00" }
export const approve = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const parsed = approveSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

    if (inFlight.has(id)) throw new HttpError(409, 'This payment is already being processed.');
    inFlight.add(id);

    try {
        const payment = await paymentModel.findById(id);
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
            await paymentModel.update(id, { finalAmount: fromCents(finalCents).toFixed(2) });
        }

        const result = await qboPayment.pushToQbo({
            payment,
            finalCents,
            approver: req.user.name,
        });

        const updated = await paymentModel.update(id, {
            status: 'approved',
            finalAmount: fromCents(finalCents).toFixed(2),
            approvedBy: req.user.name,
            approvedAt: new Date(),
            reviewedById: req.user.id,
            qboPaymentId: result.paymentId,
            qboDepositId: result.depositId || null,
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
export const reject = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const parsed = rejectSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

    const payment = await paymentModel.findById(id);
    if (!payment) throw new HttpError(404, 'Payment not found');
    if (payment.qboPaymentId) {
        throw new HttpError(
            409,
            'This payment was already partly posted to QuickBooks. Void it in QuickBooks first, or finish approving it.'
        );
    }

    const now = new Date();
    const count = await paymentModel.rejectIfPending(id, {
        rejectionReason: parsed.data.reason,
        approvedBy: req.user.name,
        approvedAt: now,
        reviewedById: req.user.id,
    });
    if (!count) throw new HttpError(409, 'This payment was already processed.');
    res.json({ ok: true, undoUntil: new Date(now.getTime() + paymentModel.REJECT_UNDO_WINDOW_MS) });
});

// POST /api/payments/reject/:id/undo  -> put it back in the queue (same admin, within the undo window)
export const undoReject = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const count = await paymentModel.undoReject(id, req.user.id);
    if (!count) {
        throw new HttpError(409, 'This rejection can no longer be undone.', { code: 'UNDO_NOT_AVAILABLE' });
    }
    res.json({ ok: true });
});

// GET /api/payments/qbo-accounts  (helper for filling in .env)
export const listQboAccounts = asyncHandler(async (req, res) => {
    res.json({ accounts: await qboPayment.listAccounts() });
});