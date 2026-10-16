import crypto from 'crypto';
import type { Request, Response } from 'express';
import env from '../config/env';
import asyncHandler from '../utils/asyncHandler';
import HttpError from '../utils/HttpError';
import * as qbo from '../services/qbo.service';

// GET /api/qbo/estimates?q=<customer or estimate #>&refresh=true
export const listEstimates = asyncHandler(async (req, res) => {
    const estimates = await qbo.getOpenEstimates({
        search: typeof req.query.q === 'string' ? req.query.q : undefined,
        forceRefresh: req.query.refresh === 'true',
    });
    res.json({ count: estimates.length, estimates });
});

/* ── QuickBooks OAuth (admin only) ── */

const safeEqual = (a: unknown, b: unknown) => {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
};

// GET /api/auth/qbo
export const connect = (req: Request, res: Response) => {
    const state = crypto.randomBytes(16).toString('hex');
    req.session!.qboState = state;
    res.redirect(qbo.getAuthorizeUrl(state));
};

// GET /api/auth/qbo/callback
export const callback = asyncHandler(async (req, res) => {
    const { state, error } = req.query;

    if (error) {
        return res.redirect(`${env.FRONTEND_URL}/setup?qbo=error&reason=${encodeURIComponent(String(error))}`);
    }

    const expectedState = req.session!.qboState;
    req.session!.qboState = null;
    if (!expectedState || !state || !safeEqual(state, expectedState)) {
        throw new HttpError(400, 'Invalid OAuth state. Please try connecting again.');
    }

    await qbo.handleCallback(`${env.APP_BASE_URL}${req.originalUrl}`);
    res.redirect(`${env.FRONTEND_URL}/setup?qbo=connected`);
});

// GET /api/auth/qbo/status
export const status = asyncHandler(async (req, res) => {
    const status = await qbo.getConnectionStatus();
    if (status.connected && req.query.verify === 'true') {
        try {
            const info = await qbo.getCompanyInfo();
            status.companyName = info.CompanyName;
        } catch (err: any) {
            status.verifyError = err.message;
        }
    }
    res.json(status);
});
