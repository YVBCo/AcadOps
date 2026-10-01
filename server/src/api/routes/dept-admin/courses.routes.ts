/**
 * Dept Admin — Courses & Allocations Sub-Router
 * ──────────────────────────────────────
 * Handles: course listing, section/batch allocations, teacher CRUD, teacher assignment
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { deptAdminService } from '../../../services/index.js';
import { parseIntParam } from '../../../utils/param-utils.js';
import { getDepartmentId } from './shared.js';

// ─── Zod Schemas ──────────────────────────────────────────────
const allocateCourseSchema = z.object({
    courseId: z.number().int().positive(),
    sectionId: z.number().int().positive(),
    semesterNumber: z.number().int().positive(),
    teacherId: z.number().int().positive().nullable().optional(),
});

const allocateCourseBatchSchema = z.object({
    courseId: z.number().int().positive(),
    batchId: z.number().int().positive(),
    semesterNumber: z.number().int().positive(),
});

const createTeacherSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1).max(200),
    employeeId: z.string().min(1),
    designation: z.string().optional(),
});

const assignTeacherSchema = z.object({
    teacherId: z.number().int().positive(),
});

const router = Router();

// Get COE-approved courses (read-only)
router.get('/courses', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = getDepartmentId(req);
        const { all } = req.query;

        const courses = all === 'true'
            ? await deptAdminService.getAllDepartmentCourses(departmentId)
            : await deptAdminService.getCourses(departmentId);

        res.json(courses);
    } catch (error) {
        next(error);
    }
});

// Allocate course to section
router.post('/courses/allocate', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const data = allocateCourseSchema.parse(req.body);

        const allocation = await deptAdminService.allocateCourseToSection(
            data.courseId,
            data.sectionId,
            data.semesterNumber,
            data.teacherId || null,
            user.userId
        );

        res.status(201).json(allocation);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Get course allocations for a section
router.get('/sections/:id/allocations', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sectionId = parseIntParam(req.params.id, 'id');
        const { semesterNumber } = req.query;

        const allocations = await deptAdminService.getCourseAllocations(
            sectionId,
            semesterNumber ? parseInt(semesterNumber as string) : undefined
        );

        res.json(allocations);
    } catch (error) {
        next(error);
    }
});

// Allocate course to ALL sections of a batch
router.post('/courses/allocate-batch', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const data = allocateCourseBatchSchema.parse(req.body);
        const departmentId = user.departmentId;

        if (!departmentId) {
            return res.status(400).json({ error: 'User must have a department' });
        }

        const result = await deptAdminService.allocateCourseToAllSections(
            data.courseId,
            data.batchId,
            data.semesterNumber,
            departmentId,
            user.userId
        );

        res.status(201).json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Get course allocations for a batch (grouped by course with section teachers)
router.get('/batches/:batchId/allocations', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const batchId = parseIntParam(req.params.batchId, 'batchId');
        const semesterNumber = parseIntParam(req.query.semesterNumber as string, 'semesterNumber');
        const departmentId = user.departmentId;

        if (!semesterNumber) {
            return res.status(400).json({ error: 'semesterNumber query param is required' });
        }

        if (!departmentId) {
            return res.status(400).json({ error: 'User must have a department' });
        }

        const result = await deptAdminService.getCourseAllocationsByBatch(
            batchId,
            departmentId,
            semesterNumber
        );

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Create teacher account
router.post('/teachers', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const departmentId = getDepartmentId(req);
        const data = createTeacherSchema.parse(req.body);

        const result = await deptAdminService.createTeacher(
            { email: data.email, name: data.name, departmentId, employeeId: data.employeeId, designation: data.designation, tenantId: user.tenantId },
            user.userId
        );

        res.status(201).json({
            user: result.user,
            message: 'Teacher created. Credentials sent via email.'
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Get teachers for department
router.get('/teachers', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = getDepartmentId(req);

        const teachers = await deptAdminService.getTeachers(departmentId);

        res.json(teachers);
    } catch (error) {
        next(error);
    }
});

// Assign teacher to course allocation
router.post('/allocations/:id/assign-teacher', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const departmentId = getDepartmentId(req);
        const allocationId = parseIntParam(req.params.id, 'id');
        const data = assignTeacherSchema.parse(req.body);

        const allocation = await deptAdminService.assignTeacher(
            allocationId,
            data.teacherId,
            user.userId,
            departmentId
        );

        res.json(allocation);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

export default router;
