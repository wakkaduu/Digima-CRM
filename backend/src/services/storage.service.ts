import { randomUUID } from 'node:crypto';
import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { bucket, s3 } from '../config/s3';
import env from '../config/env';
import HttpError from '../utils/HttpError';
import { RECEIPT_WIDTHS } from '../validators/payment.validator';

// A receipt is one "folder" of objects under a random key prefix:
//   <prefix>/<uuid>/original        the file exactly as uploaded
//   <prefix>/<uuid>/w400.webp ...   resized copies (one per RECEIPT_WIDTHS), never upscaled
// The prefix is stored in payments.proof_key. The bucket stays private; images are streamed through the portal.

const MAX_PIXELS = 40_000_000; // refuses decompression bombs (a 5 MB file can expand to a huge bitmap)
const CONTENT_TYPES: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const originalKey = (key: string) => `${key}/original`;
const variantKey = (key: string, width: number) => `${key}/w${width}.webp`;

export interface StoredReceipt {
    key: string;
    /** What goes into the NOT NULL proof_image_url column. Not served to browsers. */
    location: string;
}

function put(Key: string, Body: Buffer, ContentType: string) {
    return s3.send(
        new PutObjectCommand({ Bucket: bucket, Key, Body, ContentType, ContentLength: Body.length, CacheControl: 'private, max-age=3600' })
    );
}

/** Resizes into one webp per allowed width. Auto-rotates by EXIF and strips metadata from the copies. */
async function makeVariants(buffer: Buffer) {
    return Promise.all(
        RECEIPT_WIDTHS.map(async (width) => ({
            width,
            body: await sharp(buffer, { limitInputPixels: MAX_PIXELS })
                .rotate()
                .resize({ width, withoutEnlargement: true })
                .webp({ quality: 80 })
                .toBuffer(),
        }))
    );
}

export async function uploadProof(buffer: Buffer): Promise<StoredReceipt> {
    let contentType: string;
    let variants: Awaited<ReturnType<typeof makeVariants>>;
    try {
        const format = (await sharp(buffer, { limitInputPixels: MAX_PIXELS }).metadata()).format;
        if (!format || !CONTENT_TYPES[format]) throw new Error(`unsupported format ${format}`);
        contentType = CONTENT_TYPES[format];
        variants = await makeVariants(buffer);
    } catch (err) {
        console.error('Receipt image could not be processed:', (err as Error).message);
        throw new HttpError(400, 'The receipt could not be read as a JPG, PNG or WebP image');
    }

    const key = `${env.S3_PREFIX}/${randomUUID()}`;
    const objects = [
        { Key: originalKey(key), Body: buffer, ContentType: contentType },
        ...variants.map((v) => ({ Key: variantKey(key, v.width), Body: v.body, ContentType: 'image/webp' })),
    ];
    try {
        await Promise.all(objects.map((o) => put(o.Key, o.Body, o.ContentType)));
    } catch (err) {
        console.error('Receipt upload failed:', (err as Error).message || err);
        await deleteReceipt(key); // partial uploads must not linger
        throw new HttpError(502, 'Could not upload the receipt image. Please try again.');
    }
    return { key, location: `s3://${bucket}/${originalKey(key)}` };
}

/** The stored copy at `width` (one of RECEIPT_WIDTHS), or the original when no width is given. */
export async function getReceipt(key: string, width?: number) {
    const Key = width ? variantKey(key, width) : originalKey(key);
    try {
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key }));
        return {
            body: Buffer.from(await res.Body!.transformToByteArray()),
            contentType: res.ContentType || 'application/octet-stream',
        };
    } catch (err) {
        console.error('Receipt read failed:', Key, (err as Error).message || err);
        throw new HttpError(502, 'Could not load the receipt image.');
    }
}

/** True when the original exists with the expected size. Used by the backfill to verify a copy. */
export async function verifyReceipt(key: string, expectedBytes: number) {
    try {
        const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: originalKey(key) }));
        return head.ContentLength === expectedBytes;
    } catch {
        return false;
    }
}

/** Best effort: removes every object of a receipt. Never throws (used on rollback paths). */
export async function deleteReceipt(key: string) {
    try {
        // One request per object: the batch DeleteObjects call needs a Content-MD5 header that UpCloud demands and the SDK no longer sends.
        const keys = [originalKey(key), ...RECEIPT_WIDTHS.map((w) => variantKey(key, w))];
        await Promise.all(keys.map((Key) => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key }))));
    } catch (err) {
        console.error('Receipt cleanup failed for', key, (err as Error).message || err);
    }
}
