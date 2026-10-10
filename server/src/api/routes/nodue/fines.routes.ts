import { Router, Request, Response, NextFunction } from 'express';
import { nodueService } from '../../../services/nodue.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import prisma from '../../../data-access/prisma.js';
import { z } from 'zod';

const router = Router();

router.get('/categories', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const categories = await nodueService.getAttendanceCategories(req.tenantId!);
        res.json(categories);
    } catch (error) {
        next(error);
    }
});

router.get('/subjects', authenticate, requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subjects = await prisma.subject.findMany({
            where: { semester: { tenantId: req.tenantId! } },
            include: { course: { include: { department: { select: { id: true, name: true, code: true } } } }, semester: { select: { name: true, status: true } } },
            orderBy: [{ semester: { startDate: 'desc' } }, { course: { name: 'asc' } }, { section: 'asc' }],
        });
        res.json(subjects);
    } catch (error) { next(error); }
});

router.patch('/subjects/:id/minimum', authenticate, requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { minimumAttendancePct } = z.object({ minimumAttendancePct: z.number().min(0).max(100) }).parse(req.body);
        const subjectId = Number(req.params.id);
        if (!Number.isInteger(subjectId) || subjectId <= 0) {
            res.status(400).json({ error: 'Invalid subject ID' });
            return;
        }
        const subject = await prisma.subject.findFirst({ where: { id: subjectId, semester: { tenantId: req.tenantId! } } });
        if (!subject) {
            res.status(404).json({ error: 'Subject not found in this institution' });
            return;
        }
        const updated = await prisma.subject.update({ where: { id: subjectId }, data: { noDueMinimumAttendancePct: minimumAttendancePct } });
        res.json(updated);
    } catch (error) { next(error); }
});

const createCategorySchema = z.object({
    departmentId: z.number().optional(),
    categoryName: z.string().trim().min(1).max(80),
    minPct: z.number().min(0).max(100),
    maxPct: z.number().min(0).max(100),
    fineAmount: z.number().nonnegative(),
    isFirstYear: z.boolean().optional(),
}).refine(data => data.maxPct >= data.minPct, { message: 'Maximum attendance must be at least the minimum attendance', path: ['maxPct'] });

router.post('/categories', authenticate, requireRole('SUPER_ADMIN', 'FIRST_YEAR_COORDINATOR'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createCategorySchema.parse(req.body);
        if (data.departmentId) {
            const department = await prisma.department.findFirst({ where: { id: data.departmentId, tenantId: req.tenantId! }, select: { id: true } });
            if (!department) {
                res.status(404).json({ error: 'Department not found in this institution' });
                return;
            }
        }
        const overlappingBand = await prisma.nodueAttendanceCategory.findFirst({
            where: {
                tenantId: req.tenantId!,
                departmentId: data.departmentId ?? null,
                isFirstYear: data.isFirstYear ?? false,
                minPct: { lt: data.maxPct },
                maxPct: { gt: data.minPct },
            },
            select: { id: true },
        });
        if (overlappingBand) {
            res.status(409).json({ error: 'This attendance range overlaps another fine band for the same scope and year group' });
            return;
        }
        const result = await nodueService.createAttendanceCategory(req.tenantId!, data);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

router.delete('/categories/:id', authenticate, requireRole('SUPER_ADMIN', 'FIRST_YEAR_COORDINATOR'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.nodueAttendanceCategory.delete({
            where: { id: Number(req.params.id), tenantId: req.tenantId! },
        });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

router.post('/calculate', authenticate, requireRole('SUPER_ADMIN', 'FIRST_YEAR_COORDINATOR'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { semesterId } = req.body;
        const result = await nodueService.calculateMassFines(req.tenantId!, semesterId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
