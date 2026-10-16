import type { Request, Response } from 'express';
import * as paymentModel from '../models/payment.model';
import * as userModel from '../models/user.model';
import {
    BANK_MAP,
    submitSchema,
    idSchema,
    idempotencyKeySchema,
    listQuerySchema,
    receiptQuerySchema,
} from '../validators/payment.validator';
import { receiptUrls, toDetail, toListItem } from '../serializers/payment.serializer';
import * as qbo from '../services/qbo.service';
import * as cloud from '../services/cloudinary.service';
import { resizedPublicUrl } from '../utils/receiptUrl';
import HttpError from '../utils/HttpError';
import asyncHandler from '../utils/asyncHandler';

type Existing = NonNullable<Awaited<ReturnType<typeof paymentModel.findByIdempotencyKey>>>;

// Same key + same estimate and amount = the same request again. A reused key for something else is a client bug.
function replay(res: Response, earlier: Existing, estimateId: string, amount: string) {
    if (earlier.qboEstimateId !== estimateId || Number(earlier.amountSubmitted) !== Number(amount)) {
        throw new HttpError(422, 'This Idempotency-Key was already used for a different payment.', {
            code: 'IDEMPOTENCY_KEY_REUSED',
        });
    }
    res.set('Idempotent-Replayed', 'true');
    return res.status(200).json({ payment: { id: earlier.id, status: earlier.status }, replayed: true });
}

// POST /api/payments/submit  (multipart/form-data; optional Idempotency-Key header)
export const submit = asyncHandler(async (req, res) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new HttpError(400, parsed.error.issues[0].message, parsed.error.flatten().fieldErrors);
    }
    const { estimateId, amount, bank, force, referenceNo, receivedOn, receivedById } = parsed.data;

    // A retry of a request that already succeeded (the response was lost) gets the same payment back, not a second one.
    const rawKey = req.get('Idempotency-Key');
    let idempotencyKey: string | undefined;
    if (rawKey !== undefined) {
        const key = idempotencyKeySchema.safeParse(rawKey);
        if (!key.success) throw new HttpError(400, key.error.issues[0].message);
        idempotencyKey = key.data;
        const earlier = await paymentModel.findByIdempotencyKey(req.user.id, idempotencyKey);
        if (earlier) return replay(res, earlier, estimateId, amount);
    }

    // Only active sales employees can be named as the receiver (the dropdown is a convenience, this is the rule).
    const receiver = await userModel.findById(receivedById);
    if (!receiver || !receiver.active || receiver.role !== 'sales') {
        throw new HttpError(422, 'Choose who received the payment from the list.', { code: 'INVALID_RECEIVER' });
    }

    // 1. Never trust customer/estimate info from the browser: re-read it from QBO.
    const estimate = await qbo.getEstimateById(estimateId);
    if (estimate.status === 'Rejected') {
        throw new HttpError(422, 'This estimate was rejected in QuickBooks and cannot receive payment');
    }

    // 2a. Same bank + same reference number = true duplicate (hard block).
    const sameRef = referenceNo
        ? await paymentModel.findActiveByReference(BANK_MAP[bank], referenceNo)
        : null;
    if (sameRef) {
        throw new HttpError(409, 'This bank reference number was already submitted.', {
            code: 'DUPLICATE_REFERENCE',
        });
    }

    // 2b. Soft warning: same estimate + amount + bank, still pending, within 24 hours.
    if (force !== 'true') {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dup = await paymentModel.findRecentPendingDuplicate({
            estimateId,
            amount,
            bank: BANK_MAP[bank],
            since,
        });
        if (dup) {
            throw new HttpError(
                409,
                'A similar pending payment (same estimate, amount and bank) was submitted in the last 24 hours.',
                { code: 'DUPLICATE_PENDING' }
            );
        }
    }

    // 3. Upload receipt (private), then save. Roll back the image if the DB write fails.
    const image = await cloud.uploadProof(req.file!.buffer);
    try {
        const payment = await paymentModel.create({
            customerName: estimate.customerName || 'Unknown customer',
            qboCustomerId: estimate.customerId || null,
            qboEstimateId: estimateId,
            qboEstimateNumber: estimate.docNumber || null,
            amountSubmitted: amount,
            bankDepositedTo: BANK_MAP[bank],
            referenceNo: referenceNo ?? null,
            receivedOn: new Date(`${receivedOn}T00:00:00Z`),
            receivedBy: receiver.name,
            receivedById: receiver.id,
            proofImageUrl: image.url,
            proofPublicId: image.publicId,
            submittedBy: req.user.name,
            submittedById: req.user.id,
            idempotencyKey,
            status: 'pending',
        });
        res.status(201).json({ payment });
    } catch (err) {
        await cloud.deleteImage(image.publicId);
        // Two identical requests raced: the other one won. Answer with its payment.
        if (idempotencyKey && (err as { code?: string }).code === 'P2002') {
            const earlier = await paymentModel.findByIdempotencyKey(req.user.id, idempotencyKey);
            if (earlier) return replay(res, earlier, estimateId, amount);
        }
        throw err;
    }
});

// GET /api/payments/receivers  -> sales employees who can be chosen as "received by"
export const listReceivers = asyncHandler(async (req, res) => {
    res.json({ receivers: await userModel.listReceivers() });
});

// GET /api/payments/mine  -> the logged-in user's last 30 submissions
export const listMine = asyncHandler(async (req, res) => {
    const rows = await paymentModel.listBySubmitter(req.user.id);

    const payments = rows.map(({ salesSeenAt, ...p }) => ({
        ...p,
        unseen: p.status !== 'pending' && !salesSeenAt,
        thumbUrl: receiptUrls(p.id).thumbUrl,
    }));
    res.json({ payments, unseenCount: payments.filter((p) => p.unseen).length });
});

// POST /api/payments/mine/seen  -> the rep has read the approved/rejected updates
export const markSeen = asyncHandler(async (req, res) => {
    await paymentModel.markApprovedAsSeen(req.user.id);
    res.json({ ok: true });
});

// GET /api/payments/:id/receipt  -> streams the receipt through the portal (login required)
export const receipt = asyncHandler(async (req, res) => {
    const idCheck = idSchema.safeParse(req.params.id);
    if (!idCheck.success) throw new HttpError(400, 'Invalid payment id');

    const size = receiptQuerySchema.safeParse(req.query);
    if (!size.success) throw new HttpError(400, size.error.issues[0].message);
    const width = size.data.w;

    const payment = await paymentModel.findReceiptInfo(idCheck.data);
    if (!payment) throw new HttpError(404, 'Receipt not found');

    // Admins can open any receipt; sales reps only their own.
    if (req.user.role !== 'admin' && payment.submittedById !== req.user.id) {
        throw new HttpError(403, 'You do not have access to this receipt');
    }

    // Older rows (before Phase 5A) have no publicId and a public URL.
    const source = payment.proofPublicId
        ? cloud.signedUrl(payment.proofPublicId, width)
        : width
          ? resizedPublicUrl(payment.proofImageUrl, width)
          : payment.proofImageUrl;
    const upstream = await fetch(source);
    const type = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !type.startsWith('image/')) {
        console.error('Receipt fetch failed:', upstream.status, type);
        throw new HttpError(502, 'Could not load the receipt image.');
    }

    res.set({
        'Content-Type': type,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
    });
    res.send(Buffer.from(await upstream.arrayBuffer()));
});

// GET /api/payments/counts  -> numbers for the navigation badges (admin: awaiting review; sales: reviewed, not yet read)
export const counts = asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') return res.json({ pending: await paymentModel.countPending() });
    res.json({ unseen: await paymentModel.countUnseen(req.user.id) });
});

// GET /api/payments/recent-estimates  -> the estimates this rep submitted for most recently (for the picker's empty state)
export const recentEstimates = asyncHandler(async (req, res) => {
    const ids = await paymentModel.recentEstimateIds(req.user.id, 5);
    res.json({ estimates: ids.length ? await qbo.getEstimatesByIds(ids) : [] });
});

// GET /api/payments  -> filtered, sorted, paged history. Sales see only their own; admins see everyone's.
export const list = asyncHandler(async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        throw new HttpError(400, parsed.error.issues[0].message, parsed.error.flatten().fieldErrors);
    }
    const role = req.user.role as 'admin' | 'sales';
    const { items, total } = await paymentModel.search(parsed.data, { role, userId: req.user.id });
    res.json({
        items: items.map((p) => toListItem(p, role)),
        total,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
    });
});

// GET /api/payments/:id  -> one payment with its audit trail (sales: own only)
export const detail = asyncHandler(async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) throw new HttpError(400, 'Invalid payment id');

    const payment = await paymentModel.findById(id.data);
    if (!payment) throw new HttpError(404, 'Payment not found');
    const role = req.user.role as 'admin' | 'sales';
    if (role === 'sales' && payment.submittedById !== req.user.id) {
        throw new HttpError(403, 'You do not have access to this payment');
    }
    res.json({ payment: toDetail(payment, role) });
});
