import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller';
import * as qboCtrl from '../controllers/qbo.controller';
import { requireRole, requireAuth } from '../middleware/requireRole';

const router = Router();

// App accounts
router.post('/login', ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', ctrl.me);
router.post('/change-password', requireAuth, ctrl.changePassword);

// QuickBooks OAuth (admin only)
router.get('/qbo', requireRole('admin'), qboCtrl.connect);
router.get('/qbo/callback', requireRole('admin'), qboCtrl.callback);
router.get('/qbo/status', requireRole('admin'), qboCtrl.status);

export default router;