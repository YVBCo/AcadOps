/**
 * Clerk Routes
 * ──────────────────────────────────────
 * COE clerk account management endpoints.
 * All logic delegated to ClerkService.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { authenticate } from '../middleware/index.js';
import { clerkService } from '../../services/clerk.service.js';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

const coeOnly = (req: Request, res: Response, next: Function) => {
    if (req.user?.role !== 'COE') {
        res.status(403).json({ error: 'Access denied. COE only.' });
        return;
    }
    next();
};

const createClerkSchema = z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
});

// GET /api/clerks
router.get('/', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const clerks = await clerkService.list(req.user!.tenantId);
        res.json(clerks);
    } catch (error) {
        next(error);
    }
});

// POST /api/clerks
router.post('/', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createClerkSchema.parse(req.body);
        const clerk = await clerkService.create(data, req.user!.tenantId, req.user!.userId);
        res.status(201).json(clerk);
    } catch (error: unknown) {
        if (error instanceof ZodError) return next(error);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            res.status(400).json({ error: 'Email already registered in this institution' });
            return;
        }
        next(error);
    }
});

// PUT /api/clerks/:id/toggle
router.put('/:id/toggle', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const clerkId = parseIntParam(req.params.id, 'id');
        const result = await clerkService.toggleActive(clerkId, req.user!.tenantId, req.user!.userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/clerks/:id
router.delete('/:id', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const clerkId = parseIntParam(req.params.id, 'id');
        await clerkService.softDelete(clerkId, req.user!.tenantId, req.user!.userId);
        res.json({ message: 'Clerk deleted successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
