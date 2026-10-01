import { Router, Request, Response, NextFunction } from 'express';
import { nodueService } from '../../../services/nodue.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import prisma from '../../../data-access/prisma.js';

const router = Router();

router.get('/status', authenticate, requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const status = await nodueService.getClearanceRequest(req.tenantId!, req.user!.userId);
        res.json(status);
    } catch (error) {
        next(error);
    }
});

router.post('/apply', authenticate, requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await nodueService.applyClearance(req.tenantId!, req.user!.userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.get('/all', authenticate, requireRole('DEPARTMENT_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const requests = await prisma.nodueClearanceRequest.findMany({
            where: { tenantId: req.tenantId! },
            include: { student: { select: { id: true, name: true, email: true } } },
        });
        res.json(requests);
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/hod-approve', authenticate, requireRole('DEPARTMENT_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const request = await prisma.nodueClearanceRequest.findFirst({
            where: { id: Number(req.params.id), tenantId: req.tenantId! },
        });
        if (!request) return res.status(404).json({ error: 'Request not found' });
        
        const result = await nodueService.hodApprove(req.tenantId!, request.studentId, req.user!.userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/principal-approve', authenticate, requireRole('PRINCIPAL', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const request = await prisma.nodueClearanceRequest.findFirst({
            where: { id: Number(req.params.id), tenantId: req.tenantId! },
        });
        if (!request) return res.status(404).json({ error: 'Request not found' });

        const result = await nodueService.principalApprove(req.tenantId!, request.studentId, req.user!.userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.get('/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stats = await nodueService.getClearanceStats(req.tenantId!);
        res.json(stats);
    } catch (error) {
        next(error);
    }
});

export default router;
