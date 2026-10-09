import { Router, Request, Response, NextFunction } from 'express';
import { placementService } from '../../../services/placement.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

router.get('/stats', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PRINCIPAL'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stats = await placementService.getPlacementStats(req.tenantId!);
        res.json(stats);
    } catch (e) { next(e); }
});

router.get('/dept-wise', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'PRINCIPAL'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stats = await placementService.getDeptWiseStats(req.tenantId!);
        res.json(stats);
    } catch (e) { next(e); }
});

export default router;
