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

const createCategorySchema = z.object({
    departmentId: z.number().optional(),
    categoryName: z.string(),
    minPct: z.number(),
    maxPct: z.number(),
    fineAmount: z.number(),
    isFirstYear: z.boolean().optional(),
});

router.post('/categories', authenticate, requireRole('SUPER_ADMIN', 'FIRST_YEAR_COORDINATOR'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createCategorySchema.parse(req.body);
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
