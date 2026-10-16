const crypto = require('crypto');
const { z } = require('zod');
const env = require('../config/env');
const { prisma } = require('../config/prisma');
const qbo = require('../services/qbo.service');
const { hashPassword, verifyPassword } = require('../services/password');
const { loadUser } = require('../middleware/requireRole');
const { HttpError, asyncHandler } = require('../middleware/errorHandler');

const safeEqual = (a, b) => {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
};

const publicUser = (u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
});

// Compared against when the email doesn't exist, so response time doesn't reveal which emails are real.
let dummyHash;
const getDummyHash = async () => (dummyHash ||= await hashPassword(crypto.randomBytes(8).toString('hex')));

const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1).max(200),
});

const changeSchema = z.object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'The new password must be at least 8 characters').max(200),
});

/* ── App accounts ── */

exports.login = asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'Enter your email address and password.');

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    const ok = await verifyPassword(password, user ? user.passwordHash : await getDummyHash());

    if (!user || !ok) throw new HttpError(401, 'Incorrect email or password.');
    if (!user.active) throw new HttpError(403, 'This account has been deactivated. Please contact an admin.');

    req.session.user = { id: user.id, name: user.name, role: user.role };
    res.json({ user: publicUser(user) });
});

exports.logout = (req, res) => {
    req.session = null;
    res.json({ ok: true });
};

exports.me = asyncHandler(async (req, res) => {
    const user = await loadUser(req);
    res.json({ user: user ? publicUser(user) : null });
});

exports.changePassword = asyncHandler(async (req, res) => {
    const parsed = changeSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const { currentPassword, newPassword } = parsed.data;

    if (!(await verifyPassword(currentPassword, req.user.passwordHash))) {
        throw new HttpError(422, 'The current password is incorrect.');
    }
    if (currentPassword === newPassword) {
        throw new HttpError(422, 'Choose a password that is different from the current one.');
    }

    await prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    });
    res.json({ ok: true });
});

/* ── QuickBooks OAuth (unchanged) ── */

exports.qboConnect = (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.qboState = state;
    res.redirect(qbo.getAuthorizeUrl(state));
};

exports.qboCallback = asyncHandler(async (req, res) => {
    const { state, error } = req.query;

    if (error) {
        return res.redirect(`/setup.html?qbo=error&reason=${encodeURIComponent(error)}`);
    }

    const expectedState = req.session.qboState;
    req.session.qboState = null;
    if (!expectedState || !state || !safeEqual(state, expectedState)) {
        throw new HttpError(400, 'Invalid OAuth state. Please try connecting again.');
    }

    await qbo.handleCallback(`${env.APP_BASE_URL}${req.originalUrl}`);
    res.redirect('/setup.html?qbo=connected');
});

exports.qboStatus = asyncHandler(async (req, res) => {
    const status = await qbo.getConnectionStatus();
    if (status.connected && req.query.verify === 'true') {
        try {
            const info = await qbo.getCompanyInfo();
            status.companyName = info.CompanyName;
        } catch (err) {
            status.verifyError = err.message;
        }
    }
    res.json(status);
});