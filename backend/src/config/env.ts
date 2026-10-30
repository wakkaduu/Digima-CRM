import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    APP_BASE_URL: z.string().url(),
    FRONTEND_URL: z.string().url().default('http://localhost:5173'), // where the QBO callback sends the browser back to
    DATABASE_URL: z.string().min(1),

    // Receipt storage: any S3-compatible object store (UpCloud Object Storage in production).
    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string().min(1).default('us-east-1'),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
    S3_PREFIX: z.string().default('payment-proofs'),

    // Legacy: only needed while old receipts are still on Cloudinary (until scripts/migrate-receipts-to-s3.ts has run).
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),

    QBO_CLIENT_ID: z.string().min(1),
    QBO_CLIENT_SECRET: z.string().min(1),
    QBO_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
    QBO_REDIRECT_URI: z.string().url(),
    // The one QuickBooks company this portal serves. Anyone signing in from another company is rejected.
    QBO_REALM_ID: z.string().regex(/^\d+$/, 'QBO_REALM_ID is the numeric company id shown in QuickBooks'),
    // Development only: more companies allowed to connect (comma-separated), e.g. each co-developer's own sandbox company.
    QBO_EXTRA_REALM_IDS: z.preprocess(
        (v) => (v === '' || v === undefined ? [] : String(v).split(',').map((s) => s.trim()).filter(Boolean)),
        z.array(z.string().regex(/^\d+$/, 'QBO_EXTRA_REALM_IDS must be comma-separated numeric company ids')),
    ),
    // The operator's own Intuit id (the `sub` printed in the log by the first refused sign-in). It always signs in as
    // SuperAdmin, which lets the first account in and recovers a lockout. SUPERADMIN_EMAIL is only the label of that account.
    SUPERADMIN_QBO_SUB: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional()),
    SUPERADMIN_EMAIL: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().toLowerCase().email().optional()),
    // Encrypts the stored QuickBooks tokens (AES-256-GCM). 32 random bytes, base64: `openssl rand -base64 32`.
    // Changing or losing it just sends everyone back through "Sign in with QuickBooks".
    TOKEN_ENCRYPTION_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().refine((v) => Buffer.from(v, 'base64').length === 32, 'TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)').optional()),
    QBO_DEPOSIT_ACCOUNT_BDO: z.string().optional(),
    QBO_DEPOSIT_ACCOUNT_UNIONBANK: z.string().optional(),
    QBO_DEPOSIT_ACCOUNT_DIGIMA: z.string().optional(),
    QBO_DEPOSIT_ACCOUNT_HAPPYMED: z.string().optional(),
    QBO_DEPOSIT_ACCOUNT_CASH: z.string().optional(),
    QBO_BANK_FEE_ACCOUNT_ID: z.string().optional(),

    SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 chars'),
    DEFAULT_FEE_PERCENT: z.coerce.number().min(0).max(20).default(1.5), // pre-fills the approval screen's "apply fee" button
    ESTIMATE_LOOKBACK_DAYS: z.coerce.number().int().min(30).default(365),
}).refine((v) => v.NODE_ENV !== 'production' || v.QBO_EXTRA_REALM_IDS.length === 0, {
    path: ['QBO_EXTRA_REALM_IDS'],
    message: 'QBO_EXTRA_REALM_IDS is for development sandboxes only; production serves the single QBO_REALM_ID',
}).refine((v) => !v.SUPERADMIN_QBO_SUB || v.SUPERADMIN_EMAIL, {
    path: ['SUPERADMIN_EMAIL'],
    message: 'SUPERADMIN_EMAIL is required when SUPERADMIN_QBO_SUB is set (it labels the SuperAdmin account)',
});

export type Env = z.infer<typeof schema>;

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}

const env: Env = parsed.data;
export default env;
