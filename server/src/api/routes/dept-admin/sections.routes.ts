/**
 * Dept Admin — Sections & Students Sub-Router
 * ──────────────────────────────────────
 * Handles: student listing, section CRUD, student assignment
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { deptAdminService } from '../../../services/index.js';
import { parseIntParam } from '../../../utils/param-utils.js';
import { getDepartmentId } from './shared.js';

// ─── Zod Schemas ──────────────────────────────────────────────
const createSectionSchema = z.object({
    name: z.string().min(1).max(50),
    batchId: z.number().int().positive(),
});

const assignStudentsSchema = z.object({
    studentProfileIds: z.array(z.number().int().positive()).min(1),
});

const removeStudentSchema = z.object({
    studentProfileId: z.number().int().positive(),
});

const router = Router();

// Get students for department (grouped by batch/USN)
router.get('/students', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = getDepartmentId(req);
        const { batchId, sectionId, unassignedOnly, skip, take } = req.query;

        const result = await deptAdminService.getStudentsByDepartment(departmentId, {
            batchId: batchId ? parseInt(batchId as string) : undefined,
            sectionId: sectionId ? parseInt(sectionId as string) : undefined,
            unassignedOnly: unassignedOnly === 'true',
            skip: skip ? parseInt(skip as string) : undefined,
            take: take ? parseInt(take as string) : undefined,
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Get sections for department
router.get('/sections', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = getDepartmentId(req);
        const { batchId } = req.query;

        const sections = await deptAdminService.getSections(
            departmentId,
            batchId ? parseInt(batchId as string) : undefined
        );

        res.json(sections);
    } catch (error) {
        next(error);
    }
});

// Create section within batch
router.post('/sections', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const departmentId = getDepartmentId(req);
        const data = createSectionSchema.parse(req.body);

        const section = await deptAdminService.createSection(
            { name: data.name, departmentId, batchId: data.batchId, tenantId: user.tenantId },
            user.userId
        );

        res.status(201).json(section);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Assign students to section
router.post('/sections/:id/assign-students', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const sectionId = parseIntParam(req.params.id, 'id');
        const data = assignStudentsSchema.parse(req.body);

        const result = await deptAdminService.assignStudentsToSection(
            sectionId,
            data.studentProfileIds,
            user.userId
        );

        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Remove student from section
router.post('/sections/:id/remove-student', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const sectionId = parseIntParam(req.params.id, 'id');
        const data = removeStudentSchema.parse(req.body);

        const result = await deptAdminService.removeStudentFromSection(
            sectionId,
            data.studentProfileId,
            user.userId
        );

        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Lock section
router.post('/sections/:id/lock', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const sectionId = parseIntParam(req.params.id, 'id');

        const section = await deptAdminService.lockSection(sectionId, user.userId);

        res.json(section);
    } catch (error) {
        next(error);
    }
});

export default router;
