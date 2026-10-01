import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { placementService } from '../../../services/placement.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const jobs = await placementService.getJobs(req.tenantId!, req.query);
        res.json(jobs);
    } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const job = await placementService.getJob(req.tenantId!, parseInt(req.params.id));
        res.json(job);
    } catch (e) { next(e); }
});

router.post('/', requireRole('SUPER_ADMIN', 'PLACEMENT_COMPANY'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const companyId = req.body.companyId;
        const data = { ...req.body };
        delete data.companyId;
        const job = await placementService.createJob(req.tenantId!, companyId, data);
        res.json(job);
    } catch (e) { next(e); }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const job = await placementService.updateJob(req.tenantId!, parseInt(req.params.id), req.body);
        res.json(job);
    } catch (e) { next(e); }
});

router.post('/:id/approve', requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const job = await placementService.approveJob(req.tenantId!, parseInt(req.params.id));
        res.json(job);
    } catch (e) { next(e); }
});

router.get('/:id/eligible-students', requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const students = await placementService.getEligibleStudents(req.tenantId!, parseInt(req.params.id));
        res.json(students);
    } catch (e) { next(e); }
});

export default router;
