import crypto from 'crypto';
import type { Request, Response } from 'express';
import env from '../config/env';
import asyncHandler from '../utils/asyncHandler';
import HttpError from '../utils/HttpError';
import * as qbo from '../services/qbo.service';
import * as qboAuth from '../services/qboAuth.service';
import * as qboTokenModel from '../models/qboToken.model';
import { estimateSearchSchema } from '../validators/payment.validator';
import { callbackParamsSchema, safeNextSchema } from '../validators/auth.validator';

// GET /api/qbo/estimates?q=<customer or estimate #>&limit=<1-50>&refresh=true
// Without `limit` every match is returned (the setup page's connection test relies on that).
export const listEstimates = asyncHandler(async (req, res) => {
    const parsed = estimateSearchSchema.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const { q, limit, refresh } = parsed.data;

    const { estimates, total } = await qbo.getOpenEstimates({ search: q, limit, forceRefresh: refresh === 'true' });
    res.json({ count: estimates.length, total, estimates });
});

/* ── Sign in with QuickBooks ── */

const safeEqual = (a: unknown, b: unknown) => {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
};

// GET /api/auth/qbo/login?next=/some/path   (public)
export const login = (req: Request, res: Response) => {
    const state = crypto.randomBytes(16).toString('hex');
    const next = safeNextSchema.safeParse(req.query.next);
    req.session!.qboState = state;
    req.session!.next = next.success ? next.data : null;
    res.redirect(qboAuth.getAuthorizeUrl(state));
};

// GET /api/auth/qbo/callback   (public; Intuit redirects the browser here)
// Failures go back to the login page as ?error=<code> because the browser, not a script, is waiting.
export const callback = asyncHandler(async (req, res) => {
    const { state, error } = req.query;
    const toLogin = (code: string) => res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(code)}`);

    const expectedState = req.session!.qboState;
    const next = req.session!.next;
    const inviteHash = req.session!.inviteHash;
    req.session!.qboState = null;
    req.session!.inviteHash = null;
    req.session!.next = null;

    if (error) {
        console.error('QBO sign-in refused by Intuit:', String(error), String(req.query.error_description ?? ''));
        return toLogin(error === 'access_denied' ? 'access_denied' : 'sign_in_failed');
    }
    if (!expectedState || !state || !safeEqual(state, expectedState)) {
        console.error('QBO sign-in failed: the state did not match the session (cookie lost or the page was reloaded).');
        return toLogin('sign_in_failed');
    }

    const params = callbackParamsSchema.safeParse(req.query);
    if (!params.success) {
        console.error('QBO sign-in failed: the callback is missing or has malformed code/state/realmId.');
        return toLogin('sign_in_failed');
    }

    try {
        const user = await qboAuth.signIn(params.data, inviteHash);
        req.session!.user = { id: user.id, name: user.name, role: user.role };
    } catch (err) {
        if (err instanceof qboAuth.SignInError) return toLogin(err.code);
        throw err;
    }
    res.redirect(`${env.FRONTEND_URL}${next || '/'}`);
});

// GET /api/auth/qbo/status   (any signed-in user: their own connection)
export const status = asyncHandler(async (req, res) => {
    const status = await qbo.getConnectionStatus(req.user.id);
    if (status.connected && req.query.verify === 'true') {
        try {
            const info = await qbo.getCompanyInfo();
            status.companyName = info.CompanyName;
            await qboTokenModel.markVerified(req.user.id);
            status.lastVerifiedAt = new Date();
        } catch (err: any) {
            status.verifyError = err.message;
            if (err.details?.code === 'QBO_REAUTH_REQUIRED') status.needsReauth = true;
        }
    }
    res.json(status);
});
