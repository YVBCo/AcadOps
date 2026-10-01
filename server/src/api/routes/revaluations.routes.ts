/**
 * Revaluations Routes
 * ──────────────────────────────────────
 * COE revaluation management endpoints.
 * All logic delegated to RevaluationsService.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/index.js';
import { revaluationsService } from '../../services/revaluations.service.js';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

// Middleware: Only COE can access revaluations management
function coeOnly(req: Request, res: Response, next: NextFunction) {
    const role = req.user?.role;
    if (role !== 'COE') {
        res.status(403).json({ error: 'Access denied. Only COE can manage revaluations.' });
        return;
    }
    next();
}

// GET /api/revaluations
router.get('/', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const revaluations = await revaluationsService.list(req.query.status as string | undefined);
        res.json(revaluations);
    } catch (error) {
        next(error);
    }
});

// PUT /api/revaluations/:id/approve
router.put('/:id/approve', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const updated = await revaluationsService.approve(id, req.user!.userId);
        res.json({ message: 'Revaluation approved', revaluation: updated });
    } catch (error) {
        next(error);
    }
});

// PUT /api/revaluations/:id/reject
router.put('/:id/reject', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const updated = await revaluationsService.reject(id, req.user!.userId);
        res.json({ message: 'Revaluation rejected', revaluation: updated });
    } catch (error) {
        next(error);
    }
});

export default router;
