import { Router } from 'express';
import * as ctrl from '../controllers/crm.controller';
import { requireRole } from '../middleware/requireRole';

export const customerRoutes = Router();
customerRoutes.get('/', requireRole('sales', 'admin'), ctrl.listCustomers);
customerRoutes.get('/:id', requireRole('sales', 'admin'), ctrl.customerDetail);

export const estimateRoutes = Router();
estimateRoutes.get('/', requireRole('sales', 'admin'), ctrl.listEstimates);
estimateRoutes.get('/:id', requireRole('sales', 'admin'), ctrl.estimateDetail);
