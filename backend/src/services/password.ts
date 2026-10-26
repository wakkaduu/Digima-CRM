import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt) as (
    password: string,
    salt: Buffer,
    keylen: number
) => Promise<Buffer>;
const KEYLEN = 64;

export async function hashPassword(password: string) {
    const salt = crypto.randomBytes(16);
    const key = await scrypt(password, salt, KEYLEN);
    return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
    const [scheme, saltHex, keyHex] = String(stored).split('$');
    if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
    try {
        const expected = Buffer.from(keyHex, 'hex');
        if (expected.length === 0) return false;
        const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
        return crypto.timingSafeEqual(actual, expected);
    } catch {
        return false; // a malformed stored hash is a failed login, never a crash
    }
}
