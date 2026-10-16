const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const requireRole = require('../middleware/requireRole');
const { requireAuth } = requireRole;

// App accounts
router.post('/login', ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', ctrl.me);
router.post('/change-password', requireAuth, ctrl.changePassword);

// QuickBooks OAuth (admin only)
router.get('/qbo', requireRole('admin'), ctrl.qboConnect);
router.get('/qbo/callback', requireRole('admin'), ctrl.qboCallback);
router.get('/qbo/status', requireRole('admin'), ctrl.qboStatus);

module.exports = router;