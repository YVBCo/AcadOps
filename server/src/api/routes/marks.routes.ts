import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { marksService } from '../../services/marks.service.js';
import { userService } from '../../services/user.service.js';
import { authenticate, teacherOrAbove } from '../middleware/auth.middleware.js';
import { parseIntParam } from '../../utils/param-utils.js';
import { ExamType } from '@prisma/client';

const router = Router();

// Validation schemas
const recordMarksSchema = z.object({
    studentId: z.number(),
    subjectId: z.number(),
    examType: z.enum(['MIDTERM', 'FINAL', 'QUIZ', 'PRACTICAL', 'INTERNAL']),
    score: z.number().min(0),
    maxScore: z.number().default(100),
    remarks: z.string().optional(),
});

const bulkRecordMarksSchema = z.object({
    examType: z.enum(['MIDTERM', 'FINAL', 'QUIZ', 'PRACTICAL', 'INTERNAL']),
    maxScore: z.number().default(100),
    entries: z.array(z.object({
        studentId: z.number(),
        score: z.number().min(0),
        remarks: z.string().optional(),
    })),
});

const updateMarksSchema = z.object({
    score: z.number().min(0).optional(),
    maxScore: z.number().optional(),
    remarks: z.string().optional(),
});

// Helper to check if user can manage marks for a subject
async function canManageSubjectMarks(userId: number, subjectId: number, role: string): Promise<boolean> {
    if (role === 'SUPER_ADMIN' || role === 'DEPARTMENT_ADMIN') {
        return true;
    }

    if (role === 'TEACHER') {
        return userService.verifyTeacherSubjectAccess(userId, subjectId);
    }

    return false;
}

// GET /api/marks/subject/:subjectId - Get all marks for a subject
router.get('/subject/:subjectId', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subjectId = parseIntParam(req.params.subjectId, 'subjectId');
        const examType = req.query.examType as ExamType | undefined;

        // Verify access
        const canManage = await canManageSubjectMarks(req.user!.userId, subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to view marks for this subject' });
            return;
        }

        if (examType) {
            const marks = await marksService.getMarksBySubjectAndExamType(subjectId, examType);
            res.json(marks);
        } else {
            const marks = await marksService.getMarksBySubject(subjectId);
            res.json(marks);
        }
    } catch (error) {
        next(error);
    }
});

// GET /api/marks/subject/:subjectId/summary - Get grade summary for a subject
router.get('/subject/:subjectId/summary', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subjectId = parseIntParam(req.params.subjectId, 'subjectId');

        // Verify access
        const canManage = await canManageSubjectMarks(req.user!.userId, subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to view marks for this subject' });
            return;
        }

        const summary = await marksService.getSubjectGradeSummary(subjectId);
        res.json(summary);
    } catch (error) {
        next(error);
    }
});

// GET /api/marks/subject/:subjectId/students - Get enrolled students for grading
router.get('/subject/:subjectId/students', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subjectId = parseIntParam(req.params.subjectId, 'subjectId');
        const examType = (req.query.examType as ExamType) || 'MIDTERM';

        // Verify access
        const canManage = await canManageSubjectMarks(req.user!.userId, subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to view marks for this subject' });
            return;
        }

        const students = await marksService.getEnrolledStudentsForGrading(subjectId, examType);
        res.json(students);
    } catch (error) {
        next(error);
    }
});

// GET /api/marks/my - Get current student's marks
router.get('/my', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        if (user.role !== 'STUDENT') {
            res.status(400).json({ error: 'Only students can view their own marks' });
            return;
        }

        const studentProfileId = await userService.getStudentProfileId(user.userId);
        if (!studentProfileId) {
            res.status(404).json({ error: 'Student profile not found' });
            return;
        }

        const subjectId = req.query.subjectId ? parseIntParam(req.query.subjectId as string, 'subjectId') : undefined;
        const report = await marksService.getStudentGradeReport(studentProfileId, subjectId);
        res.json(report);
    } catch (error) {
        next(error);
    }
});

// POST /api/marks - Record marks for a single student
router.post('/', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = recordMarksSchema.parse(req.body);

        // Verify access
        const canManage = await canManageSubjectMarks(req.user!.userId, data.subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to record marks for this subject' });
            return;
        }

        const marks = await marksService.recordMarks(
            data as Parameters<typeof marksService.recordMarks>[0],
            req.user!.userId
        );
        res.status(201).json(marks);
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

// POST /api/marks/subject/:subjectId/bulk - Bulk record marks
router.post('/subject/:subjectId/bulk', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subjectId = parseIntParam(req.params.subjectId, 'subjectId');

        // Verify access
        const canManage = await canManageSubjectMarks(req.user!.userId, subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to record marks for this subject' });
            return;
        }

        const data = bulkRecordMarksSchema.parse(req.body);
        const result = await marksService.bulkRecordMarks(
            subjectId,
            data.examType as ExamType,
            data.entries,
            data.maxScore,
            req.user!.userId
        );
        res.json({
            message: 'Marks recorded successfully',
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

// PUT /api/marks/:id - Update marks
router.put('/:id', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const data = updateMarksSchema.parse(req.body);

        const marks = await marksService.updateMarks(id, data, req.user!.userId);
        res.json(marks);
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

// DELETE /api/marks/:id - Delete marks
router.delete('/:id', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        await marksService.deleteMarks(id, req.user!.userId);
        res.status(204).send();
    } catch (error) {
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
            return;
        }
        next(error);
    }
});

export default router;
