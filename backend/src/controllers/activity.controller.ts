import { z } from 'zod';
import * as auditModel from '../models/audit.model';
import { addDays, manilaStart } from '../services/report';
import HttpError from '../utils/HttpError';
import asyncHandler from '../utils/asyncHandler';

const blank = (v: unknown) => (v === '' ? undefined : v);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates are YYYY-MM-DD');

export const activityQuery = z
    .object({
        category: z.preprocess(blank, z.enum(['payments', 'team', 'access']).optional()),
        actor: z.preprocess(blank, z.string().uuid('actor must be an account id').optional()),
        failed: z.preprocess(blank, z.enum(['true', 'false']).optional()).transform((v) => v === 'true'),
        from: z.preprocess(blank, day.optional()),
        to: z.preprocess(blank, day.optional()),
        page: z.preprocess(blank, z.coerce.number().int().min(1).default(1)),
        pageSize: z.preprocess(blank, z.coerce.number().int().min(10).max(100).default(50)),
    })
    .refine((q) => !q.from || !q.to || q.from <= q.to, { message: 'The start date must be on or before the end date' });

// GET /api/activity?category=payments&actor=<uuid>&failed=true&from=2026-11-01&to=2026-11-04&page=1&pageSize=50
export const list = asyncHandler(async (req, res) => {
    const parsed = activityQuery.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const q = parsed.data;
    const { items, total } = await auditModel.list({
        category: q.category,
        actorId: q.actor,
        failedOnly: q.failed,
        from: q.from ? manilaStart(q.from) : undefined,
        until: q.to ? manilaStart(addDays(q.to, 1)) : undefined,
        page: q.page,
        pageSize: q.pageSize,
    });
    res.json({
        items: items.map((e) => ({
            id: e.id,
            at: e.at,
            actorId: e.actorId,
            actorName: e.actorName,
            actorRole: e.actorRole,
            action: e.action,
            outcome: e.outcome,
            paymentId: e.paymentId,
            targetUserId: e.targetUserId,
            summary: e.summary,
            details: e.details,
        })),
        total,
        page: q.page,
        pageSize: q.pageSize,
    });
});
