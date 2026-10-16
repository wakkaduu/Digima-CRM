import { Router } from 'express';
import * as ctrl from '../controllers/payment.controller';
import * as admin from '../controllers/admin.controller';
import { requireRole } from '../middleware/requireRole';
import { uploadProof, verifyImageSignature } from '../middleware/upload';

const router = Router();

// Sales only: admins approve payments, they do not submit them
router.post('/submit', requireRole('sales'), uploadProof, verifyImageSignature, ctrl.submit);
// Receivers are also the "sales rep" filter options on the admin history list
router.get('/receivers', requireRole('sales', 'admin'), ctrl.listReceivers);
router.get('/mine', requireRole('sales'), ctrl.listMine);
router.post('/mine/seen', requireRole('sales'), ctrl.markSeen);
router.get('/recent-estimates', requireRole('sales'), ctrl.recentEstimates);
// Navigation badge numbers: pending for admins, unread outcomes for sales
router.get('/counts', requireRole('sales', 'admin'), ctrl.counts);
// History: sales see their own rows, admins everyone's (scoped in the controller)
router.get('/', requireRole('sales', 'admin'), ctrl.list);
// Receipts: sales see their own, admins see any (needed to review a payment)
router.get('/:id/receipt', requireRole('sales', 'admin'), ctrl.receipt);

// Admin
router.get('/pending', requireRole('admin'), admin.listPending);
router.post('/approve/:id', requireRole('admin'), admin.approve);
router.post('/reject/:id', requireRole('admin'), admin.reject);
router.post('/reject/:id/undo', requireRole('admin'), admin.undoReject);
router.get('/qbo-accounts', requireRole('admin'), admin.listQboAccounts);

// Keep last: a bare /:id would otherwise swallow the fixed paths above
router.get('/:id', requireRole('sales', 'admin'), ctrl.detail);

export default router;