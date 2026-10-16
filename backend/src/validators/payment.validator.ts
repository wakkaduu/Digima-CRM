import { z } from 'zod';

// UI label -> Prisma enum key ("Happy Med" is mapped to HappyMed in schema.prisma)
export const BANK_MAP = {
    BDO: 'BDO',
    UnionBank: 'UnionBank',
    Digima: 'Digima',
    'Happy Med': 'HappyMed',
    Cash: 'Cash',
} as const;

// Today's date in the company's timezone, as YYYY-MM-DD.
const todayManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

const receivedOn = z
    .string({ required_error: 'Select the date the payment was received' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Select the date the payment was received')
    .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'That is not a valid date')
    .refine((s) => s <= todayManila(), 'The date received cannot be in the future');

export type BankLabel = keyof typeof BANK_MAP;

const money = z
    .string()
    .trim()
    .transform((s) => s.replace(/,/g, ''))
    .pipe(z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Amount must be a number with up to 2 decimals'));

export const submitSchema = z
    .object({
        estimateId: z.string().trim().regex(/^\d+$/, 'Select an estimate from the list'),
        amount: money.refine((v) => Number(v) > 0, 'Amount must be greater than 0'),
        bank: z.enum(Object.keys(BANK_MAP) as [BankLabel, ...BankLabel[]], {
            message: 'Select the mode of payment',
        }),
        receivedOn,
        receivedById: z
            .string({ required_error: 'Select who received the payment' })
            .uuid('Select who received the payment'),
        // Spaces are removed and letters upper-cased so "ub 123" and "UB123" match.
        // Checked below, because the rule depends on the mode of payment.
        referenceNo: z
            .string()
            .trim()
            .transform((s) => s.replace(/\s+/g, '').toUpperCase())
            .optional(),
        force: z.string().optional(),
    })
    .superRefine((d, ctx) => {
        // Cash has no reference number, so whatever was sent is ignored. Banks: optional, but 4-60 chars if given.
        if (d.bank === 'Cash' || !d.referenceNo) return;
        if (d.referenceNo.length < 4 || d.referenceNo.length > 60) {
            ctx.addIssue({
                code: 'custom',
                path: ['referenceNo'],
                message: 'The reference number must be 4 to 60 characters, or leave it blank',
            });
        }
    })
    .transform((d) => ({ ...d, referenceNo: d.bank === 'Cash' ? undefined : d.referenceNo || undefined }));

export const idSchema = z.string().uuid('Invalid payment id');

export const approveSchema = z.object({ finalAmount: money });
export const rejectSchema = z.object({ reason: z.string().trim().min(3, 'Please give a reason').max(300) });

/* ── Listing, filtering, receipts, idempotency ── */

const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date format YYYY-MM-DD');

export const SORTABLE = ['createdAt', 'amountSubmitted', 'customerName', 'status'] as const;
export type SortField = (typeof SORTABLE)[number];

const STATUSES = ['pending', 'approved', 'rejected'] as const;
const BANK_KEYS = Object.values(BANK_MAP) as [string, ...string[]];

// GET /api/payments?status=approved,rejected&q=acme&rep=<uuid>&bank=BDO&from=2026-10-01&to=2026-10-31&sort=createdAt:desc&page=1&pageSize=25
export const listQuerySchema = z.object({
    status: z.preprocess(
        (v) => (typeof v === 'string' && v.trim() ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined),
        z.array(z.enum(STATUSES)).max(3).optional()
    ),
    q: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
    rep: z.preprocess(blankToUndefined, z.string().uuid('rep must be a user id').optional()),
    bank: z.preprocess(blankToUndefined, z.enum(BANK_KEYS).optional()),
    from: z.preprocess(blankToUndefined, day.optional()),
    to: z.preprocess(blankToUndefined, day.optional()),
    sort: z.preprocess(
        blankToUndefined,
        z
            .string()
            .regex(new RegExp(`^(${SORTABLE.join('|')}):(asc|desc)$`), `sort must be one of ${SORTABLE.join(', ')} with :asc or :desc`)
            .default('createdAt:desc')
    ),
    page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10_000).default(1)),
    pageSize: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(100).default(25)),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

// Receipt widths the portal will ask Cloudinary for (a fixed list, so callers cannot trigger arbitrary transformations).
export const RECEIPT_WIDTHS = [400, 800, 1200] as const;
export const receiptQuerySchema = z.object({
    w: z.preprocess(blankToUndefined, z.coerce.number().int().refine((n) => (RECEIPT_WIDTHS as readonly number[]).includes(n), `w must be one of ${RECEIPT_WIDTHS.join(', ')}`).optional()),
});

// Idempotency-Key header: a client-generated random string (a UUID works).
export const idempotencyKeySchema = z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{8,100}$/, 'Idempotency-Key must be 8 to 100 letters, digits, "-" or "_"');

export const estimateSearchSchema = z.object({
    q: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
    refresh: z.preprocess(blankToUndefined, z.enum(['true', 'false']).optional()),
    limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(50).optional()),
});
