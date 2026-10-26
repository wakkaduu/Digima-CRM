import type { User } from '@prisma/client';
import * as userModel from '../models/user.model';
import * as qboTokenModel from '../models/qboToken.model';
import env from '../config/env';
import { createInvite } from '../services/invite.service';
import { createUserSchema, updateUserSchema, userIdSchema } from '../validators/user.validator';
import HttpError from '../utils/HttpError';
import asyncHandler from '../utils/asyncHandler';

// Account management (SuperAdmin only). A SuperAdmin adds a person and shares the one-time invite link; the person
// links their Intuit identity by opening it and signing in with QuickBooks. The email is only a label.

const parse = <T>(result: { success: true; data: T } | { success: false; error: { issues: { message: string }[] } }) => {
    if (!result.success) throw new HttpError(400, result.error.issues[0].message);
    return result.data;
};

const inviteUrl = (token: string) => `${env.FRONTEND_URL}/invite#${token}`; // fragment: never sent to any server or log

const toDto = (u: Pick<User, 'id' | 'name' | 'email' | 'role' | 'active' | 'qboSub' | 'inviteTokenHash' | 'inviteExpiresAt' | 'createdAt'> & { qboToken?: { updatedAt: Date } | null }) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    /** Has linked their Intuit account (accepted an invite or signed in). */
    linked: Boolean(u.qboSub),
    /** An invite link is outstanding (it may have expired: compare with inviteExpiresAt). The link itself is never returned again. */
    invitePending: Boolean(u.inviteTokenHash),
    inviteExpiresAt: u.inviteTokenHash ? u.inviteExpiresAt : null,
    lastQboConnectionAt: u.qboToken?.updatedAt ?? null,
    createdAt: u.createdAt,
});

// GET /api/users
export const list = asyncHandler(async (req, res) => {
    res.json({ users: (await userModel.listAll()).map(toDto) });
});

// POST /api/users   { name, email, role }
export const create = asyncHandler(async (req, res) => {
    const body = parse(createUserSchema.safeParse(req.body));
    if (await userModel.findByEmail(body.email)) throw new HttpError(409, 'An account with that email already exists.');
    const invite = createInvite();
    let user;
    try {
        user = await userModel.create({ ...body, inviteTokenHash: invite.hash, inviteExpiresAt: invite.expiresAt });
    } catch (err: any) {
        if (err.code === 'P2002') throw new HttpError(409, 'An account with that email already exists.'); // lost a race with the check above
        throw err;
    }
    res.status(201).json({ user: toDto(user), inviteUrl: inviteUrl(invite.token), inviteExpiresAt: invite.expiresAt });
});

// POST /api/users/:id/invite   -> a fresh one-time link (lost or expired link, or a different Intuit login). Replaces the old one.
export const reinvite = asyncHandler(async (req, res) => {
    const id = parse(userIdSchema.safeParse(req.params.id));
    const target = await userModel.findById(id);
    if (!target) throw new HttpError(404, 'Account not found');
    if (!target.active) throw new HttpError(409, 'Reactivate this account before inviting them.');

    const invite = createInvite();
    const user = await userModel.setInvite(id, invite.hash, invite.expiresAt);
    res.json({ user: toDto(user), inviteUrl: inviteUrl(invite.token), inviteExpiresAt: invite.expiresAt });
});

// PATCH /api/users/:id   { name?, role?, active? }
export const update = asyncHandler(async (req, res) => {
    const id = parse(userIdSchema.safeParse(req.params.id));
    const patch = parse(updateUserSchema.safeParse(req.body));

    const target = await userModel.findById(id);
    if (!target) throw new HttpError(404, 'Account not found');

    const losesSuperadmin =
        target.role === 'superadmin' &&
        target.active &&
        ((patch.role !== undefined && patch.role !== 'superadmin') || patch.active === false);

    if (losesSuperadmin) {
        if (target.id === req.user.id) {
            throw new HttpError(409, 'You cannot demote or deactivate your own account.', { code: 'SELF_LOCKOUT' });
        }
        if ((await userModel.countActiveByRole('superadmin')) <= 1) {
            throw new HttpError(409, 'There must be at least one active SuperAdmin.', { code: 'LAST_SUPERADMIN' });
        }
    }
    if (target.id === req.user.id && patch.active === false) {
        throw new HttpError(409, 'You cannot deactivate your own account.', { code: 'SELF_LOCKOUT' });
    }

    const user = await userModel.update(id, patch);
    // A deactivated person loses their QuickBooks connection too, not just their session.
    if (patch.active === false) await qboTokenModel.remove(id);
    res.json({ user: toDto(user) });
});
