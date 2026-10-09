import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { placementService } from '../../../services/placement.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

const jobSchema = z.object({
    title: z.string().trim().min(2).max(180),
    description: z.string().max(10000).optional(),
    jobType: z.enum(['FULL_TIME', 'INTERNSHIP', 'CONTRACT']).optional(),
    location: z.string().trim().max(200).optional(),
    salary: z.string().trim().max(120).optional(),
    stipend: z.string().trim().max(120).optional(),
    minCgpa: z.number().min(0).max(10).optional(),
    maxBacklogs: z.number().int().min(0).optional(),
    eligibleDepts: z.array(z.string().trim().min(1).max(20)).optional(),
    eligibleBatches: z.array(z.string().trim().min(1).max(20)).optional(),
    skills: z.array(z.string().trim().min(1).max(80)).optional(),
    deadline: z.coerce.date().optional(),
    isActive: z.boolean().optional(),
});

router.get('/', requireRole('STUDENT', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PLACEMENT_COMPANY', 'PRINCIPAL'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const role = req.user!.role;
        const jobs = await placementService.getJobs(req.tenantId!, {
            deptId: typeof req.query.deptId === 'string' ? req.query.deptId : undefined,
            batchId: typeof req.query.batchId === 'string' ? req.query.batchId : undefined,
            type: typeof req.query.type === 'string' ? req.query.type : undefined,
            isActive: typeof req.query.isActive === 'string' ? req.query.isActive : undefined,
        }, {
            companyUserId: role === 'PLACEMENT_COMPANY' ? req.user!.userId : undefined,
            publicOnly: role === 'STUDENT',
        });
        res.json(jobs);
    } catch (error) { next(error); }
});

router.get('/:id', requireRole('STUDENT', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PLACEMENT_COMPANY', 'PRINCIPAL'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const role = req.user!.role;
        const job = await placementService.getJob(req.tenantId!, Number(req.params.id), {
            companyUserId: role === 'PLACEMENT_COMPANY' ? req.user!.userId : undefined,
            publicOnly: role === 'STUDENT',
        });
        if (!job) {
            res.status(404).json({ error: 'Job not found' });
            return;
        }
        res.json(job);
    } catch (error) { next(error); }
});

router.post('/', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PLACEMENT_COMPANY'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = jobSchema.parse(req.body);
        if (req.user!.role === 'PLACEMENT_COMPANY') {
            res.status(201).json(await placementService.createJob(req.tenantId!, data, { companyUserId: req.user!.userId }));
            return;
        }
        const companyId = z.number().int().positive().parse(req.body.companyId);
        res.status(201).json(await placementService.createJob(req.tenantId!, data, { companyId }));
    } catch (error) { next(error); }
});

router.patch('/:id', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PLACEMENT_COMPANY'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = jobSchema.partial().parse(req.body);
        const companyUserId = req.user!.role === 'PLACEMENT_COMPANY' ? req.user!.userId : undefined;
        res.json(await placementService.updateJob(req.tenantId!, Number(req.params.id), data, companyUserId));
    } catch (error) { next(error); }
});

router.post('/:id/approve', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await placementService.approveJob(req.tenantId!, Number(req.params.id)));
    } catch (error) { next(error); }
});

router.get('/:id/eligible-students', requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await placementService.getEligibleStudents(req.tenantId!, Number(req.params.id)));
    } catch (error) { next(error); }
});

export default router;
