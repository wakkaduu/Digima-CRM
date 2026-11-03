import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller';
import * as qboCtrl from '../controllers/qbo.controller';
import { requireAuth } from '../middleware/requireRole';

const router = Router();

// Session. The only way in is Sign in with QuickBooks (below); there is no email/password login.
router.post('/logout', ctrl.logout);
router.get('/me', ctrl.me);
router.post('/change-password', requireAuth, ctrl.changePassword);

// One-time invite links: opening one remembers it for this browser, and the next QuickBooks sign-in claims it
router.post('/invite', ctrl.acceptInvite);

// Sign in with QuickBooks, or connect QuickBooks while signed in (?mode=connect)
router.get('/qbo/login', qboCtrl.login);
router.get('/qbo/callback', qboCtrl.callback);
router.get('/qbo/status', requireAuth, qboCtrl.status);
router.post('/qbo/disconnect', requireAuth, qboCtrl.disconnect);

export default router;
