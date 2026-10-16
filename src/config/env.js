require('dotenv').config();
const { z } = require('zod');

const schema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),
    APP_BASE_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),

    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_API_KEY: z.string().min(1),
    CLOUDINARY_API_SECRET: z.string().min(1),
    CLOUDINARY_FOLDER: z.string().default('payment-proofs'),

    QBO_CLIENT_ID: z.string().min(1),
    QBO_CLIENT_SECRET: z.string().min(1),
    QBO_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
    QBO_REDIRECT_URI: z.string().url(),
    QBO_DEPOSIT_ACCOUNT_BDO: z.string().optional(),
    QBO_DEPOSIT_ACCOUNT_UNIONBANK: z.string().optional(),
    QBO_DEPOSIT_ACCOUNT_DIGIMA: z.string().optional(),
    QBO_DEPOSIT_ACCOUNT_HAPPYMEAL: z.string().optional(),
    QBO_BANK_FEE_ACCOUNT_ID: z.string().optional(),

    SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 chars'),
    ESTIMATE_LOOKBACK_DAYS: z.coerce.number().int().min(30).default(365),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
}

module.exports = parsed.data;