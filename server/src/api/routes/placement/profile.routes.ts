import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { placementService } from '../../../services/placement.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/', requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const profile = await placementService.getProfile(req.tenantId!, req.user!.userId);
        res.json(profile);
    } catch (e) { next(e); }
});

router.patch('/', requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const profile = await placementService.updateProfile(req.tenantId!, req.user!.userId, req.body);
        res.json(profile);
    } catch (e) { next(e); }
});

router.post('/cv', requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const profile = await placementService.getProfile(req.tenantId!, req.user!.userId);
        const cv = await placementService.uploadCv(req.tenantId!, profile.id, req.body);
        res.json(cv);
    } catch (e) { next(e); }
});

router.post('/declaration', requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const profile = await placementService.getProfile(req.tenantId!, req.user!.userId);
        const dec = await placementService.submitDeclaration(req.tenantId!, profile.id, req.body);
        res.json(dec);
    } catch (e) { next(e); }
});

router.get('/:userId', requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const profile = await placementService.getProfile(req.tenantId!, parseInt(req.params.userId));
        res.json(profile);
    } catch (e) { next(e); }
});

export default router;
