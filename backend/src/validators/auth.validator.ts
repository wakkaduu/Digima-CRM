import { z } from 'zod';

// What Intuit appends to the callback URL. Only these three values ever reach the OAuth library, and only in this shape,
// so a hand-crafted query string cannot be fed to its URL parser (intuit-oauth bundles a query-string with a known
// denial-of-service on malformed percent-encoding).
export const callbackParamsSchema = z.object({
    code: z.string().regex(/^[A-Za-z0-9._~-]{1,2048}$/),
    state: z.string().regex(/^[A-Za-z0-9]{1,128}$/),
    realmId: z.string().regex(/^\d{1,32}$/),
});

// Same-site paths only, so the sign-in redirect can never be turned into an open redirect.
export const safeNextSchema = z
    .string()
    .max(500)
    .refine((v) => v.startsWith('/') && !v.startsWith('//') && !v.includes('\\'));
