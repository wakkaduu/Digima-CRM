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
    QBO_DEPOSIT_ACCOUNT_BDO: z.string().optional(),
    QBO_DEPOSIT_ACCOUNT_UNIONBANK: z.string().optional(),
    QBO_DEPOSIT_ACCOUNT_DIGIMA: z.string().optional(),
    QBO_DEPOSIT_ACCOUNT_HAPPYMED: z.string().optional(),
    QBO_DEPOSIT_ACCOUNT_CASH: z.string().optional(),
    QBO_BANK_FEE_ACCOUNT_ID: z.string().optional(),

    SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 chars'),
    DEFAULT_FEE_PERCENT: z.coerce.number().min(0).max(20).default(1.5), // pre-fills the approval screen's "apply fee" button
    ESTIMATE_LOOKBACK_DAYS: z.coerce.number().int().min(30).default(365),
});

export type Env = z.infer<typeof schema>;

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}

const env: Env = parsed.data;
export default env;
