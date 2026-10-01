import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import prisma from '../../../data-access/prisma.js';
import { z } from 'zod';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const templates = await prisma.nodueClearanceTemplate.findMany({
            where: { tenantId: req.tenantId! },
        });
        res.json(templates);
    } catch (error) {
        next(error);
    }
});

const createTemplateSchema = z.object({
    name: z.string(),
    headerHtml: z.string().optional(),
    bodyHtml: z.string().optional(),
    footerHtml: z.string().optional(),
    isDefault: z.boolean().optional(),
});

router.post('/', authenticate, requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createTemplateSchema.parse(req.body);
        const template = await prisma.nodueClearanceTemplate.create({
            data: {
                tenantId: req.tenantId!,
                ...data,
            },
        });
        res.json(template);
    } catch (error) {
        next(error);
    }
});

const updateTemplateSchema = createTemplateSchema.partial();

router.patch('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = updateTemplateSchema.parse(req.body);
        const template = await prisma.nodueClearanceTemplate.update({
            where: { id: Number(req.params.id), tenantId: req.tenantId! },
            data,
        });
        res.json(template);
    } catch (error) {
        next(error);
    }
});

router.delete('/:id', authenticate, requireRole('SUPER_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        await prisma.nodueClearanceTemplate.delete({
            where: { id: Number(req.params.id), tenantId: req.tenantId! },
        });
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
