/**
 * Dept Admin — Admin Operations Sub-Router
 * ──────────────────────────────────────
 * Handles: audit logs, edit request approval/rejection,
 * mentor assignments, mentor tracking
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { deptAdminService } from '../../../services/index.js';
import { mentorService } from '../../../services/mentor/index.js';
import { parseIntParam } from '../../../utils/param-utils.js';
import { getDepartmentId } from './shared.js';

// ─── Zod Schemas ──────────────────────────────────────────────
const editRequestReviewSchema = z.object({
    reviewNote: z.string().optional(),
});

const editRequestRejectSchema = z.object({
    reviewNote: z.string().min(1),
});

const assignMentorSchema = z.object({
    teacherProfileId: z.number().int().positive(),
    studentUsns: z.array(z.string()).optional(),
    studentProfileIds: z.array(z.number().int().positive()).optional(),
    batchId: z.number().int().positive().optional(),
    sectionId: z.number().int().positive().optional(),
    academicYear: z.string().min(1),
    semester: z.number().int().optional(),
    semesterNumber: z.number().int().optional(),
});

const expireSemesterSchema = z.object({
    academicYear: z.string().min(1),
    semester: z.number().int(),
});

const router = Router();

// ── Audit Logs ───────────────────────────────────────────────
router.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = getDepartmentId(req);
        const { skip, take, action, startDate, endDate } = req.query;

        const result = await deptAdminService.getAuditLogs(departmentId, {
            skip: skip ? parseInt(skip as string) : undefined,
            take: take ? parseInt(take as string) : undefined,
            action: action as string,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined,
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ── Edit Requests ────────────────────────────────────────────

// Get pending edit requests for department
router.get('/edit-requests', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = getDepartmentId(req);
        const { status } = req.query;
        const skip = Math.max(0, parseInt(req.query.skip as string) || 0);
        const take = Math.min(200, Math.max(1, parseInt(req.query.take as string) || 50));

        const requests = await deptAdminService.getEditRequests(
            departmentId,
            (status as string) || 'PENDING',
            skip,
            take
        );

        res.json(requests);
    } catch (error) {
        next(error);
    }
});

// Approve an edit request
router.post('/edit-requests/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const departmentId = getDepartmentId(req);
        const requestId = parseIntParam(req.params.id, 'id');
        const data = editRequestReviewSchema.parse(req.body);

        const updated = await deptAdminService.approveEditRequest(
            requestId,
            user.userId,
            departmentId,
            data.reviewNote
        );

        res.json(updated);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Reject an edit request
router.post('/edit-requests/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const departmentId = getDepartmentId(req);
        const requestId = parseIntParam(req.params.id, 'id');
        const data = editRequestRejectSchema.parse(req.body);

        const updated = await deptAdminService.rejectEditRequest(
            requestId,
            user.userId,
            departmentId,
            data.reviewNote
        );

        res.json(updated);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// ── Mentor Assignments ───────────────────────────────────────

// Get mentor assignments for department
router.get('/mentor-assignments', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = getDepartmentId(req);
        const { batchId, sectionId } = req.query;

        const assignments = await mentorService.getMentorAssignments(
            departmentId,
            batchId ? parseInt(batchId as string) : undefined,
            sectionId ? parseInt(sectionId as string) : undefined
        );

        res.json(assignments);
    } catch (error) {
        next(error);
    }
});

// Assign mentor to students
router.post('/mentor-assignments', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const departmentId = getDepartmentId(req);
        const data = assignMentorSchema.parse(req.body);

        const semValue = data.semester ?? data.semesterNumber ?? 1;

        // Support both studentUsns (from frontend) and studentProfileIds (legacy)
        let resolvedProfileIds: number[] = data.studentProfileIds || [];
        let resolvedBatchId = data.batchId;
        let resolvedSectionId = data.sectionId;

        if (data.studentUsns && data.studentUsns.length > 0 && resolvedProfileIds.length === 0) {
            const profiles = await deptAdminService.resolveStudentProfilesByUsn(data.studentUsns);
            resolvedProfileIds = profiles.map(p => p.id);

            if (resolvedProfileIds.length === 0) {
                return res.status(400).json({ error: 'No valid students found for the given USNs' });
            }

            if (!resolvedBatchId && profiles[0]?.batchId) {
                resolvedBatchId = profiles[0].batchId;
            }
            if (!resolvedSectionId && profiles[0]?.sectionId) {
                resolvedSectionId = profiles[0].sectionId;
            }
        }

        if (resolvedProfileIds.length === 0) {
            return res.status(400).json({ error: 'Either studentUsns or studentProfileIds is required' });
        }

        // Default batch/section if still not set
        if (!resolvedBatchId || !resolvedSectionId) {
            const firstProfile = await deptAdminService.getStudentProfileById(resolvedProfileIds[0]);
            resolvedBatchId = resolvedBatchId || firstProfile?.batchId || 0;
            resolvedSectionId = resolvedSectionId || firstProfile?.sectionId || 0;
        }

        const result = await mentorService.assignMentor(
            data.teacherProfileId,
            resolvedProfileIds,
            departmentId,
            resolvedBatchId,
            resolvedSectionId,
            data.academicYear,
            semValue,
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

// Expire a mentor assignment
router.post('/mentor-assignments/:id/expire', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const assignmentId = parseIntParam(req.params.id, 'id');

        const result = await mentorService.expireMentorAssignment(assignmentId, user.userId);

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// Expire all mentor assignments for a semester
router.post('/mentor-assignments/expire-semester', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const departmentId = getDepartmentId(req);
        const data = expireSemesterSchema.parse(req.body);

        const result = await mentorService.expireForSemester(
            departmentId,
            data.academicYear,
            data.semester,
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

// Get mentor assignment history
router.get('/mentor-assignments/history', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = getDepartmentId(req);
        const { batchId } = req.query;

        const history = await mentorService.getMentorAssignmentHistory(
            departmentId,
            batchId ? parseInt(batchId as string) : undefined
        );

        res.json(history);
    } catch (error) {
        next(error);
    }
});

// ── Mentor Tracking ──────────────────────────────────────────

// Get mentor tracking summary (interaction completion status per mentor)
router.get('/mentor-tracking', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = getDepartmentId(req);
        const { batchId, sectionId } = req.query;

        const summary = await mentorService.getMentorTrackingSummary(
            departmentId,
            batchId ? parseInt(batchId as string) : undefined,
            sectionId ? parseInt(sectionId as string) : undefined
        );

        res.json(summary);
    } catch (error) {
        next(error);
    }
});

export default router;
