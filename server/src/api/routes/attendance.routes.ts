import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { attendanceService } from '../../services/attendance.service.js';
import { userService } from '../../services/user.service.js';
import { authenticate, requireRole, teacherOrAbove } from '../middleware/auth.middleware.js';
import { parseIntParam } from '../../utils/param-utils.js';
import { AttendanceStatus } from '@prisma/client';

const router = Router();

// Validation schemas
const markAttendanceSchema = z.object({
    studentId: z.number(),
    date: z.string().transform((s) => new Date(s)),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
    remarks: z.string().optional(),
});

const bulkMarkAttendanceSchema = z.object({
    date: z.string().transform((s) => new Date(s)),
    entries: z.array(z.object({
        studentId: z.number(),
        status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
        remarks: z.string().optional(),
    })),
});

// Helper to check if user can manage attendance for a subject
async function canManageSubjectAttendance(userId: number, subjectId: number, role: string): Promise<boolean> {
    // Super Admin and Dept Admin can always manage
    if (role === 'SUPER_ADMIN' || role === 'DEPARTMENT_ADMIN') {
        return true;
    }

    // Teachers can only manage their assigned subjects
    if (role === 'TEACHER') {
        return userService.verifyTeacherSubjectAccess(userId, subjectId);
    }

    return false;
}

// GET /api/attendance/subject/:subjectId - Get attendance sheet for a subject on a date
router.get('/subject/:subjectId', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subjectId = parseIntParam(req.params.subjectId, 'subjectId');
        const date = req.query.date ? new Date(req.query.date as string) : new Date();

        // Verify access
        const canManage = await canManageSubjectAttendance(req.user!.userId, subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to view this subject\'s attendance' });
            return;
        }

        const students = await attendanceService.getEnrolledStudentsForAttendance(subjectId, date);
        res.json({
            subjectId,
            date: date.toISOString().split('T')[0],
            students,
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/attendance/subject/:subjectId/summary - Get attendance summary for a subject
router.get('/subject/:subjectId/summary', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subjectId = parseIntParam(req.params.subjectId, 'subjectId');

        // Verify access
        const canManage = await canManageSubjectAttendance(req.user!.userId, subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to view this subject\'s attendance' });
            return;
        }

        const summary = await attendanceService.getAttendanceSummary(subjectId);
        res.json(summary);
    } catch (error) {
        next(error);
    }
});

// GET /api/attendance/my - Get current student's attendance
router.get('/my', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        if (user.role !== 'STUDENT') {
            res.status(400).json({ error: 'Only students can view their own attendance' });
            return;
        }

        const studentProfileId = await userService.getStudentProfileId(user.userId);
        if (!studentProfileId) {
            res.status(404).json({ error: 'Student profile not found' });
            return;
        }

        const subjectId = req.query.subjectId ? parseIntParam(req.query.subjectId as string, 'subjectId') : undefined;
        const attendance = await attendanceService.getStudentAttendance(studentProfileId, subjectId);
        res.json(attendance);
    } catch (error) {
        next(error);
    }
});

// POST /api/attendance/subject/:subjectId - Mark attendance for a single student
router.post('/subject/:subjectId', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subjectId = parseIntParam(req.params.subjectId, 'subjectId');

        // Verify access
        const canManage = await canManageSubjectAttendance(req.user!.userId, subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to mark attendance for this subject' });
            return;
        }

        const data = markAttendanceSchema.parse(req.body);
        const attendance = await attendanceService.markAttendance(
            subjectId,
            data.studentId,
            data.date,
            data.status as AttendanceStatus,
            data.remarks,
            req.user!.userId
        );
        res.status(201).json(attendance);
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
            return;
        }
        next(error);
    }
});

// POST /api/attendance/subject/:subjectId/bulk - Bulk mark attendance
router.post('/subject/:subjectId/bulk', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subjectId = parseIntParam(req.params.subjectId, 'subjectId');

        // Verify access
        const canManage = await canManageSubjectAttendance(req.user!.userId, subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to mark attendance for this subject' });
            return;
        }

        const data = bulkMarkAttendanceSchema.parse(req.body);
        const result = await attendanceService.bulkMarkAttendance(
            subjectId,
            data.date,
            data.entries,
            req.user!.userId
        );
        res.json({
            message: 'Attendance marked successfully',
            ...result,
        });
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({ error: 'Validation failed', details: error.issues });
            return;
        }
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
            return;
        }
        next(error);
    }
});

// GET /api/attendance/subject/:subjectId/report - Get attendance report for date range
router.get('/subject/:subjectId/report', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subjectId = parseIntParam(req.params.subjectId, 'subjectId');
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().setDate(1));
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

        // Verify access
        const canManage = await canManageSubjectAttendance(req.user!.userId, subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to view this subject\'s attendance' });
            return;
        }

        const report = await attendanceService.getAttendanceReport(subjectId, startDate, endDate);
        res.json({
            subjectId,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            records: report,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
