import { Router, Request, Response, NextFunction } from 'express';
import { nodueService } from '../../../services/nodue.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import prisma from '../../../data-access/prisma.js';
import { NodueClearanceStage } from '@prisma/client';
import { z } from 'zod';

const router = Router();

router.get('/status', authenticate, requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [status, enrollments] = await Promise.all([
            nodueService.getClearanceRequest(req.tenantId!, req.user!.userId),
            prisma.nodueSubjectEnrollment.findMany({
                where: { tenantId: req.tenantId!, studentId: req.user!.userId },
                include: { subject: { select: { id: true, course: { select: { name: true, code: true } } } } },
            }),
        ]);
        res.json({ ...status, enrollments: enrollments.map(enrollment => ({ ...enrollment, clearanceStatus: enrollment.status })) });
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
        const currentStage = typeof req.query.currentStage === 'string'
            ? z.nativeEnum(NodueClearanceStage).parse(req.query.currentStage)
            : undefined;
        if (req.user!.role === 'DEPARTMENT_ADMIN' && !req.user!.departmentId) {
            res.status(403).json({ error: 'Department assignment is required' });
            return;
        }
        const requests = await prisma.nodueClearanceRequest.findMany({
            where: {
                tenantId: req.tenantId!,
                ...(currentStage ? { currentStage } : {}),
                ...(req.user!.role === 'DEPARTMENT_ADMIN' ? { student: { departmentId: req.user!.departmentId } } : {}),
            },
            include: { student: { include: { studentProfile: { include: { batch: true } } } } },
        });
        res.json(requests.map(request => ({
            ...request,
            student: {
                ...request.student,
                user: { ...request.student, rollNumber: request.student.studentProfile?.rollNumber },
                batch: request.student.studentProfile?.batch,
            },
        })));
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/hod-approve', authenticate, requireRole('DEPARTMENT_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const request = await prisma.nodueClearanceRequest.findFirst({
            where: {
                id: Number(req.params.id),
                tenantId: req.tenantId!,
                student: { departmentId: req.user!.departmentId },
            },
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

router.get('/stats', authenticate, requireRole('DEPARTMENT_ADMIN', 'SUPER_ADMIN', 'PRINCIPAL'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stats = await nodueService.getClearanceStats(req.tenantId!);
        res.json(stats);
    } catch (error) {
        next(error);
    }
});

export default router;
