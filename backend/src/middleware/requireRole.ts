import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { User } from '@prisma/client';
import * as userModel from '../models/user.model';
import HttpError from '../utils/HttpError';

// Reads the logged-in user from the DB (so deactivation and role changes apply at once).
export async function loadUser(req: Request): Promise<User | null> {
    const s = req.session && req.session.user;
    if (!s || !s.id) return null;

    const user = await userModel.findById(s.id);
    if (!user || !user.active) {
        req.session = null;
        return null;
    }
    if (s.name !== user.name || s.role !== user.role) {
        req.session!.user = { id: user.id, name: user.name, role: user.role };
    }
    return user;
}

// Any logged-in user (used for changing your own password).
export const requireAuth: RequestHandler = async (req, res, next) => {
    try {
        const user = await loadUser(req);
        if (!user) return next(new HttpError(401, 'Please log in first'));
        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
};

// Strict roles: a route lists exactly who may use it. Admin is NOT a superset of sales
// (admins approve payments; only sales submit them).
export const requireRole = (...roles: string[]): RequestHandler => async (req, res, next) => {
    try {
        const user = await loadUser(req);
        if (!user) return next(new HttpError(401, 'Please log in first'));
        if (user.mustChangePassword) {
            return next(new HttpError(403, 'You must set a new password before continuing.', { code: 'MUST_CHANGE_PASSWORD' }));
        }
        if (!roles.includes(user.role)) {
            return next(new HttpError(403, 'You do not have access to this resource'));
        }
        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
};
