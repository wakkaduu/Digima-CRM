const { z } = require('zod');
const { prisma } = require('../config/prisma');
const qbo = require('../services/qbo.service');
const cloud = require('../services/cloudinary.service');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');

// UI label -> Prisma enum key ("Happy Meal" is mapped to HappyMeal in schema.prisma)
const BANK_MAP = {
    BDO: 'BDO',
    UnionBank: 'UnionBank',
    Digima: 'Digima',
    'Happy Meal': 'HappyMeal',
};

const submitSchema = z.object({
    estimateId: z.string().trim().regex(/^\d+$/, 'Select an estimate from the list'),
    amount: z
        .string()
        .trim()
        .transform((s) => s.replace(/,/g, ''))
        .pipe(z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Amount must be a number with up to 2 decimals'))
        .refine((v) => Number(v) > 0, 'Amount must be greater than 0'),
    bank: z.enum(Object.keys(BANK_MAP), { message: 'Select the bank that received the payment' }),
    // Required now. Spaces are removed and letters upper-cased so "ub 123" and "UB123" match.
    referenceNo: z
        .string({ required_error: 'Enter the bank reference number from the receipt' })
        .trim()
        .transform((s) => s.replace(/\s+/g, '').toUpperCase())
        .pipe(z.string().min(4, 'The reference number must be at least 4 characters').max(60)),
    force: z.string().optional(),
});

// POST /api/payments/submit  (multipart/form-data)
exports.submit = asyncHandler(async (req, res) => {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
        throw new HttpError(400, parsed.error.issues[0].message, parsed.error.flatten().fieldErrors);
    }
    const { estimateId, amount, bank, force, referenceNo } = parsed.data;

    // 1. Never trust customer/estimate info from the browser: re-read it from QBO.
    const estimate = await qbo.getEstimateById(estimateId);
    if (estimate.status === 'Rejected') {
        throw new HttpError(422, 'This estimate was rejected in QuickBooks and cannot receive payment');
    }

    // 2a. Same bank + same reference number = true duplicate (hard block).
    const sameRef = await prisma.payment.findFirst({
        where: {
            bankDepositedTo: BANK_MAP[bank],
            referenceNo,
            status: { in: ['pending', 'approved'] },
        },
        select: { id: true },
    });
    if (sameRef) {
        throw new HttpError(409, 'This bank reference number was already submitted.', {
            code: 'DUPLICATE_REFERENCE',
        });
    }

    // 2b. Soft warning: same estimate + amount + bank, still pending, within 24 hours.
    if (force !== 'true') {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const dup = await prisma.payment.findFirst({
            where: {
                qboEstimateId: estimateId,
                amountSubmitted: amount,
                bankDepositedTo: BANK_MAP[bank],
                status: 'pending',
                createdAt: { gte: since },
            },
            select: { id: true },
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
    const image = await cloud.uploadProof(req.file.buffer);
    try {
        const payment = await prisma.payment.create({
            data: {
                customerName: estimate.customerName || 'Unknown customer',
                qboCustomerId: estimate.customerId || null,
                qboEstimateId: estimateId,
                qboEstimateNumber: estimate.docNumber || null,
                amountSubmitted: amount,
                bankDepositedTo: BANK_MAP[bank],
                referenceNo,
                proofImageUrl: image.url,
                proofPublicId: image.publicId,
                submittedBy: req.user.name,
                submittedById: req.user.id,
                status: 'pending',
            },
            select: { id: true, status: true },
        });
        res.status(201).json({ payment });
    } catch (err) {
        await cloud.deleteImage(image.publicId);
        throw err;
    }
});

// GET /api/payments/mine  -> the logged-in user's last 30 submissions
exports.listMine = asyncHandler(async (req, res) => {
    const rows = await prisma.payment.findMany({
        where: { submittedById: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
            id: true,
            customerName: true,
            qboEstimateId: true,
            qboEstimateNumber: true,
            amountSubmitted: true,
            finalAmount: true,
            bankDepositedTo: true,
            status: true,
            rejectionReason: true,
            createdAt: true,
            salesSeenAt: true,
        },
    });

    const payments = rows.map(({ salesSeenAt, ...p }) => ({
        ...p,
        unseen: p.status !== 'pending' && !salesSeenAt,
    }));
    res.json({ payments, unseenCount: payments.filter((p) => p.unseen).length });
});

// POST /api/payments/mine/seen  -> the rep has read the approved/rejected updates
exports.markSeen = asyncHandler(async (req, res) => {
    await prisma.payment.updateMany({
        where: {
            submittedById: req.user.id,
            status: { in: ['approved', 'rejected'] },
            salesSeenAt: null,
        },
        data: { salesSeenAt: new Date() },
    });
    res.json({ ok: true });
});

// GET /api/payments/:id/receipt  -> streams the receipt through the portal (login required)
exports.receipt = asyncHandler(async (req, res) => {
    const idCheck = z.string().uuid().safeParse(req.params.id);
    if (!idCheck.success) throw new HttpError(400, 'Invalid payment id');

    const payment = await prisma.payment.findUnique({
        where: { id: idCheck.data },
        select: { submittedById: true, proofImageUrl: true, proofPublicId: true },
    });
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