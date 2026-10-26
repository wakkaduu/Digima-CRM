import { Router } from 'express';
import * as ctrl from '../controllers/config.controller';
import { requireRole } from '../middleware/requireRole';
import { BROWSE_ROLES } from '../config/roles';

const router = Router();

router.get('/banks', requireRole(...BROWSE_ROLES), ctrl.banks);

export default router;
