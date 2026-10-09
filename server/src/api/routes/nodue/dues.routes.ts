import { Router, Request, Response, NextFunction } from 'express';
import { nodueService } from '../../../services/nodue.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import prisma from '../../../data-access/prisma.js';
import { NodueDueStatus } from '@prisma/client';
import { z } from 'zod';

const router = Router();

router.get('/student', authenticate, requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dues = await nodueService.getStudentDues(req.tenantId!, req.user!.userId);
        res.json(dues);
    } catch (error) {
        next(error);
    }
});

router.get('/all', authenticate, requireRole('ACCOUNTS_STAFF', 'CLERK', 'LIBRARIAN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dues = await prisma.nodueStudentDue.findMany({
            where: { tenantId: req.tenantId! },
            include: { student: { include: { studentProfile: { select: { rollNumber: true } } } } },
        });
        res.json(dues);
    } catch (error) {
        next(error);
    }
});

const createDueSchema = z.object({
    studentId: z.number().int().positive(),
    dueType: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).optional(),
    fineAmount: z.number().nonnegative(),
});

router.post('/', authenticate, requireRole('ACCOUNTS_STAFF', 'CLERK'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createDueSchema.parse(req.body);
        const student = await prisma.user.findFirst({ where: { id: data.studentId, tenantId: req.tenantId!, role: 'STUDENT' }, select: { id: true } });
        if (!student) {
            res.status(404).json({ error: 'Student not found in this institution' });
            return;
        }
        const due = await prisma.nodueStudentDue.create({
            data: {
                tenantId: req.tenantId!,
                ...data,
                hasDues: true,
            },
        });
        await nodueService.evaluateClearanceStage(req.tenantId!, data.studentId);
        res.json(due);
    } catch (error) {
        next(error);
    }
});

const updateDueSchema = z.object({
    status: z.nativeEnum(NodueDueStatus).optional(),
    paidAmount: z.number().nonnegative().optional(),
    remarks: z.string().optional(),
});

router.patch('/:id', authenticate, requireRole('ACCOUNTS_STAFF', 'CLERK'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = updateDueSchema.parse(req.body);
        const result = await nodueService.updateStudentDue(req.tenantId!, Number(req.params.id), data);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.get('/library', authenticate, requireRole('LIBRARIAN', 'SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const dues = await nodueService.getLibraryDues(req.tenantId!);
        res.json(dues);
    } catch (error) {
        next(error);
    }
});

const createLibraryDueSchema = z.object({
    studentId: z.number().int().positive(),
    fineAmount: z.number().nonnegative(),
    remarks: z.string().trim().max(500).optional(),
});

router.post('/library', authenticate, requireRole('LIBRARIAN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createLibraryDueSchema.parse(req.body);
        const student = await prisma.user.findFirst({ where: { id: data.studentId, tenantId: req.tenantId!, role: 'STUDENT' }, select: { id: true } });
        if (!student) {
            res.status(404).json({ error: 'Student not found in this institution' });
            return;
        }
        const due = await prisma.nodueLibraryDue.upsert({
            where: { tenantId_studentId: { tenantId: req.tenantId!, studentId: data.studentId } },
            update: { fineAmount: data.fineAmount, remarks: data.remarks, hasDues: true, status: NodueDueStatus.PENDING },
            create: { tenantId: req.tenantId!, ...data, hasDues: true },
        });
        await nodueService.evaluateClearanceStage(req.tenantId!, data.studentId);
        res.json(due);
    } catch (error) {
        next(error);
    }
});

router.patch('/library/:id', authenticate, requireRole('LIBRARIAN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = updateDueSchema.parse(req.body);
        const result = await nodueService.updateLibraryDue(req.tenantId!, Number(req.params.id), data);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
