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

// Any signed-in user (their own QuickBooks connection status, for example).
export const requireAuth: RequestHandler = async (req, res, next) => {
    try {
        const user = await loadUser(req);
        if (!user) return next(new HttpError(401, 'Please sign in first'));
        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
};

// Strict roles: a route lists exactly who may use it (see config/roles.ts). Admin is NOT a superset of sales
// (admins approve payments; only sales submit them), and SuperAdmin does neither.
export const requireRole = (...roles: string[]): RequestHandler => async (req, res, next) => {
    try {
        const user = await loadUser(req);
        if (!user) return next(new HttpError(401, 'Please sign in first'));
        if (!roles.includes(user.role)) {
            return next(new HttpError(403, 'You do not have access to this resource'));
        }
        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
};
