const router = require('express').Router();
const ctrl = require('../controllers/qbo.controller');
const requireRole = require('../middleware/requireRole');

router.get('/estimates', requireRole('sales', 'admin'), ctrl.listEstimates);

module.exports = router;