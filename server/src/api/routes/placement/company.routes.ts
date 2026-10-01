import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { placementService } from '../../../services/placement.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const companies = await placementService.getCompanies(req.tenantId!);
        res.json(companies);
    } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const company = await placementService.getCompany(req.tenantId!, parseInt(req.params.id as string));
        res.json(company);
    } catch (e) { next(e); }
});

router.post('/', requireRole('SUPER_ADMIN', 'PLACEMENT_COMPANY'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const company = await placementService.createCompany(req.tenantId!, req.body);
        res.json(company);
    } catch (e) { next(e); }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const company = await placementService.updateCompany(req.tenantId!, parseInt(req.params.id as string), req.body);
        res.json(company);
    } catch (e) { next(e); }
});

router.post('/:id/verify', requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const company = await placementService.verifyCompany(req.tenantId!, parseInt(req.params.id as string));
        res.json(company);
    } catch (e) { next(e); }
});

export default router;
