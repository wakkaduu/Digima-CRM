import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller';
import * as qboCtrl from '../controllers/qbo.controller';
import { requireAuth } from '../middleware/requireRole';

const router = Router();

// Session
router.post('/logout', ctrl.logout);
router.get('/me', ctrl.me);

// One-time invite links (the first step of signing in for a new person)
router.post('/invite', ctrl.acceptInvite);

// Sign in with QuickBooks (the only way in)
router.get('/qbo/login', qboCtrl.login);
router.get('/qbo/callback', qboCtrl.callback);
router.get('/qbo/status', requireAuth, qboCtrl.status);

export default router;
