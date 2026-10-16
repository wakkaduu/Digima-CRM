import type { Request, Response } from 'express';
import * as paymentModel from '../models/payment.model';
import * as userModel from '../models/user.model';
import { BANK_MAP, submitSchema, idSchema } from '../validators/payment.validator';
import * as qbo from '../services/qbo.service';
import * as cloud from '../services/cloudinary.service';
import HttpError from '../utils/HttpError';
import asyncHandler from '../utils/asyncHandler';

// POST /api/payments/submit  (multipart/form-data)
export const submit = asyncHandler(async (req, res) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new HttpError(400, parsed.error.issues[0].message, parsed.error.flatten().fieldErrors);
    }
    const { estimateId, amount, bank, force, referenceNo, receivedOn, receivedById } = parsed.data;

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
            status: 'pending',
        });
        res.status(201).json({ payment });
    } catch (err) {
        await cloud.deleteImage(image.publicId);
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

    const payment = await paymentModel.findReceiptInfo(idCheck.data);
    if (!payment) throw new HttpError(404, 'Receipt not found');

    // Admins can open any receipt; sales reps only their own.
    if (req.user.role !== 'admin' && payment.submittedById !== req.user.id) {
        throw new HttpError(403, 'You do not have access to this receipt');
    }

    // Older rows (before Phase 5A) have no publicId and a public URL.
    const source = payment.proofPublicId ? cloud.signedUrl(payment.proofPublicId) : payment.proofImageUrl;
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