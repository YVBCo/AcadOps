import { Router } from 'express';
import companyRoutes from './company.routes.js';
import jobRoutes from './job.routes.js';
import driveRoutes from './drive.routes.js';
import applicationRoutes from './application.routes.js';
import profileRoutes from './profile.routes.js';
import analyticsRoutes from './analytics.routes.js';

const router = Router();

router.use('/companies', companyRoutes);
router.use('/jobs', jobRoutes);
router.use('/drives', driveRoutes);
router.use('/applications', applicationRoutes);
router.use('/profile', profileRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
