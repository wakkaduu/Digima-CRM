import { Router } from 'express';
import * as ctrl from '../controllers/activity.controller';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// SuperAdmin only: who did what, newest first
router.get('/', requireRole('superadmin'), ctrl.list);

export default router;
