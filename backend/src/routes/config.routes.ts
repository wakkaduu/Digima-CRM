import { Router } from 'express';
import * as ctrl from '../controllers/config.controller';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.get('/banks', requireRole('sales', 'admin'), ctrl.banks);

export default router;
