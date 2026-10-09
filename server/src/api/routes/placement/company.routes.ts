import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { placementService } from '../../../services/placement.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

const companyProfileSchema = z.object({
    name: z.string().trim().min(2).max(160),
    email: z.string().email().max(254).optional(),
    phone: z.string().trim().max(40).optional(),
    website: z.string().url().max(255).optional().or(z.literal('')),
    industry: z.string().trim().max(100).optional(),
    description: z.string().trim().max(5000).optional(),
    logoUrl: z.string().url().max(1000).optional().or(z.literal('')),
    address: z.string().trim().max(500).optional(),
});

router.get('/me', requireRole('PLACEMENT_COMPANY'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await placementService.getMyCompany(req.tenantId!, req.user!.userId));
    } catch (error) { next(error); }
});

router.patch('/me', requireRole('PLACEMENT_COMPANY'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = companyProfileSchema.partial().omit({ email: true }).parse(req.body);
        const company = await placementService.getMyCompany(req.tenantId!, req.user!.userId);
        if (!company) {
            res.status(404).json({ error: 'Company profile not found' });
            return;
        }
        res.json(await placementService.updateCompany(req.tenantId!, company.id, data, req.user!.userId));
    } catch (error) { next(error); }
});

router.get('/', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await placementService.getCompanies(req.tenantId!));
    } catch (error) { next(error); }
});

router.get('/:id', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const company = await placementService.getCompany(req.tenantId!, Number(req.params.id));
        if (!company) {
            res.status(404).json({ error: 'Company not found' });
            return;
        }
        res.json(company);
    } catch (error) { next(error); }
});

router.post('/', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PLACEMENT_COMPANY'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = companyProfileSchema.parse(req.body);
        if (req.user!.role === 'PLACEMENT_COMPANY') {
            const { email: _ignoredEmail, ...profile } = data;
            const company = await placementService.createCompany(req.tenantId!, {
                ...profile,
                email: req.user!.email,
            }, req.user!.userId);
            res.status(201).json(company);
            return;
        }
        if (!data.email) {
            res.status(400).json({ error: 'Company email is required' });
            return;
        }
        res.status(201).json(await placementService.createCompany(req.tenantId!, { ...data, email: data.email }));
    } catch (error) { next(error); }
});

router.patch('/:id', requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = companyProfileSchema.partial().parse(req.body);
        const company = await placementService.updateCompany(req.tenantId!, Number(req.params.id), data);
        res.json(company);
    } catch (error) { next(error); }
});

router.post('/:id/verify', requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await placementService.verifyCompany(req.tenantId!, Number(req.params.id)));
    } catch (error) { next(error); }
});

export default router;
