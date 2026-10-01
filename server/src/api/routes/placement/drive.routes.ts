import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { placementService } from '../../../services/placement.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { PlacementDriveStatus } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const drives = await placementService.getDrives(req.tenantId!, req.query.status as PlacementDriveStatus);
        res.json(drives);
    } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const drive = await placementService.getDrive(req.tenantId!, parseInt(req.params.id));
        res.json(drive);
    } catch (e) { next(e); }
});

router.post('/', requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const drive = await placementService.createDrive(req.tenantId!, req.body);
        res.json(drive);
    } catch (e) { next(e); }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const drive = await placementService.updateDrive(req.tenantId!, parseInt(req.params.id), req.body);
        res.json(drive);
    } catch (e) { next(e); }
});

router.post('/:id/rounds', requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const round = await placementService.addRound(req.tenantId!, parseInt(req.params.id), req.body);
        res.json(round);
    } catch (e) { next(e); }
});

router.patch('/rounds/:roundId/results', requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await placementService.updateRoundResults(req.tenantId!, parseInt(req.params.roundId), req.body.results);
        res.json(result);
    } catch (e) { next(e); }
});

export default router;
