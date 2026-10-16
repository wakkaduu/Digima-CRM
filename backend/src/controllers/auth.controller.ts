import crypto from 'crypto';
import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import * as userModel from '../models/user.model';
import { loginSchema, changePasswordSchema } from '../validators/auth.validator';
import { hashPassword, verifyPassword } from '../services/password';
import { loadUser } from '../middleware/requireRole';
import HttpError from '../utils/HttpError';
import asyncHandler from '../utils/asyncHandler';

const publicUser = (u: User) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
});

// Compared against when the email doesn't exist, so response time doesn't reveal which emails are real.
let dummyHash: string | undefined;
const getDummyHash = async () => (dummyHash ||= await hashPassword(crypto.randomBytes(8).toString('hex')));

export const login = asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Enter your email address and password.');

    const { email, password } = parsed.data;
    const user = await userModel.findByEmail(email);
    const ok = await verifyPassword(password, user ? user.passwordHash : await getDummyHash());

    if (!user || !ok) throw new HttpError(401, 'Incorrect email or password.');
    if (!user.active) throw new HttpError(403, 'This account has been deactivated. Please contact an admin.');

    req.session!.user = { id: user.id, name: user.name, role: user.role };
    res.json({ user: publicUser(user) });
});

export const logout = (req: Request, res: Response) => {
    req.session = null;
    res.json({ ok: true });
};

export const me = asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    res.json({ user: user ? publicUser(user) : null });
});

export const changePassword = asyncHandler(async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const { currentPassword, newPassword } = parsed.data;

    if (!(await verifyPassword(currentPassword, req.user.passwordHash))) {
        throw new HttpError(422, 'The current password is incorrect.');
    }
    if (currentPassword === newPassword) {
        throw new HttpError(422, 'Choose a password that is different from the current one.');
    }

    await userModel.updatePassword(req.user.id, await hashPassword(newPassword));
    res.json({ ok: true });
});
