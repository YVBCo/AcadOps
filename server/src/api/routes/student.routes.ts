import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { authenticate, requireRole, cacheResponse, CacheDurations } from '../middleware/index.js';
import { studentService } from '../../services/student.service.js';
import { parseOptionalInt } from '../../utils/param-utils.js';
import { prisma } from '../../data-access/prisma.js';
import { timetableGeneratorService } from '../../services/timetable-generator.service.js';

// ─── Zod Schemas ──────────────────────────────────────────────
const updateStudentProfileSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    mobileNumber: z.string().max(20).optional(),
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    bloodGroup: z.string().optional(),
    category: z.string().optional(),
    permanentAddress: z.string().optional(),
    localAddress: z.string().optional(),
    fatherDetails: z.unknown().optional(),
    motherDetails: z.unknown().optional(),
});

const router = Router();

// All routes require authentication and STUDENT role
router.use(authenticate);
router.use(requireRole('STUDENT'));

/**
 * GET /student/profile
 * Get student's academic profile
 */
router.get('/profile', cacheResponse({ ttl: CacheDurations.USER_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const profile = await studentService.getProfile(req.user!.userId, req.user!.tenantId);
        void studentService.logAccess(req.user!.userId, 'PROFILE');
        res.json(profile);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /student/courses
 * Get student's enrolled courses with teacher information
 */
router.get('/courses', cacheResponse({ ttl: CacheDurations.USER_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const courses = await studentService.getCourses(req.user!.userId);
        void studentService.logAccess(req.user!.userId, 'COURSES');
        res.json(courses);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /student/timetable
 * Get student's section timetable
 */
router.get('/timetable', cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const timetable = await studentService.getTimetable(req.user!.userId);
        void studentService.logAccess(req.user!.userId, 'TIMETABLE');
        res.json(timetable);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /student/timetable/grid
 * Get student's section timetable grid
 */
router.get('/timetable/grid', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const profile = await prisma.studentProfile.findUnique({ where: { userId: req.user!.userId } });
        if (!profile) return res.status(404).json({ error: 'Student profile not found' });
        if (!profile.sectionId) return res.status(400).json({ error: 'Student not assigned to a section' });
        
        const semester = await prisma.semester.findFirst({ where: { status: 'ACTIVE' } });
        if (!semester) return res.status(404).json({ error: 'No active semester found' });
        
        const grid = await timetableGeneratorService.getTimetableGrid(profile.sectionId, semester.id);
        res.json(grid);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /student/internal-marks
 * Get student's internal marks (only finalized marks visible)
 */
router.get('/internal-marks', cacheResponse({ ttl: CacheDurations.DYNAMIC }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const marks = await studentService.getInternalMarks(req.user!.userId);
        void studentService.logAccess(req.user!.userId, 'INTERNAL_MARKS');
        res.json(marks);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /student/attendance
 * Get student's attendance (date-wise and course-wise)
 * Query params: courseId (optional)
 */
router.get('/attendance', cacheResponse({ ttl: CacheDurations.DYNAMIC }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const courseId = parseOptionalInt(req.query.courseId as string, 'courseId');
        const attendance = await studentService.getAttendance(req.user!.userId, courseId);
        void studentService.logAccess(req.user!.userId, 'ATTENDANCE');
        res.json(attendance);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /student/results
 * Get student's published results
 */
router.get('/results', cacheResponse({ ttl: CacheDurations.DYNAMIC }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const results = await studentService.getResults(req.user!.userId);
        void studentService.logAccess(req.user!.userId, 'RESULTS');
        res.json(results);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /student/history
 * Get student's complete academic history (4-year view)
 */
router.get('/history', cacheResponse({ ttl: CacheDurations.USER_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const history = await studentService.getAcademicHistory(req.user!.userId);
        void studentService.logAccess(req.user!.userId, 'HISTORY');
        res.json(history);
    } catch (error) {
        next(error);
    }
});

const editRequestSchema = z.object({
    proposedChanges: z.record(z.string(), z.unknown()),
    reason: z.string().min(1, 'Reason is required').max(500),
});

/**
 * POST /student/profile/edit-request
 * Submit an edit request for student profile
 */
router.post('/profile/edit-request', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = editRequestSchema.parse(req.body);
        const result = await studentService.submitEditRequest(req.user!.userId, data.proposedChanges, data.reason);
        res.status(201).json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

/**
 * GET /student/profile/edit-requests
 * Get student's edit requests
 */
router.get('/profile/edit-requests', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await studentService.getMyEditRequests(req.user!.userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
