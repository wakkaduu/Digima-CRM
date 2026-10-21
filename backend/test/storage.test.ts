// Receipt storage against a local S3-compatible server (MinIO, moto, ...). Skipped unless S3_ENDPOINT is local,
// so it can never write to the real bucket. Start one, point S3_* at it in .env, then `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CreateBucketCommand, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import sharp from 'sharp';

import env from '../src/config/env';
import { bucket, s3 } from '../src/config/s3';
import * as storage from '../src/services/storage.service';
import { RECEIPT_WIDTHS } from '../src/validators/payment.validator';

const isLocal = ['localhost', '127.0.0.1'].includes(new URL(env.S3_ENDPOINT).hostname);
const png = (width: number, height = 40) =>
    sharp({ create: { width, height, channels: 3, background: '#336699' } }).png().toBuffer();
const keysUnder = async (prefix: string) =>
    ((await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }))).Contents ?? []).map((o) => o.Key!);

let reachable = false;
test.before(async () => {
    if (!isLocal) return;
    try {
        await s3.send(new HeadBucketCommand({ Bucket: bucket })).catch(() => s3.send(new CreateBucketCommand({ Bucket: bucket })));
        reachable = true;
    } catch {
        /* no local S3 running: tests below skip */
    }
});
const t = (name: string, fn: () => Promise<void>) => test(name, async (ctx) => (reachable ? fn() : ctx.skip('no local S3 server')));

t('upload keeps the original byte for byte and writes one resized webp per width', async () => {
    const original = await png(1600);
    const { key, location } = await storage.uploadProof(original);

    assert.match(key, new RegExp(`^${env.S3_PREFIX}/[0-9a-f-]{36}$`));
    assert.equal(location, `s3://${bucket}/${key}/original`);
    assert.equal((await keysUnder(key)).length, 1 + RECEIPT_WIDTHS.length);

    const full = await storage.getReceipt(key);
    assert.equal(full.contentType, 'image/png');
    assert.ok(full.body.equals(original));
    assert.equal(await storage.verifyReceipt(key, original.length), true);
    assert.equal(await storage.verifyReceipt(key, original.length + 1), false);

    for (const w of RECEIPT_WIDTHS) {
        const v = await storage.getReceipt(key, w);
        assert.equal(v.contentType, 'image/webp');
        assert.equal((await sharp(v.body).metadata()).width, w);
    }
    await storage.deleteReceipt(key);
});

t('small images are never upscaled', async () => {
    const { key } = await storage.uploadProof(await png(300));
    for (const w of RECEIPT_WIDTHS) {
        assert.equal((await sharp((await storage.getReceipt(key, w)).body).metadata()).width, 300);
    }
    await storage.deleteReceipt(key);
});

t('copies are rotated by EXIF and stripped of metadata', async () => {
    const tilted = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#aa0000' } })
        .jpeg()
        .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'secret' } } })
        .toBuffer();
    const { key } = await storage.uploadProof(tilted);
    const meta = await sharp((await storage.getReceipt(key, 400)).body).metadata();
    assert.deepEqual([meta.width, meta.height], [100, 200]); // orientation 6 = rotated a quarter turn
    assert.equal(meta.exif, undefined);
    await storage.deleteReceipt(key);
});

t('a file that is not a supported image is refused before anything is stored', async () => {
    const before = (await keysUnder(env.S3_PREFIX)).length;
    await assert.rejects(storage.uploadProof(Buffer.from('<html>not an image</html>')), { status: 400 });
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } }).gif().toBuffer();
    await assert.rejects(storage.uploadProof(gif), { status: 400 });
    assert.equal((await keysUnder(env.S3_PREFIX)).length, before);
});

t('delete removes every object; reading a missing receipt is a 502, not a crash', async () => {
    const { key } = await storage.uploadProof(await png(500));
    await storage.deleteReceipt(key);
    assert.deepEqual(await keysUnder(key), []);
    await assert.rejects(storage.getReceipt(key), { status: 502 });
    await storage.deleteReceipt(key); // deleting twice is harmless
});

// Who may read a receipt and what comes back (the database lookup itself is not involved).
import { sendReceipt } from '../src/controllers/payment.controller';

async function callReceipt(user: { id: string; role: string }, row: object, width?: number) {
    const res: any = {
        headers: {} as Record<string, string>,
        set(h: Record<string, string>) { Object.assign(this.headers, h); return this; },
        send(b: Buffer) { this.body = b; return this; },
    };
    let error: any;
    await sendReceipt(res, row as never, user as never, width).catch((e) => { error = e; });
    return { res, error };
}

t('receipts are streamed from S3 to the owner and admins, nobody else', async () => {
    const original = await png(1200);
    const { key } = await storage.uploadProof(original);
    const row = { submittedById: 'sales-1', proofImageUrl: 's3://x', proofPublicId: null, proofKey: key };

    const own = await callReceipt({ id: 'sales-1', role: 'sales' }, row);
    assert.equal(own.res.headers['Content-Type'], 'image/png');
    assert.equal(own.res.headers['X-Content-Type-Options'], 'nosniff');
    assert.ok(own.res.body.equals(original));

    const admin = await callReceipt({ id: 'admin-1', role: 'admin' }, row, 400);
    assert.equal(admin.res.headers['Content-Type'], 'image/webp');
    assert.equal((await sharp(admin.res.body).metadata()).width, 400);

    const other = await callReceipt({ id: 'sales-2', role: 'sales' }, row);
    assert.equal(other.error.status, 403);
    assert.equal(other.res.body, undefined);
    await storage.deleteReceipt(key);
});
