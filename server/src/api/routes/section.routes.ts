import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sectionService } from '../../services/section.service.js';
import { authenticate, adminOnly } from '../middleware/index.js';
import { parseIntParam, parseOptionalInt } from '../../utils/param-utils.js';

const router = Router();

// Validation schemas
const createSectionSchema = z.object({
    name: z.string().min(1).max(10),
    departmentId: z.number().int().positive(),
    batchId: z.number().int().positive(),
});

const assignStudentsSchema = z.object({
    sectionId: z.number().int().positive(),
    studentProfileIds: z.array(z.number().int().positive()).min(1),
});

// GET /api/sections - Get sections (filtered by departmentId and/or batchId)
router.get('/', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = req.query.departmentId ? parseIntParam(req.query.departmentId as string, 'departmentId') : undefined;
        const batchId = req.query.batchId ? parseIntParam(req.query.batchId as string, 'batchId') : undefined;

        if (departmentId && batchId) {
            const sections = await sectionService.getByDepartmentAndBatch(departmentId, batchId);
            res.json(sections);
        } else if (departmentId) {
            const sections = await sectionService.getByDepartment(departmentId);
            res.json(sections);
        } else {
            const sections = await sectionService.getAll(req.user!.tenantId);
            res.json(sections);
        }
    } catch (error) {
        next(error);
    }
});

// GET /api/sections/:id - Get section by ID
router.get('/:id', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const section = await sectionService.getById(id);

        if (!section) {
            res.status(404).json({ error: 'Section not found' });
            return;
        }

        res.json(section);
    } catch (error) {
        next(error);
    }
});

// GET /api/sections/:id/students - Get students in section
router.get('/:id/students', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const students = await sectionService.getStudents(id);
        res.json(students);
    } catch (error) {
        next(error);
    }
});

// POST /api/sections - Create section
router.post('/', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validated = createSectionSchema.parse(req.body);
        const section = await sectionService.create({ ...validated, tenantId: req.user!.tenantId }, req.user!.userId);
        res.status(201).json(section);
    } catch (error) {
        next(error);
    }
});

// PATCH /api/sections/:id/toggle-lock - Lock/unlock section
router.patch('/:id/toggle-lock', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const section = await sectionService.toggleLock(id, req.user!.userId);
        res.json(section);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/sections/:id - Delete section
router.delete('/:id', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        await sectionService.delete(id, req.user!.userId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// POST /api/sections/assign-students - Assign students to a section
router.post('/assign-students', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const validated = assignStudentsSchema.parse(req.body);

        const result = await sectionService.assignStudents(
            validated.sectionId,
            validated.studentProfileIds,
            req.user!.userId
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/sections/remove-students - Remove students from their sections
router.post('/remove-students', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { studentProfileIds } = req.body;

        if (!Array.isArray(studentProfileIds) || studentProfileIds.length === 0) {
            res.status(400).json({ error: 'studentProfileIds must be a non-empty array' });
            return;
        }

        const result = await sectionService.removeStudentsFromSection(studentProfileIds, req.user!.userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
