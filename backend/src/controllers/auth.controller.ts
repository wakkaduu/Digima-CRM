import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import { loadUser } from '../middleware/requireRole';
import * as userModel from '../models/user.model';
import { hashToken, inviteTokenSchema } from '../services/invite.service';
import { hashPassword, verifyPassword } from '../services/password';
import { changePasswordSchema } from '../validators/auth.validator';
import HttpError from '../utils/HttpError';
import asyncHandler from '../utils/asyncHandler';

const publicUser = (u: User) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    /** Can sign in with email and password (and so change it). */
    hasPassword: Boolean(u.passwordHash),
});

// The only way in is Sign in with QuickBooks (qbo.controller.ts), which starts the session.

export const logout = (req: Request, res: Response) => {
    // The QuickBooks connection stays: signing in again does not need a fresh connection until Intuit says it has expired.
    req.session = null;
    res.json({ ok: true });
};

export const me = asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    res.json({ user: user ? publicUser(user) : null });
});

// POST /api/auth/change-password   { currentPassword, newPassword }   (signed in, with a password)
export const changePassword = asyncHandler(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const { currentPassword, newPassword } = parsed.data;

    if (!req.user.passwordHash) throw new HttpError(409, 'This account signs in with QuickBooks and has no password.');
    if (!(await verifyPassword(currentPassword, req.user.passwordHash))) throw new HttpError(422, 'The current password is incorrect.');
    if (currentPassword === newPassword) throw new HttpError(422, 'Choose a password that is different from the current one.');

    await userModel.updatePassword(req.user.id, await hashPassword(newPassword));
    res.json({ ok: true });
});

const invalidInvite = () => new HttpError(404, 'This invite link is not valid, has expired, or was already used.', { code: 'INVITE_INVALID' });

/** The account behind a live invite token, or null. */
async function liveInvite(token: unknown) {
    const parsed = inviteTokenSchema.safeParse(token);
    if (!parsed.success) return null;
    const hash = hashToken(parsed.data);
    const user = await userModel.findByInviteHash(hash);
    if (!user || !user.active || !user.inviteExpiresAt || user.inviteExpiresAt <= new Date()) return null;
    return { user, hash };
}

// POST /api/auth/invite   { token }   (public)
// Checks a one-time invite link and remembers it (as a hash) in this browser's session; the next
// "Sign in with QuickBooks" then links that Intuit login to the invited account.
export const acceptInvite = asyncHandler(async (req, res) => {
    const invite = await liveInvite(req.body?.token);
    if (!invite) throw invalidInvite();

    req.session!.inviteHash = invite.hash;
    res.json({ name: invite.user.name, email: invite.user.email, role: invite.user.role });
});
