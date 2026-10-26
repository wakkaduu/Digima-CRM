import { Router } from 'express';
import * as ctrl from '../controllers/user.controller';
import { requireRole } from '../middleware/requireRole';

const router = Router();

router.use(requireRole('superadmin'));
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.post('/:id/invite', ctrl.reinvite);

export default router;
