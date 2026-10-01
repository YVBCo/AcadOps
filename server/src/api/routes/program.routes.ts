import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { programService } from '../../services/program.service.js';
import { authenticate, requireRole, cacheResponse, invalidateCache, CacheDurations } from '../middleware/index.js';
import { UserRole } from '@prisma/client';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

// ─── Zod Schemas ──────────────────────────────────────────────
const createProgramSchema = z.object({
    name: z.string().min(1).max(200),
    code: z.string().min(1).max(20),
    departmentIds: z.array(z.coerce.number().int().positive()).min(1),
    durationYears: z.coerce.number().int().min(1).max(8).default(4),
});

const updateProgramSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    code: z.string().min(1).max(20).optional(),
    departmentIds: z.array(z.coerce.number().int().positive()).optional(),
    durationYears: z.coerce.number().int().min(1).max(8).optional(),
});

// All routes require authentication
router.use(authenticate);

// GET /api/programs - Get all programs
router.get('/', cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        let departmentId: number | undefined;

        if (user.role === 'DEPARTMENT_ADMIN') {
            departmentId = user.departmentId || undefined;
        } else if (user.role !== 'SUPER_ADMIN') {
            departmentId = user.departmentId || undefined;
        } else {
            departmentId = req.query.departmentId ? parseIntParam(req.query.departmentId as string, 'departmentId') : undefined;
        }

        const programs = await programService.getAll(departmentId, req.user!.tenantId);
        res.json(programs);
    } catch (error) {
        next(error);
    }
});

// GET /api/programs/:id - Get program by ID
router.get('/:id', cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const program = await programService.getById(id) as { departments?: { id: number }[] };

        const user = req.user!;
        const hasDeptAccess = program.departments?.some((d) => d.id === user.departmentId);
        if (user.role !== 'SUPER_ADMIN' && !hasDeptAccess) {
            return res.status(403).json({ error: 'Access denied to this program' });
        }

        res.json(program);
    } catch (error) {
        next(error);
    }
});

// POST /api/programs - Create program (Super Admin only)
router.post(
    '/',
    requireRole('SUPER_ADMIN'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user!;
            const data = createProgramSchema.parse(req.body);

            const program = await programService.create(
                {
                    name: data.name,
                    code: data.code,
                    departmentIds: data.departmentIds,
                    durationYears: data.durationYears,
                    tenantId: user.tenantId
                },
                user.userId
            );
            await invalidateCache(`api:${user.tenantId}:/api/programs*`);
            res.status(201).json(program);
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({ error: 'Validation failed', details: error.issues });
            }
            next(error);
        }
    }
);

// PUT /api/programs/:id - Update program (Super Admin only)
router.put(
    '/:id',
    requireRole('SUPER_ADMIN'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = req.user!;
            const id = parseIntParam(req.params.id, 'id');
            const data = updateProgramSchema.parse(req.body);

            const program = await programService.update(
                id,
                {
                    name: data.name,
                    code: data.code,
                    departmentIds: data.departmentIds,
                    durationYears: data.durationYears,
                },
                user.userId
            );
            await invalidateCache(`api:${user.tenantId}:/api/programs*`);
            res.json(program);
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({ error: 'Validation failed', details: error.issues });
            }
            next(error);
        }
    }
);

// DELETE /api/programs/:id - Delete program (Super Admin only)
router.delete(
    '/:id',
    requireRole('SUPER_ADMIN'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = parseIntParam(req.params.id, 'id');
            await programService.delete(id, req.user!.userId);
            await invalidateCache(`api:${req.user!.tenantId}:/api/programs*`);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
);

export default router;
