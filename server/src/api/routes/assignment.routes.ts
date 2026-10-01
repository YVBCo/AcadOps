import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { assignmentService } from '../../services/assignment.service.js';
import { authenticate, teacherOrAbove } from '../middleware/auth.middleware.js';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

// Validation schemas
const createAssignmentSchema = z.object({
    subjectId: z.number(),
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    dueDate: z.string().transform((s) => new Date(s)),
    maxScore: z.number().default(100),
});

const updateAssignmentSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    dueDate: z.string().transform((s) => new Date(s)).optional(),
    maxScore: z.number().optional(),
});

const submitAssignmentSchema = z.object({
    fileUrl: z.string().optional(),
    content: z.string().optional(),
});

const gradeSubmissionSchema = z.object({
    score: z.number().min(0),
    feedback: z.string().optional(),
});



// GET /api/assignments/subject/:subjectId - Get all assignments for a subject
router.get('/subject/:subjectId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const subjectId = parseIntParam(req.params.subjectId, 'subjectId');
        const assignments = await assignmentService.getAssignmentsBySubject(subjectId);
        res.json(assignments);
    } catch (error) {
        next(error);
    }
});

// GET /api/assignments/:id - Get assignment by ID with submissions
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const assignment = await assignmentService.getAssignmentById(id);
        if (!assignment) {
            res.status(404).json({ error: 'Assignment not found' });
            return;
        }
        res.json(assignment);
    } catch (error) {
        next(error);
    }
});

// GET /api/assignments/:id/stats - Get assignment statistics
router.get('/:id/stats', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const stats = await assignmentService.getAssignmentStats(id);
        res.json(stats);
    } catch (error) {
        next(error);
    }
});

// POST /api/assignments - Create assignment
router.post('/', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createAssignmentSchema.parse(req.body);

        // Check permission
        const canManage = await assignmentService.canManageSubjectAssignments(req.user!.userId, data.subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to create assignments for this subject' });
            return;
        }

        const assignment = await assignmentService.createAssignment(data, req.user!.userId);
        res.status(201).json(assignment);
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

// PUT /api/assignments/:id - Update assignment
router.put('/:id', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const data = updateAssignmentSchema.parse(req.body);

        // Get assignment to check subject
        const existing = await assignmentService.getAssignmentById(id);
        if (!existing) {
            res.status(404).json({ error: 'Assignment not found' });
            return;
        }

        // Check permission
        const canManage = await assignmentService.canManageSubjectAssignments(req.user!.userId, existing.subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to modify this assignment' });
            return;
        }

        const assignment = await assignmentService.updateAssignment(id, data, req.user!.userId);
        res.json(assignment);
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

// DELETE /api/assignments/:id - Delete assignment
router.delete('/:id', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');

        // Get assignment to check subject
        const existing = await assignmentService.getAssignmentById(id);
        if (!existing) {
            res.status(404).json({ error: 'Assignment not found' });
            return;
        }

        // Check permission
        const canManage = await assignmentService.canManageSubjectAssignments(req.user!.userId, existing.subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to delete this assignment' });
            return;
        }

        await assignmentService.deleteAssignment(id, req.user!.userId);
        res.status(204).send();
    } catch (error) {
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
            return;
        }
        next(error);
    }
});

// POST /api/assignments/:id/submit - Submit assignment (Students only)
router.post('/:id/submit', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        if (user.role !== 'STUDENT') {
            res.status(403).json({ error: 'Only students can submit assignments' });
            return;
        }

        const assignmentId = parseIntParam(req.params.id, 'id');
        const data = submitAssignmentSchema.parse(req.body);

        // Get student profile
        const studentProfile = await assignmentService.getStudentProfileByUserId(user.userId);
        if (!studentProfile) {
            res.status(404).json({ error: 'Student profile not found' });
            return;
        }

        const submission = await assignmentService.submitAssignment(
            assignmentId,
            studentProfile.id,
            data,
            user.userId
        );

        // Include late flag in response
        res.status(201).json({
            ...submission,
            warning: submission.isLate ? 'This submission was marked as late' : undefined,
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

// GET /api/assignments/:id/submissions - Get all submissions for an assignment
router.get('/:id/submissions', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const assignmentId = parseIntParam(req.params.id, 'id');

        // Get assignment to check subject
        const assignment = await assignmentService.getAssignmentById(assignmentId);
        if (!assignment) {
            res.status(404).json({ error: 'Assignment not found' });
            return;
        }

        // Check permission
        const canManage = await assignmentService.canManageSubjectAssignments(req.user!.userId, assignment.subjectId, req.user!.role);
        if (!canManage) {
            res.status(403).json({ error: 'You do not have permission to view submissions for this assignment' });
            return;
        }

        const submissions = await assignmentService.getSubmissionsByAssignment(assignmentId);
        res.json(submissions);
    } catch (error) {
        next(error);
    }
});

// POST /api/assignments/submissions/:submissionId/grade - Grade a submission
router.post('/submissions/:submissionId/grade', authenticate, teacherOrAbove, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const submissionId = parseIntParam(req.params.submissionId, 'submissionId');
        const data = gradeSubmissionSchema.parse(req.body);

        const submission = await assignmentService.gradeSubmission(
            submissionId,
            data.score,
            data.feedback,
            req.user!.userId
        );
        res.json(submission);
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

// GET /api/assignments/my-submissions - Get current student's submissions
router.get('/my/submissions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        if (user.role !== 'STUDENT') {
            res.status(400).json({ error: 'Only students can view their submissions' });
            return;
        }

        const studentProfile = await assignmentService.getStudentProfileByUserId(user.userId);
        if (!studentProfile) {
            res.status(404).json({ error: 'Student profile not found' });
            return;
        }

        const submissions = await assignmentService.getStudentSubmissions(studentProfile.id);
        res.json(submissions);
    } catch (error) {
        next(error);
    }
});

export default router;
