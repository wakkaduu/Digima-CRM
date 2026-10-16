const router = require('express').Router();
const ctrl = require('../controllers/payment.controller');
const admin = require('../controllers/admin.controller');
const requireRole = require('../middleware/requireRole');
const { uploadProof, verifyImageSignature } = require('../middleware/upload');

// Sales (admins can use these too)
router.post('/submit', requireRole('sales'), uploadProof, verifyImageSignature, ctrl.submit);
router.get('/mine', requireRole('sales'), ctrl.listMine);
router.post('/mine/seen', requireRole('sales'), ctrl.markSeen);
router.get('/:id/receipt', requireRole('sales'), ctrl.receipt);

// Admin
router.get('/pending', requireRole('admin'), admin.listPending);
router.post('/approve/:id', requireRole('admin'), admin.approve);
router.post('/reject/:id', requireRole('admin'), admin.reject);
router.get('/qbo-accounts', requireRole('admin'), admin.listQboAccounts);

module.exports = router;