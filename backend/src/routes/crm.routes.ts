import { Router } from 'express';
import * as ctrl from '../controllers/crm.controller';
import { requireRole } from '../middleware/requireRole';
import { BROWSE_ROLES } from '../config/roles';

export const customerRoutes = Router();
customerRoutes.get('/', requireRole(...BROWSE_ROLES), ctrl.listCustomers);
customerRoutes.get('/:id', requireRole(...BROWSE_ROLES), ctrl.customerDetail);

export const estimateRoutes = Router();
estimateRoutes.get('/', requireRole(...BROWSE_ROLES), ctrl.listEstimates);
estimateRoutes.get('/:id', requireRole(...BROWSE_ROLES), ctrl.estimateDetail);
estimateRoutes.get('/:id/invoices', requireRole(...BROWSE_ROLES), ctrl.estimateInvoices);
