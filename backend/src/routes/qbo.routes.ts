import { Router } from 'express';
import * as ctrl from '../controllers/qbo.controller';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.get('/estimates', requireRole('sales', 'admin'), ctrl.listEstimates);

export default router;