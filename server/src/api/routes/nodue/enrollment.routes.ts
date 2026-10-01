import { Router, Request, Response, NextFunction } from 'express';
import { nodueService } from '../../../services/nodue.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import prisma from '../../../data-access/prisma.js';
import { NodueDueStatus } from '@prisma/client';
import { z } from 'zod';

const router = Router();

router.get('/my-students', authenticate, requireRole('TEACHER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const enrollments = await nodueService.getEnrollmentsForFaculty(req.tenantId!, req.user!.userId);
        res.json(enrollments);
    } catch (error) {
        next(error);
    }
});

const rejectSchema = z.object({
    remarks: z.string().min(1),
});

router.patch('/:id/clear', authenticate, requireRole('TEACHER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await nodueService.clearSubject(req.tenantId!, Number(req.params.id), req.user!.userId, { status: NodueDueStatus.CLEARED });
        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/reject', authenticate, requireRole('TEACHER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = rejectSchema.parse(req.body);
        const result = await nodueService.clearSubject(req.tenantId!, Number(req.params.id), req.user!.userId, { status: NodueDueStatus.REJECTED, remarks: data.remarks });
        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.get('/student/:studentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const enrollments = await prisma.nodueSubjectEnrollment.findMany({
            where: { tenantId: req.tenantId!, studentId: Number(req.params.studentId) },
            include: { subject: { select: { id: true, name: true, code: true } } },
        });
        res.json(enrollments);
    } catch (error) {
        next(error);
    }
});

export default router;
