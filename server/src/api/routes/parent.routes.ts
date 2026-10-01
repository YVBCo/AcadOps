import { Router, Request, Response, NextFunction } from 'express';
import { parentService } from '../../services/parent.service.js';
import { authenticate, requireRole } from '../middleware/auth.middleware.js';

const router = Router();

// All parent routes require auth + PARENT role
router.use(authenticate);
router.use(requireRole('PARENT'));

// GET /api/parent/dashboard
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = await parentService.getDashboard(req.user!.userId);
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// GET /api/parent/student — legacy (first linked student)
router.get('/student', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const student = await parentService.getLinkedStudent(req.user!.userId);
        res.json(student);
    } catch (error) {
        next(error);
    }
});

// GET /api/parent/student/marks — legacy (first linked student)
router.get('/student/marks', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const marks = await parentService.getStudentMarks(req.user!.userId);
        res.json(marks);
    } catch (error) {
        next(error);
    }
});

// ──────────────────────────────────────────────
// Parameterized routes (used by frontend)
// ──────────────────────────────────────────────

// GET /api/parent/student/:studentProfileId
router.get('/student/:studentProfileId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const studentProfileId = parseInt(req.params.studentProfileId as string, 10);
        if (isNaN(studentProfileId)) {
            return res.status(400).json({ error: 'Invalid student profile ID' });
        }
        const student = await parentService.getStudentProfile(req.user!.userId, studentProfileId);
        res.json(student);
    } catch (error) {
        next(error);
    }
});

// GET /api/parent/student/:studentProfileId/attendance
router.get('/student/:studentProfileId/attendance', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const studentProfileId = parseInt(req.params.studentProfileId as string, 10);
        if (isNaN(studentProfileId)) {
            return res.status(400).json({ error: 'Invalid student profile ID' });
        }
        const attendance = await parentService.getStudentAttendance(req.user!.userId, studentProfileId);
        res.json(attendance);
    } catch (error) {
        next(error);
    }
});

// GET /api/parent/student/:studentProfileId/marks
router.get('/student/:studentProfileId/marks', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const studentProfileId = parseInt(req.params.studentProfileId as string, 10);
        if (isNaN(studentProfileId)) {
            return res.status(400).json({ error: 'Invalid student profile ID' });
        }
        const marks = await parentService.getStudentMarksById(req.user!.userId, studentProfileId);
        res.json(marks);
    } catch (error) {
        next(error);
    }
});

export default router;
