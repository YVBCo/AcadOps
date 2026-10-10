/**
 * Dept Admin — Internal Marks Sub-Router
 * ──────────────────────────────────────
 * Handles: IA configuration, marks entry (single/bulk), marks editing,
 * marks finalization, COE submission
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { internalAssessmentService } from '../../../services/index.js';
import { parseIntParam } from '../../../utils/param-utils.js';
import { getDepartmentId } from './shared.js';

// ─── Zod Schemas ──────────────────────────────────────────────
const iaConfigSchema = z.object({
    courseId: z.number().int().positive(),
    semesterNumber: z.number().int().positive(),
    numInternals: z.number().int().optional(),
    maxMarksPerInternal: z.number().optional(),
    internalsToConsider: z.number().int().optional(),
    internalWeightage: z.number().optional(),
    hasAssignment: z.boolean().optional(),
    numAssignments: z.number().int().optional(),
    maxAssignmentMarks: z.number().optional(),
    assignmentWeightage: z.number().optional(),
    hasLab: z.boolean().optional(),
    numLabExams: z.number().int().optional(),
    maxLabMarks: z.number().optional(),
    labWeightage: z.number().optional(),
});

const recordMarksSchema = z.object({
    studentUsn: z.string().min(1),
    courseId: z.number().int().positive(),
    batchId: z.number().int().positive(),
    sectionId: z.number().int().positive(),
    semesterNumber: z.number().int().positive().optional(),
    internal1: z.number().nullable().optional(),
    internal2: z.number().nullable().optional(),
    internal3: z.number().nullable().optional(),
    assignmentMarks: z.number().nullable().optional(),
});

const bulkRecordMarksSchema = z.object({
    entries: z.array(z.object({
        studentUsn: z.string().min(1),
        courseId: z.number().int().positive(),
        batchId: z.number().int().positive(),
        sectionId: z.number().int().positive(),
        internal1: z.number().nullable().optional(),
        internal2: z.number().nullable().optional(),
        internal3: z.number().nullable().optional(),
        assignmentMarks: z.number().nullable().optional(),
    })).min(1),
    courseId: z.number().int().positive(),
    semesterNumber: z.number().int().positive().optional(),
});

const editMarksSchema = z.object({
    internal1: z.number().nullable().optional(),
    internal2: z.number().nullable().optional(),
    internal3: z.number().nullable().optional(),
    assignmentMarks: z.number().nullable().optional(),
    reason: z.string().min(1),
});

const finalizeMarksSchema = z.object({
    sectionId: z.number().int().positive(),
    courseId: z.number().int().positive(),
});

const submitToCoeSchema = z.object({
    batchId: z.number().int().positive(),
    courseId: z.number().int().positive(),
});

const router = Router();

// Get IA configuration
router.get('/ia-config/:courseId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const courseId = parseIntParam(req.params.courseId, 'courseId');
        const { semesterNumber } = req.query;

        const config = await internalAssessmentService.getConfig(
            courseId,
            semesterNumber ? parseInt(semesterNumber as string) : 1
        );

        res.json(config);
    } catch (error) {
        next(error);
    }
});

// Configure IA structure
router.post('/ia-config', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const data = iaConfigSchema.parse(req.body);

        const config = await internalAssessmentService.configureAssessment(
            data.courseId,
            data.semesterNumber,
            {
                numInternals: data.numInternals,
                maxMarksPerInternal: data.maxMarksPerInternal,
                internalsToConsider: data.internalsToConsider,
                internalWeightage: data.internalWeightage,
                hasAssignment: data.hasAssignment,
                numAssignments: data.numAssignments,
                maxAssignmentMarks: data.maxAssignmentMarks,
                assignmentWeightage: data.assignmentWeightage,
                hasLab: data.hasLab,
                numLabExams: data.numLabExams,
                maxLabMarks: data.maxLabMarks,
                labWeightage: data.labWeightage,
            },
            user.userId
        );

        res.status(201).json(config);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Get internal marks for section/course
router.get('/internal-marks/:sectionId/:courseId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sectionId = parseIntParam(req.params.sectionId, 'sectionId');
        const courseId = parseIntParam(req.params.courseId, 'courseId');

        const marks = await internalAssessmentService.getMarksForSection(sectionId, courseId);

        res.json(marks);
    } catch (error) {
        next(error);
    }
});

// Recalculate all marks for a course (fixes stale calculatedTotal values)
router.post('/internal-marks/recalculate', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const { courseId, semesterNumber } = req.body;
        const departmentId = getDepartmentId(req);

        if (!courseId) {
            return res.status(400).json({ error: 'courseId is required' });
        }

        const result = await internalAssessmentService.recalculateAllMarks(
            courseId,
            semesterNumber || 1,
            user.userId,
            departmentId
        );

        res.json({ message: `Recalculated marks for ${result.updated} students`, ...result });
    } catch (error) {
        next(error);
    }
});

// Record internal marks
router.post('/internal-marks', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const data = recordMarksSchema.parse(req.body);

        // Get or create default config
        let config = await internalAssessmentService.getConfig(data.courseId, data.semesterNumber || 1);
        if (!config) {
            config = await internalAssessmentService.configureAssessment(
                data.courseId,
                data.semesterNumber || 1,
                {},
                user.userId
            );
        }

        const marks = await internalAssessmentService.recordMarks(
            { studentUsn: data.studentUsn, courseId: data.courseId, batchId: data.batchId, sectionId: data.sectionId, internal1: data.internal1, internal2: data.internal2, internal3: data.internal3, assignmentMarks: data.assignmentMarks },
            config,
            user.userId
        );

        res.status(201).json(marks);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Bulk record internal marks
router.post('/internal-marks/bulk', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const data = bulkRecordMarksSchema.parse(req.body);

        let config = await internalAssessmentService.getConfig(data.courseId, data.semesterNumber || 1);
        if (!config) {
            config = await internalAssessmentService.configureAssessment(
                data.courseId,
                data.semesterNumber || 1,
                {},
                user.userId
            );
        }

        const result = await internalAssessmentService.bulkRecordMarks(data.entries, config, user.userId);

        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Edit internal marks (with reason)
router.put('/internal-marks/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const id = parseIntParam(req.params.id, 'id');
        const data = editMarksSchema.parse(req.body);

        const marks = await internalAssessmentService.editMarks(
            id,
            { internal1: data.internal1, internal2: data.internal2, internal3: data.internal3, assignmentMarks: data.assignmentMarks },
            data.reason,
            user.userId
        );

        res.json(marks);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Finalize internal marks for section/course
router.post('/internal-marks/finalize', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const data = finalizeMarksSchema.parse(req.body);

        const result = await internalAssessmentService.finalizeMarks(data.sectionId, data.courseId, user.userId);

        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Submit internal marks to COE
router.post('/internal-marks/submit-to-coe', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const departmentId = getDepartmentId(req);
        const data = submitToCoeSchema.parse(req.body);

        const result = await internalAssessmentService.submitToCOE(
            departmentId,
            data.batchId,
            data.courseId,
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

export default router;
