import crypto from 'crypto';
import { z } from 'zod';

// One-time invite links. The raw token is shown to the SuperAdmin once; only its hash is stored.

export const INVITE_TTL_DAYS = 7;

/** 32 random bytes as base64url is always 43 characters. */
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export function createInvite(now = new Date()) {
    const token = crypto.randomBytes(32).toString('base64url');
    return { token, hash: hashToken(token), expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000) };
}
