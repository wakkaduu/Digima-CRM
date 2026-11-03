import { z } from 'zod';
import * as paymentModel from '../models/payment.model';
import { MAX_RANGE_DAYS, addDays, autoGroup, buildReport, daysBetween, manilaDay, manilaStart } from '../services/report';
import HttpError from '../utils/HttpError';
import asyncHandler from '../utils/asyncHandler';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates are YYYY-MM-DD').refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Not a real date');
const blank = (v: unknown) => (v === '' ? undefined : v);

export const reportQuery = z
    .object({
        from: z.preprocess(blank, day.optional()),
        to: z.preprocess(blank, day.optional()),
        group: z.preprocess(blank, z.enum(['day', 'week', 'month']).optional()),
    })
    .transform((q) => {
        const to = q.to ?? manilaDay(Date.now());
        const from = q.from ?? addDays(to, -29); // the last 30 days, today included
        return { from, to, group: q.group };
    })
    .refine((q) => q.from <= q.to, { message: 'The start date must be on or before the end date' })
    .refine((q) => daysBetween(q.from, q.to) <= MAX_RANGE_DAYS, { message: `Choose a range of ${MAX_RANGE_DAYS} days or less` });

// GET /api/reports?from=2026-10-01&to=2026-10-31&group=week
export const report = asyncHandler(async (req, res) => {
    const parsed = reportQuery.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const { from, to } = parsed.data;
    const group = parsed.data.group ?? autoGroup(daysBetween(from, to));
    const previousFrom = addDays(from, -daysBetween(from, to));

    const [decided, submitted, pending] = await paymentModel.listForReport({
        decidedFrom: manilaStart(previousFrom),
        createdFrom: manilaStart(from),
        until: manilaStart(addDays(to, 1)),
    });

    res.json(buildReport({ from, to, group, decided, submitted, pending }));
});
