const { prisma } = require('../config/prisma');
const { HttpError } = require('./errorHandler');

// Reads the logged-in user from the DB (so deactivation and role changes apply at once).
async function loadUser(req) {
    const s = req.session && req.session.user;
    if (!s || !s.id) return null;

    const user = await prisma.user.findUnique({ where: { id: s.id } });
    if (!user || !user.active) {
        req.session = null;
        return null;
    }
    if (s.name !== user.name || s.role !== user.role) {
        req.session.user = { id: user.id, name: user.name, role: user.role };
    }
    return user;
}

// Any logged-in user (used for changing your own password).
const requireAuth = async (req, res, next) => {
    try {
        const user = await loadUser(req);
        if (!user) return next(new HttpError(401, 'Please log in first'));
        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
};

// Admin is a superset of sales.
const requireRole = (...roles) => async (req, res, next) => {
    try {
        const user = await loadUser(req);
        if (!user) return next(new HttpError(401, 'Please log in first'));
        if (user.mustChangePassword) {
            return next(new HttpError(403, 'You must set a new password before continuing.', { code: 'MUST_CHANGE_PASSWORD' }));
        }
        if (user.role !== 'admin' && !roles.includes(user.role)) {
            return next(new HttpError(403, 'You do not have access to this resource'));
        }
        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = requireRole;
module.exports.requireAuth = requireAuth;
module.exports.loadUser = loadUser; 