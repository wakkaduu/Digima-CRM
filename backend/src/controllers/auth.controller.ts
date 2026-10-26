import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import * as qboTokenModel from '../models/qboToken.model';
import { loadUser } from '../middleware/requireRole';
import * as userModel from '../models/user.model';
import { hashToken, inviteTokenSchema } from '../services/invite.service';
import HttpError from '../utils/HttpError';
import asyncHandler from '../utils/asyncHandler';

const publicUser = (u: User) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
});

// Sign-in is QuickBooks SSO only (see qbo.controller.ts); this file is just the session.

export const logout = asyncHandler(async (req: Request, res: Response) => {
    // The QuickBooks token is only needed while signed in; the next sign-in issues a new one.
    const id = req.session?.user?.id;
    if (id) await qboTokenModel.remove(id);
    req.session = null;
    res.json({ ok: true });
});

export const me = asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    res.json({ user: user ? publicUser(user) : null });
});

// POST /api/auth/invite   { token }   (public)
// Checks a one-time invite link and remembers it (as a hash) in this browser's session; the next
// "Sign in with QuickBooks" then links that Intuit login to the invited account.
export const acceptInvite = asyncHandler(async (req, res) => {
    const invalid = () => new HttpError(404, 'This invite link is not valid, has expired, or was already used.', { code: 'INVITE_INVALID' });
    const parsed = inviteTokenSchema.safeParse(req.body?.token);
    if (!parsed.success) throw invalid();

    const hash = hashToken(parsed.data);
    const user = await userModel.findByInviteHash(hash);
    if (!user || !user.active || !user.inviteExpiresAt || user.inviteExpiresAt <= new Date()) throw invalid();

    req.session!.inviteHash = hash;
    res.json({ name: user.name, role: user.role });
});
