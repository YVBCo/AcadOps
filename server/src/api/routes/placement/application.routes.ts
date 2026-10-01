import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { placementService } from '../../../services/placement.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const studentId = req.user!.role === 'STUDENT' ? req.user!.userId : undefined;
        const apps = await placementService.getApplications(req.tenantId!, studentId);
        res.json(apps);
    } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const app = await placementService.getApplication(req.tenantId!, parseInt(req.params.id));
        res.json(app);
    } catch (e) { next(e); }
});

router.post('/', requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const app = await placementService.apply(req.tenantId!, req.user!.userId, req.body.jobId, req.body.cvId);
        res.json(app);
    } catch (e) { next(e); }
});

router.patch('/:id/status', requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const app = await placementService.updateApplicationStatus(req.tenantId!, parseInt(req.params.id), req.body.status, req.body.remarks);
        res.json(app);
    } catch (e) { next(e); }
});

router.patch('/:id/withdraw', requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const app = await placementService.withdrawApplication(req.tenantId!, parseInt(req.params.id), req.user!.userId);
        res.json(app);
    } catch (e) { next(e); }
});

export default router;
