import crypto from 'crypto';
import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import { loadUser } from '../middleware/requireRole';
import * as userModel from '../models/user.model';
import { hashToken, inviteTokenSchema } from '../services/invite.service';
import { hashPassword, verifyPassword } from '../services/password';
import { changePasswordSchema, inviteSetPasswordSchema, loginSchema } from '../validators/auth.validator';
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

// Two ways in: email and password (below), or Sign in with QuickBooks (qbo.controller.ts). Both end in the same session.

/** A brand-new session for this user: nothing left over from an earlier sign-in attempt. */
const startSession = (req: Request, user: User) => {
    req.session = { user: { id: user.id, name: user.name, role: user.role } };
};

// Compared against when the email doesn't exist, so response time doesn't reveal which emails are real.
let dummyHash: string | undefined;
const getDummyHash = async () => (dummyHash ||= await hashPassword(crypto.randomBytes(8).toString('hex')));

// POST /api/auth/login   { email, password }
export const login = asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Enter your email address and password.');

    const { email, password } = parsed.data;
    const user = await userModel.findByEmail(email);
    const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

    // Same answer whether the email is unknown, has no password (QuickBooks-only), or the password is wrong.
    if (!user || !user.passwordHash || !ok) throw new HttpError(401, 'Incorrect email or password.');
    if (!user.active) throw new HttpError(403, 'This account has been deactivated. Please contact a SuperAdmin.');
    if (user.mustChangePassword) {
        // A password from the old system (a temporary one an admin chose): not trusted any more.
        throw new HttpError(403, 'Your password needs to be reset. Ask a SuperAdmin for an invite link and set a new one.', { code: 'PASSWORD_RESET_REQUIRED' });
    }

    startSession(req, user);
    res.json({ user: publicUser(user) });
});

export const logout = (req: Request, res: Response) => {
    // The QuickBooks connection stays: someone who signs in by email does not go through Intuit again each time.
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

// POST /api/auth/invite/password   { token, password }   (public)
// The other way to use an invite link: choose a password, and sign in with it from then on. Also resets a forgotten one.
export const setPasswordFromInvite = asyncHandler(async (req, res) => {
    const parsed = inviteSetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        const tokenIssue = parsed.error.issues.some((i) => i.path[0] === 'token');
        throw tokenIssue ? invalidInvite() : new HttpError(400, parsed.error.issues[0].message);
    }

    const invite = await liveInvite(parsed.data.token); // checked before hashing, so junk tokens cannot burn CPU
    if (!invite) throw invalidInvite();

    const user = await userModel.setPasswordWithInvite(invite.hash, await hashPassword(parsed.data.password));
    if (!user) throw invalidInvite(); // used or expired while we were hashing

    startSession(req, user);
    res.json({ user: publicUser(user) });
});
