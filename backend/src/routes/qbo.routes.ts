import { Router } from 'express';
import * as ctrl from '../controllers/qbo.controller';
import { requireRole } from '../middleware/requireRole';
import { BROWSE_ROLES } from '../config/roles';

const router = Router();

router.get('/estimates', requireRole(...BROWSE_ROLES), ctrl.listEstimates);

export default router;