import type { QboToken } from '@prisma/client';
import { prisma } from '../config/prisma';
import env from '../config/env';
import { decrypt, encrypt, parseKey } from '../utils/secretBox';

// One row per user: the QuickBooks connection made when they signed in with QuickBooks.
// The tokens are encrypted at rest when TOKEN_ENCRYPTION_KEY is set; callers only ever see plaintext.

const key = parseKey(env.TOKEN_ENCRYPTION_KEY);

/** The user's connection, or null if they have none (or it can no longer be decrypted, which means "sign in again"). */
export async function get(userId: string): Promise<QboToken | null> {
    const row = await prisma.qboToken.findUnique({ where: { userId } });
    if (!row) return null;
    try {
        return { ...row, accessToken: decrypt(row.accessToken, key), refreshToken: decrypt(row.refreshToken, key) };
    } catch (err) {
        console.error(`QuickBooks tokens for user ${userId} cannot be decrypted; they must sign in again:`, (err as Error).message);
        return null;
    }
}

type TokenData = Omit<QboToken, 'userId' | 'updatedAt' | 'lastVerifiedAt'>;

export const save = (userId: string, data: TokenData) => {
    const sealed = { ...data, accessToken: encrypt(data.accessToken, key), refreshToken: encrypt(data.refreshToken, key) };
    return prisma.qboToken
        .upsert({ where: { userId }, create: { userId, ...sealed }, update: sealed })
        .then((row) => ({ ...row, accessToken: data.accessToken, refreshToken: data.refreshToken }));
};

/** Forgets a user's connection (logout, deactivation, or Intuit refusing to renew it). */
export const remove = (userId: string) => prisma.qboToken.deleteMany({ where: { userId } });

/** Records that Intuit just confirmed the stored connection works. No-op if the user has no connection. */
export const markVerified = (userId: string) =>
    prisma.qboToken.updateMany({ where: { userId }, data: { lastVerifiedAt: new Date() } });
