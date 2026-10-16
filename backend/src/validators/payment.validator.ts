import { z } from 'zod';

// UI label -> Prisma enum key ("Happy Meal" is mapped to HappyMeal in schema.prisma)
export const BANK_MAP = {
    BDO: 'BDO',
    UnionBank: 'UnionBank',
    Digima: 'Digima',
    'Happy Meal': 'HappyMeal',
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
