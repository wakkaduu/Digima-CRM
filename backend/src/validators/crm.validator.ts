import { z } from 'zod';

const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const sort = <T extends readonly string[]>(fields: T, fallback: string) =>
    z.preprocess(
        blankToUndefined,
        z
            .string()
            .regex(new RegExp(`^(${fields.join('|')}):(asc|desc)$`), `sort must be one of ${fields.join(', ')} with :asc or :desc`)
            .default(fallback)
    );
const paging = {
    page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(10_000).default(1)),
    pageSize: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(100).default(25)),
};
const qboId = z.string().regex(/^\d+$/, 'Invalid id');

export const CUSTOMER_SORTS = ['name', 'openEstimates', 'balance', 'lastPayment'] as const;
export type CustomerSortField = (typeof CUSTOMER_SORTS)[number];

// GET /api/customers?q=acme&status=active&sort=name:asc&page=1&pageSize=25
export const customerListSchema = z.object({
    q: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
    status: z.preprocess(blankToUndefined, z.enum(['active', 'inactive']).optional()),
    sort: sort(CUSTOMER_SORTS, 'name:asc'),
    ...paging,
});
export type CustomerListQuery = z.infer<typeof customerListSchema>;

export const ESTIMATE_SORTS = ['date', 'number', 'customer', 'total'] as const;
export type EstimateSortField = (typeof ESTIMATE_SORTS)[number];
export const ESTIMATE_STATUSES = ['Pending', 'Accepted', 'Closed', 'Rejected'] as const;

// GET /api/estimates?q=1042&status=Pending&customerId=58&sort=date:desc&page=1&pageSize=25
export const estimateListSchema = z.object({
    q: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
    status: z.preprocess(blankToUndefined, z.enum(ESTIMATE_STATUSES).optional()),
    customerId: z.preprocess(blankToUndefined, qboId.optional()),
    sort: sort(ESTIMATE_SORTS, 'date:desc'),
    ...paging,
});
export type EstimateListQuery = z.infer<typeof estimateListSchema>;

export const qboIdSchema = qboId;
