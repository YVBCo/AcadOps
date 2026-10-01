import { Router } from 'express';
import clearanceRoutes from './clearance.routes.js';
import enrollmentRoutes from './enrollment.routes.js';
import duesRoutes from './dues.routes.js';
import finesRoutes from './fines.routes.js';
import paymentRoutes from './payment.routes.js';
import templateRoutes from './templates.routes.js';

const router = Router();

router.use('/clearance', clearanceRoutes);
router.use('/enrollment', enrollmentRoutes);
router.use('/dues', duesRoutes);
router.use('/fines', finesRoutes);
router.use('/payment', paymentRoutes);
router.use('/templates', templateRoutes);

export default router;
