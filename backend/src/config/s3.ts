import { S3Client } from '@aws-sdk/client-s3';
import env from './env';

export const s3 = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    // Only send/verify checksums when an operation requires them: non-AWS stores often reject the SDK's newer default headers.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
});

export const bucket = env.S3_BUCKET;
