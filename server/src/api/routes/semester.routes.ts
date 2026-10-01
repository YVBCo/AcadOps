import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { semesterService } from '../../services/index.js';
import { authenticate, superAdminOnly, adminOnly } from '../middleware/index.js';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

// Validation schemas
const createSemesterSchema = z.object({
    name: z.string().min(2),
    startDate: z.string().transform((val) => new Date(val)),
    endDate: z.string().transform((val) => new Date(val)),
});

const updateSemesterSchema = z.object({
    name: z.string().min(2).optional(),
    startDate: z.string().transform((val) => new Date(val)).optional(),
    endDate: z.string().transform((val) => new Date(val)).optional(),
});

// GET /api/semesters - Get all semesters
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const status = req.query.status as 'ACTIVE' | 'CLOSED' | 'ARCHIVED' | undefined;
        const semesters = await semesterService.getAll(status, req.user!.tenantId);
        res.json(semesters);
    } catch (error) {
        next(error);
    }
});

// GET /api/semesters/active - Get active semester
router.get('/active', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const semester = await semesterService.getActive(req.user!.tenantId);
        if (!semester) {
            res.status(404).json({ error: 'No active semester found' });
            return;
        }
        res.json(semester);
    } catch (error) {
        next(error);
    }
});

// GET /api/semesters/:id - Get semester by ID
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const semester = await semesterService.getById(id);

        if (!semester) {
            res.status(404).json({ error: 'Semester not found' });
            return;
        }

        res.json(semester);
    } catch (error) {
        next(error);
    }
});

// POST /api/semesters - Create semester (Super Admin only)
router.post('/', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createSemesterSchema.parse(req.body);
        const semester = await semesterService.create(
            { ...data, tenantId: req.user!.tenantId },
            req.user!.userId
        );
        res.status(201).json(semester);
    } catch (error) {
        next(error);
    }
});

// PUT /api/semesters/:id - Update semester (Super Admin only)
router.put('/:id', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const data = updateSemesterSchema.parse(req.body);
        const semester = await semesterService.update(id, data, req.user!.userId);
        res.json(semester);
    } catch (error) {
        next(error);
    }
});

// POST /api/semesters/:id/open - Open semester (Admin only)
router.post('/:id/open', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const semester = await semesterService.open(id, req.user!.userId, req.user!.role);
        res.json(semester);
    } catch (error) {
        next(error);
    }
});

// POST /api/semesters/:id/close - Close semester (Admin only) - CRITICAL
const closeSemesterSchema = z.object({
    transitions: z.array(z.object({
        batchId: z.number(),
        type: z.enum(['ROTATE_CYCLES', 'RESTORE_BRANCHES']),
    })).optional(),
});

router.post('/:id/close', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const { transitions } = closeSemesterSchema.parse(req.body);

        const semester = await semesterService.close(
            id,
            req.user!.userId,
            req.user!.role,
            { transitions }
        );
        res.json(semester);
    } catch (error) {
        next(error);
    }
});

// POST /api/semesters/:id/archive - Archive semester (Admin only)
router.post('/:id/archive', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const semester = await semesterService.archive(id, req.user!.userId, req.user!.role);
        res.json(semester);
    } catch (error) {
        next(error);
    }
});

export default router;
