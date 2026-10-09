import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PlacementApplicationStatus } from '@prisma/client';
import { placementService } from '../../../services/placement.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/', requireRole('STUDENT', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PLACEMENT_COMPANY'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const role = req.user!.role;
        res.json(await placementService.getApplications(req.tenantId!, {
            studentId: role === 'STUDENT' ? req.user!.userId : undefined,
            companyUserId: role === 'PLACEMENT_COMPANY' ? req.user!.userId : undefined,
        }));
    } catch (error) { next(error); }
});

router.get('/:id', requireRole('STUDENT', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PLACEMENT_COMPANY'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const role = req.user!.role;
        const application = await placementService.getApplication(req.tenantId!, Number(req.params.id), {
            studentId: role === 'STUDENT' ? req.user!.userId : undefined,
            companyUserId: role === 'PLACEMENT_COMPANY' ? req.user!.userId : undefined,
        });
        if (!application) {
            res.status(404).json({ error: 'Application not found' });
            return;
        }
        res.json(application);
    } catch (error) { next(error); }
});

router.post('/', requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { jobId, cvId } = z.object({
            jobId: z.number().int().positive(),
            cvId: z.number().int().positive().optional(),
        }).parse(req.body);
        res.status(201).json(await placementService.apply(req.tenantId!, req.user!.userId, jobId, cvId));
    } catch (error) { next(error); }
});

router.patch('/:id/status', requireRole('SUPER_ADMIN', 'PLACEMENT_COMPANY'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status, remarks } = z.object({
            status: z.nativeEnum(PlacementApplicationStatus),
            remarks: z.string().max(2000).optional(),
        }).parse(req.body);
        const companyUserId = req.user!.role === 'PLACEMENT_COMPANY' ? req.user!.userId : undefined;
        res.json(await placementService.updateApplicationStatus(req.tenantId!, Number(req.params.id), status, remarks, companyUserId));
    } catch (error) { next(error); }
});

router.patch('/:id/withdraw', requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await placementService.withdrawApplication(req.tenantId!, Number(req.params.id), req.user!.userId));
    } catch (error) { next(error); }
});

export default router;
