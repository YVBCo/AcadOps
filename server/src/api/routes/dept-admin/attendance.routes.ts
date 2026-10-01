/**
 * Dept Admin — Attendance Sub-Router
 * ──────────────────────────────────────
 * Handles: attendance records, attendance editing, attendance locking,
 * semester marks viewing
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { deptAdminService } from '../../../services/index.js';
import { parseIntParam } from '../../../utils/param-utils.js';
import { getDepartmentId } from './shared.js';

// ─── Zod Schemas ──────────────────────────────────────────────
const editAttendanceSchema = z.object({
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
    reason: z.string().min(1),
});

const lockAttendanceSchema = z.object({
    subjectId: z.number().int().positive(),
    date: z.string().min(1),
});

const router = Router();

// Get semester marks for viewing (read-only for department admin)
router.get('/semester-marks', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = getDepartmentId(req);
        const { batchId, courseId, skip, take } = req.query;

        const result = await deptAdminService.getSemesterMarks(departmentId, {
            batchId: batchId ? parseInt(batchId as string) : undefined,
            courseId: courseId ? parseInt(courseId as string) : undefined,
            skip: skip ? parseInt(skip as string) : undefined,
            take: take ? parseInt(take as string) : undefined,
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Get attendance records for section/course/date
router.get('/attendance/:sectionId/:courseId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sectionId = parseIntParam(req.params.sectionId, 'sectionId');
        const courseId = parseIntParam(req.params.courseId, 'courseId');
        const { date } = req.query;
        const tenantId = req.user!.tenantId;

        const result = await deptAdminService.getAttendanceForSection(
            tenantId,
            sectionId,
            courseId,
            date as string | undefined,
            parseInt(req.query.skip as string) || 0,
            parseInt(req.query.take as string) || 200
        );

        if (result.error) {
            return res.status(404).json({ error: result.error });
        }

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Edit attendance (with reason)
router.put('/attendance/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const id = parseIntParam(req.params.id, 'id');
        const data = editAttendanceSchema.parse(req.body);

        const attendance = await deptAdminService.editAttendance(id, data.status, data.reason, user.userId);

        res.json(attendance);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Lock attendance for date
router.post('/attendance/lock', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const data = lockAttendanceSchema.parse(req.body);

        const result = await deptAdminService.lockAttendanceByDate(
            data.subjectId,
            new Date(data.date),
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
