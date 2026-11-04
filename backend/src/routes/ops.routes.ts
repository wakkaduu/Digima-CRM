import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/ops.controller';

const router = Router();

router.get('/health', ctrl.health);
router.get('/health/live', ctrl.live);
// Public (a crash can happen before sign-in), so capped per client and kept small.
router.post('/client-errors', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }), ctrl.clientError);

export default router;
