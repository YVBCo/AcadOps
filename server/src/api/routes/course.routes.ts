import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { courseService } from '../../services/index.js';
import { authenticate, adminOnly, superAdminOnly, coeOnly, requireRole, cacheResponse, invalidateCache, CacheDurations } from '../middleware/index.js';
import { parseIntParam, parseOptionalInt } from '../../utils/param-utils.js';

const router = Router();

// Middleware: COE or Department Admin can manage courses
const courseManager = requireRole('COE', 'DEPARTMENT_ADMIN');

// Validation schemas
const createCourseSchema = z.object({
    name: z.string().min(2),
    code: z.string().min(2).max(10).toUpperCase(),
    credits: z.number().min(1).max(10),
    departmentId: z.number(),
    programId: z.number().optional(),
    semesterNumber: z.number().min(1).max(8).optional(), // max enforced at tenant level in service
    targetBatchId: z.number().optional(),
    internalMarks: z.number().min(0).max(100).optional(),
    externalMarks: z.number().min(0).max(100).optional(),
    description: z.string().optional(),
});

// GET /api/courses/config/max-semesters - Get max semesters for tenant
router.get('/config/max-semesters', authenticate, cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const config = await courseService.getMaxSemestersConfig(req.user!.tenantId);
        res.json(config);
    } catch (error) {
        next(error);
    }
});

const updateCourseSchema = z.object({
    name: z.string().min(2).optional(),
    code: z.string().min(2).max(10).toUpperCase().optional(),
    credits: z.number().min(1).max(10).optional(),
    description: z.string().optional(),
});

// GET /api/courses - Get all courses
router.get('/', authenticate, cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { departmentId, programId } = req.query;

        // Dept admin/users can only see their department's courses
        let deptFilter = parseOptionalInt(departmentId as string, 'departmentId');
        if (req.user?.role === 'DEPARTMENT_ADMIN' && req.user.departmentId) {
            deptFilter = req.user.departmentId;
        }

        const courses = await courseService.getAll({
            departmentId: deptFilter,
            programId: parseOptionalInt(programId as string, 'programId'),
            tenantId: req.user!.tenantId,
        });

        res.json(courses);
    } catch (error) {
        next(error);
    }
});

// GET /api/courses/:id - Get course by ID
router.get('/:id', authenticate, cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const course = await courseService.getById(id);

        if (!course) {
            res.status(404).json({ error: 'Course not found' });
            return;
        }

        res.json(course);
    } catch (error) {
        next(error);
    }
});

// POST /api/courses - Create course (COE or Department Admin)
router.post('/', authenticate, courseManager, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createCourseSchema.parse(req.body);

        // Dept admins can only create courses for their own department
        if (req.user!.role === 'DEPARTMENT_ADMIN' && req.user!.departmentId) {
            if (data.departmentId !== req.user!.departmentId) {
                res.status(403).json({ error: 'Department admins can only create courses for their own department' });
                return;
            }
        }

        const course = await courseService.create(
            { ...data, tenantId: req.user!.tenantId },
            req.user!.userId
        );
        await invalidateCache(`api:${req.user!.tenantId}:/api/courses*`);
        res.status(201).json(course);
    } catch (error) {
        next(error);
    }
});

// PUT /api/courses/:id - Update course (COE or Department Admin)
router.put('/:id', authenticate, courseManager, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const data = updateCourseSchema.parse(req.body);

        const existing = await courseService.getById(id);
        if (!existing) {
            res.status(404).json({ error: 'Course not found' });
            return;
        }

        if (existing.isLocked) {
            res.status(403).json({ error: 'Cannot edit a locked course' });
            return;
        }

        const course = await courseService.update(id, data, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:/api/courses*`);
        res.json(course);
    } catch (error) {
        next(error);
    }
});

// PUT /api/courses/:id/lock - Lock course (COE or Department Admin)
router.put('/:id/lock', authenticate, courseManager, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');

        const existing = await courseService.getById(id);
        if (!existing) {
            res.status(404).json({ error: 'Course not found' });
            return;
        }

        if (existing.isLocked) {
            res.status(400).json({ error: 'Course is already locked' });
            return;
        }

        const course = await courseService.lock(id, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:/api/courses*`);
        res.json(course);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/courses/:id - Delete course (COE or Department Admin)
router.delete('/:id', authenticate, courseManager, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');

        const existing = await courseService.getById(id);
        if (existing?.isLocked) {
            res.status(403).json({ error: 'Cannot delete a locked course' });
            return;
        }

        await courseService.delete(id, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:/api/courses*`);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
