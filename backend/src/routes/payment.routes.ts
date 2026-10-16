import { Router } from 'express';
import * as ctrl from '../controllers/payment.controller';
import * as admin from '../controllers/admin.controller';
import { requireRole } from '../middleware/requireRole';
import { uploadProof, verifyImageSignature } from '../middleware/upload';

const router = Router();

// Sales only: admins approve payments, they do not submit them
router.post('/submit', requireRole('sales'), uploadProof, verifyImageSignature, ctrl.submit);
router.get('/receivers', requireRole('sales'), ctrl.listReceivers);
router.get('/mine', requireRole('sales'), ctrl.listMine);
router.post('/mine/seen', requireRole('sales'), ctrl.markSeen);
// Receipts: sales see their own, admins see any (needed to review a payment)
router.get('/:id/receipt', requireRole('sales', 'admin'), ctrl.receipt);

// Admin
router.get('/pending', requireRole('admin'), admin.listPending);
router.post('/approve/:id', requireRole('admin'), admin.approve);
router.post('/reject/:id', requireRole('admin'), admin.reject);
router.get('/qbo-accounts', requireRole('admin'), admin.listQboAccounts);

export default router;