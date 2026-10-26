import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller';
import * as qboCtrl from '../controllers/qbo.controller';
import { requireAuth } from '../middleware/requireRole';

const router = Router();

// Session
router.post('/login', ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', ctrl.me);
router.post('/change-password', requireAuth, ctrl.changePassword);

// One-time invite links: use with QuickBooks (first step) or set a password
router.post('/invite', ctrl.acceptInvite);
router.post('/invite/password', ctrl.setPasswordFromInvite);

// Sign in with QuickBooks, or connect QuickBooks while signed in (?mode=connect)
router.get('/qbo/login', qboCtrl.login);
router.get('/qbo/callback', qboCtrl.callback);
router.get('/qbo/status', requireAuth, qboCtrl.status);

export default router;
