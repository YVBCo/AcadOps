/**
 * Clerk Marks Routes
 * ──────────────────────────────────────
 * Handles semester-end marks entry, revaluation submission,
 * and clerk dashboard statistics.
 * All logic delegated to ClerkMarksService.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { authenticate } from '../middleware/index.js';
import { clerkMarksService } from '../../services/clerk-marks.service.js';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

// Middleware to ensure only CLERK can access
const clerkOnly = (req: Request, res: Response, next: Function) => {
    if (req.user?.role !== 'CLERK') {
        res.status(403).json({ error: 'Access denied. Clerk only.' });
        return;
    }
    next();
};

// ── Zod Schemas ──────────────────────────────────────────────
const semesterMarksSchema = z.object({
    departmentId: z.number().int().positive(),
    batchId: z.number().int().positive(),
    courseId: z.number().int().positive(),
    entries: z.array(z.object({
        studentUsn: z.string().min(1),
        marks: z.number().int().min(0).max(50),
        examType: z.enum(['REGULAR', 'MAKEUP', 'REWRITE']).default('REGULAR'),
    })).min(1),
});

const revaluationSchema = z.object({
    resultId: z.number().int().positive(),
    newMarks: z.number().int().min(0).max(50),
});

// ── Routes ───────────────────────────────────────────────────

// GET assignments (departments + batches)
router.get('/assignments', authenticate, clerkOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await clerkMarksService.getAssignments(req.user!.tenantId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET courses for a department
router.get('/courses', authenticate, clerkOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { departmentId } = req.query;
        if (!departmentId) {
            res.status(400).json({ error: 'departmentId is required' });
            return;
        }
        const courses = await clerkMarksService.getCourses(parseIntParam(departmentId as string, 'departmentId'));
        res.json(courses);
    } catch (error) {
        next(error);
    }
});

// GET students for marks entry
router.get('/students', authenticate, clerkOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { departmentId, batchId, courseId } = req.query;
        if (!departmentId || !batchId || !courseId) {
            res.status(400).json({ error: 'departmentId, batchId, and courseId are required' });
            return;
        }

        const students = await clerkMarksService.getStudentsForMarksEntry(
            parseIntParam(departmentId as string, 'departmentId'),
            parseIntParam(batchId as string, 'batchId'),
            parseIntParam(courseId as string, 'courseId')
        );
        res.json(students);
    } catch (error) {
        next(error);
    }
});

// POST semester-end marks
router.post('/semester-marks', authenticate, clerkOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = semesterMarksSchema.parse(req.body);
        const result = await clerkMarksService.submitSemesterMarks(
            data.departmentId,
            data.batchId,
            data.courseId,
            data.entries,
            req.user!.userId
        );
        res.status(201).json({ message: 'Semester marks submitted for COE approval', ...result });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// GET own semester marks submissions
router.get('/semester-marks', authenticate, clerkOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status, departmentId, batchId, courseId } = req.query;
        const submissions = await clerkMarksService.getOwnSemesterMarks(req.user!.userId, {
            status: status as string | undefined,
            departmentId: departmentId ? parseIntParam(departmentId as string, 'departmentId') : undefined,
            batchId: batchId ? parseIntParam(batchId as string, 'batchId') : undefined,
            courseId: courseId ? parseIntParam(courseId as string, 'courseId') : undefined,
        });
        res.json(submissions);
    } catch (error) {
        next(error);
    }
});

// POST revaluation marks
router.post('/revaluations', authenticate, clerkOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = revaluationSchema.parse(req.body);
        const revaluation = await clerkMarksService.submitRevaluation(
            data.resultId,
            data.newMarks,
            req.user!.userId
        );
        res.status(201).json({ message: 'Revaluation submitted for COE approval', revaluation });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// GET own revaluations
router.get('/revaluations', authenticate, clerkOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const revaluations = await clerkMarksService.getOwnRevaluations(
            req.user!.userId,
            req.query.status as string | undefined
        );
        res.json(revaluations);
    } catch (error) {
        next(error);
    }
});

// GET published results (for revaluation search)
router.get('/results', authenticate, clerkOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { studentUsn, departmentId, batchId, courseId } = req.query;
        if (!studentUsn && !courseId) {
            res.status(400).json({ error: 'studentUsn or courseId is required' });
            return;
        }
        const results = await clerkMarksService.searchPublishedResults({
            studentUsn: studentUsn as string | undefined,
            departmentId: departmentId ? parseIntParam(departmentId as string, 'departmentId') : undefined,
            batchId: batchId ? parseIntParam(batchId as string, 'batchId') : undefined,
            courseId: courseId ? parseIntParam(courseId as string, 'courseId') : undefined,
        });
        res.json(results);
    } catch (error) {
        next(error);
    }
});

// GET clerk submission stats
router.get('/stats', authenticate, clerkOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stats = await clerkMarksService.getStats(req.user!.userId);
        res.json(stats);
    } catch (error) {
        next(error);
    }
});

export default router;
