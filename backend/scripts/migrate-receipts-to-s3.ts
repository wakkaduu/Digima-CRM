import 'dotenv/config';
import { prisma } from '../src/config/prisma';
import * as cloud from '../src/services/cloudinary.service';
import * as storage from '../src/services/storage.service';

// Copies receipts that still live on Cloudinary into the S3 bucket.
//   npm run receipts:migrate -- --dry-run         list what would be copied, change nothing
//   npm run receipts:migrate -- --limit 20        copy at most 20 (try a small batch first)
//   npm run receipts:migrate                      copy everything that is left
// Safe to re-run: rows are picked by `proof_key IS NULL`, and a row is only flipped after the copy is verified.
// Nothing is deleted from Cloudinary, and proof_image_url / proof_public_id are left as they are.

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : undefined;
if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
    console.error('--limit needs a positive whole number');
    process.exit(1);
}

const MAX_BYTES = 20 * 1024 * 1024; // uploads were capped at 5 MB; anything bigger is not a receipt we wrote
const CONCURRENCY = 3;

async function download(row: { proofImageUrl: string; proofPublicId: string | null }) {
    const url = row.proofPublicId ? cloud.signedUrl(row.proofPublicId) : row.proofImageUrl;
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('image/')) throw new Error(`Cloudinary answered ${res.status} ${type}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error(`file is ${buf.length} bytes, over the ${MAX_BYTES} limit`);
    return buf;
}

async function migrate(row: { id: string; proofImageUrl: string; proofPublicId: string | null }) {
    const buffer = await download(row);
    const stored = await storage.uploadProof(buffer);
    try {
        if (!(await storage.verifyReceipt(stored.key, buffer.length))) throw new Error('uploaded copy failed verification');
        // Only flips rows nobody else has migrated in the meantime.
        const { count } = await prisma.payment.updateMany({ where: { id: row.id, proofKey: null }, data: { proofKey: stored.key } });
        if (count === 0) throw new Error('row changed while copying');
    } catch (err) {
        await storage.deleteReceipt(stored.key);
        throw err;
    }
}

(async () => {
    const rows = await prisma.payment.findMany({
        where: { proofKey: null },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: { id: true, proofImageUrl: true, proofPublicId: true },
    });
    console.log(`${rows.length} receipt(s) on Cloudinary${limit ? ` (limited to ${limit})` : ''}${dryRun ? ' [dry run]' : ''}`);

    let done = 0;
    const failed: { id: string; reason: string }[] = [];
    const queue = [...rows];
    await Promise.all(
        Array.from({ length: dryRun ? 0 : CONCURRENCY }, async () => {
            for (let row = queue.shift(); row; row = queue.shift()) {
                try {
                    await migrate(row);
                    done++;
                    console.log(`ok   ${row.id}  (${done + failed.length}/${rows.length})`);
                } catch (err) {
                    const reason = (err as Error).message;
                    failed.push({ id: row.id, reason });
                    console.error(`FAIL ${row.id}: ${reason}`);
                }
            }
        })
    );

    if (dryRun) rows.forEach((r) => console.log(`would copy ${r.id}  ${r.proofPublicId ?? r.proofImageUrl}`));
    else console.log(`Copied ${done}, failed ${failed.length}.${failed.length ? ' Re-run to retry the failed ones.' : ''}`);
    if (failed.length) process.exitCode = 1;
})()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
