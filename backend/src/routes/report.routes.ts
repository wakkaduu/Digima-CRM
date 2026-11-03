import { Router } from 'express';
import * as ctrl from '../controllers/report.controller';
import { requireRole } from '../middleware/requireRole';

const router = Router();

// SuperAdmin only: collections, accounts, sales reps and review turnaround over a date range
router.get('/', requireRole('superadmin'), ctrl.report);

export default router;
