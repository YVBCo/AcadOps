import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { placementService } from '../../../services/placement.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { PlacementApplicationStatus, PlacementDriveStatus } from '@prisma/client';

const router = Router();
router.use(authenticate);

const driveSchema = z.object({
    companyId: z.number().int().positive(),
    jobId: z.number().int().positive().optional(),
    title: z.string().trim().min(2).max(180),
    description: z.string().max(10000).optional(),
    driveDate: z.coerce.date().optional(),
    venue: z.string().trim().max(255).optional(),
    status: z.nativeEnum(PlacementDriveStatus).optional(),
});

router.get('/', requireRole('STUDENT', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PLACEMENT_COMPANY', 'PRINCIPAL'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const status = req.user!.role === 'STUDENT'
            ? PlacementDriveStatus.ACTIVE
            : typeof req.query.status === 'string' ? req.query.status as PlacementDriveStatus : undefined;
        const companyUserId = req.user!.role === 'PLACEMENT_COMPANY' ? req.user!.userId : undefined;
        res.json(await placementService.getDrives(req.tenantId!, status, companyUserId));
    } catch (error) { next(error); }
});

router.get('/:id', requireRole('STUDENT', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PLACEMENT_COMPANY', 'PRINCIPAL'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const drive = await placementService.getDrive(req.tenantId!, Number(req.params.id));
        if (drive && req.user!.role === 'STUDENT' && drive.status !== PlacementDriveStatus.ACTIVE) {
            res.status(404).json({ error: 'Drive not found' });
            return;
        }
        if (drive && req.user!.role === 'PLACEMENT_COMPANY' && drive.company.userId !== req.user!.userId) {
            res.status(404).json({ error: 'Drive not found' });
            return;
        }
        if (!drive) {
            res.status(404).json({ error: 'Drive not found' });
            return;
        }
        res.json(drive);
    } catch (error) { next(error); }
});

router.post('/', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = driveSchema.parse(req.body);
        res.status(201).json(await placementService.createDrive(req.tenantId!, req.user!.userId, data));
    } catch (error) { next(error); }
});

router.patch('/:id', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = driveSchema.partial().parse(req.body);
        res.json(await placementService.updateDrive(req.tenantId!, Number(req.params.id), data));
    } catch (error) { next(error); }
});

router.post('/:id/rounds', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = z.object({
            roundNo: z.number().int().positive(),
            roundType: z.enum(['APTITUDE', 'GROUP_DISCUSSION', 'TECHNICAL', 'HR', 'CODING', 'OTHER']),
            name: z.string().trim().max(160).optional(),
            venue: z.string().trim().max(255).optional(),
            startTime: z.coerce.date().optional(),
            endTime: z.coerce.date().optional(),
            notes: z.string().max(5000).optional(),
        }).parse(req.body);
        res.status(201).json(await placementService.addRound(req.tenantId!, Number(req.params.id), data));
    } catch (error) { next(error); }
});

router.patch('/rounds/:roundId/results', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { results } = z.object({
            results: z.array(z.object({
                applicationId: z.number().int().positive(),
                status: z.nativeEnum(PlacementApplicationStatus),
                remarks: z.string().max(2000).optional(),
            })).min(1),
        }).parse(req.body);
        res.json(await placementService.updateRoundResults(req.tenantId!, Number(req.params.roundId), results));
    } catch (error) { next(error); }
});

export default router;
