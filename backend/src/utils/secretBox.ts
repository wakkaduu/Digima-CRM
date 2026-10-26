import crypto from 'crypto';

// AES-256-GCM for secrets stored in the database (QuickBooks tokens). Without a key nothing is encrypted, and values
// written earlier in plaintext stay readable, so turning encryption on needs no migration: tokens are encrypted the
// next time they are saved (every sign-in and every hourly refresh).

const PREFIX = 'enc:v1:';

/** Reads a base64 key; null when unset. Throws on a key that is not exactly 32 bytes. */
export function parseKey(base64: string | undefined): Buffer | null {
    if (!base64) return null;
    const key = Buffer.from(base64, 'base64');
    if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)');
    return key;
}

export function encrypt(plain: string, key: Buffer | null): string {
    if (!key) return plain;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return PREFIX + [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

/** Throws if the value is encrypted and the key is missing, wrong, or the value was tampered with. */
export function decrypt(stored: string, key: Buffer | null): string {
    if (!stored.startsWith(PREFIX)) return stored; // written before encryption was turned on
    if (!key) throw new Error('A stored secret is encrypted but TOKEN_ENCRYPTION_KEY is not set');
    const [iv, tag, data] = stored.slice(PREFIX.length).split('.').map((p) => Buffer.from(p, 'base64url'));
    if (!iv || !tag || !data) throw new Error('Malformed encrypted value');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
