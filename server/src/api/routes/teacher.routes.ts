import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { authenticate, requireRole, cacheResponse, CacheDurations } from '../middleware/index.js';
import { teacherService } from '../../services/teacher/index.js';
import { parseIntParam } from '../../utils/param-utils.js';
import { bulkOperationLimiter } from '../middleware/rate-limiters.js';
import { prisma } from '../../data-access/prisma.js';
import { timetableGeneratorService } from '../../services/timetable-generator.service.js';

// ─── Zod Schemas ──────────────────────────────────────────────
const recordMarksSchema = z.object({
    studentUsn: z.string().min(1),
    courseId: z.number().int().positive(),
    batchId: z.number().int().positive(),
    sectionId: z.number().int().positive(),
    semesterNumber: z.number().int().min(1).max(8),
    internal1: z.number().min(0).max(30).nullable().optional(),
    internal2: z.number().min(0).max(30).nullable().optional(),
    internal3: z.number().min(0).max(30).nullable().optional(),
    assignmentMarks: z.number().min(0).max(20).nullable().optional(),
});

const bulkRecordMarksSchema = z.object({
    entries: z.array(z.object({
        studentUsn: z.string().min(1),
        courseId: z.number().int().positive(),
        batchId: z.number().int().positive(),
        sectionId: z.number().int().positive(),
        internal1: z.number().min(0).max(30).nullable().optional(),
        internal2: z.number().min(0).max(30).nullable().optional(),
        internal3: z.number().min(0).max(30).nullable().optional(),
        assignmentMarks: z.number().min(0).max(20).nullable().optional(),
    })).min(1).max(500), // Cap at 500 to prevent OOM/long transactions
    semesterNumber: z.number().int().min(1).max(8),
});

const submitMarksSchema = z.object({
    sectionId: z.number().int().positive(),
    courseId: z.number().int().positive(),
});

const markAttendanceSchema = z.object({
    sectionId: z.number().int().positive(),
    courseId: z.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
    entries: z.array(z.object({
        studentUsn: z.string().min(1),
        studentProfileId: z.number().int().positive().optional(),
        status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
        remarks: z.string().optional(),
    })).min(1).max(500), // Cap at 500 to prevent OOM/long transactions
});

const submitAttendanceSchema = z.object({
    sectionId: z.number().int().positive(),
    courseId: z.number().int().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
});

const marksEditRequestSchema = z.object({
    marksId: z.number().int().positive(),
    newValues: z.object({
        internal1: z.number().min(0).max(30).nullable().optional(),
        internal2: z.number().min(0).max(30).nullable().optional(),
        internal3: z.number().min(0).max(30).nullable().optional(),
        assignmentMarks: z.number().min(0).max(20).nullable().optional(),
    }),
    reason: z.string().min(1),
});

const attendanceEditRequestSchema = z.object({
    attendanceId: z.number().int().positive(),
    newStatus: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
    reason: z.string().min(1),
});

const approveMarksSchema = z.object({
    marksIds: z.array(z.number().int().positive()).min(1),
});

const rejectMarksSchema = z.object({
    reason: z.string().min(1),
});

const updateMentorMarksSchema = z.object({
    internal1: z.number().min(0).max(30).nullable().optional(),
    internal2: z.number().min(0).max(30).nullable().optional(),
    internal3: z.number().min(0).max(30).nullable().optional(),
    assignmentMarks: z.number().min(0).max(20).nullable().optional(),
});

// Schema for student mentee interactions (meeting aspects)
const studentInteractionSchema = z.object({
    interactionDate: z.string().min(1),
    personalAspects: z.string().optional(),
    academicAspects: z.string().optional(),
    careerAspects: z.string().optional(),
    otherAspects: z.string().optional(),
}).passthrough();

// Schema for parent interactions (call/meeting with purpose)
const interactionSchema = z.object({
    interactionDate: z.string().min(1),
    mode: z.enum(['CALL', 'MEETING']),
    purpose: z.enum(['ATTENDANCE', 'IA_MARKS', 'BEHAVIOR', 'OTHER']),
    summary: z.string().min(1),
    notes: z.string().optional(),
    type: z.string().optional(),
    topic: z.string().optional(),
}).passthrough();

const router = Router();

// All routes require authentication
router.use(authenticate);
// Allow TEACHER, SUPER_ADMIN, and DEPARTMENT_ADMIN (for testing/admin oversight)
router.use(requireRole('TEACHER', 'SUPER_ADMIN', 'DEPARTMENT_ADMIN'));


// ============================================
// COURSE ALLOCATIONS
// ============================================

// Get teacher's assigned course allocations
router.get('/allocations', cacheResponse({ ttl: CacheDurations.USER_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const allocations = await teacherService.getAssignedCourses(req.user!.userId);
        res.json(allocations);
    } catch (error) {
        next(error);
    }
});


// Get students for a specific allocation
router.get('/allocations/:id/students', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const allocationId = parseIntParam(req.params.id, 'id');
        const students = await teacherService.getStudentsForAllocation(req.user!.userId, allocationId);
        res.json(students);
    } catch (error) {
        next(error);
    }
});

// Get timetable for a section
router.get('/sections/:sectionId/timetable', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sectionId = parseIntParam(req.params.sectionId, 'sectionId');
        const timetable = await teacherService.getSectionTimetable(req.user!.userId, sectionId);
        res.json(timetable);
    } catch (error) {
        next(error);
    }
});

// Get teacher's own weekly timetable grid
router.get('/timetable/grid', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const profile = await prisma.teacherProfile.findUnique({ where: { userId: req.user!.userId } });
        if (!profile) return res.status(404).json({ error: 'Teacher profile not found' });
        
        const semester = await prisma.semester.findFirst({ where: { status: 'ACTIVE' } });
        if (!semester) return res.status(404).json({ error: 'No active semester found' });
        
        const grid = await timetableGeneratorService.getTeacherTimetable(profile.id, semester.id);
        res.json(grid);
    } catch (error) {
        next(error);
    }
});

// ============================================
// INTERNAL MARKS
// ============================================

// Get internal marks for a section/course
router.get('/internal-marks/:sectionId/:courseId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sectionId = parseIntParam(req.params.sectionId, 'sectionId');
        const courseId = parseIntParam(req.params.courseId, 'courseId');
        const marks = await teacherService.getInternalMarks(req.user!.userId, sectionId, courseId);
        res.json(marks);
    } catch (error) {
        next(error);
    }
});

// Record internal marks for a single student
router.post('/internal-marks', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = recordMarksSchema.parse(req.body);

        const marks = await teacherService.recordMarks(
            req.user!.userId,
            {
                studentUsn: data.studentUsn,
                courseId: data.courseId,
                batchId: data.batchId,
                sectionId: data.sectionId,
                internal1: data.internal1,
                internal2: data.internal2,
                internal3: data.internal3,
                assignmentMarks: data.assignmentMarks
            },
            data.semesterNumber
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
router.post('/internal-marks/bulk', bulkOperationLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = bulkRecordMarksSchema.parse(req.body);

        const result = await teacherService.bulkRecordMarks(
            req.user!.userId,
            data.entries,
            data.semesterNumber
        );

        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Submit/finalize internal marks (locks editing)
router.post('/internal-marks/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = submitMarksSchema.parse(req.body);

        const result = await teacherService.submitMarks(req.user!.userId, data.sectionId, data.courseId);
        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// ============================================
// ATTENDANCE
// ============================================

// Get students with attendance for a date
router.get('/attendance/:sectionId/:courseId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sectionId = parseIntParam(req.params.sectionId, 'sectionId');
        const courseId = parseIntParam(req.params.courseId, 'courseId');
        const date = req.query.date ? new Date(req.query.date as string) : new Date();

        const students = await teacherService.getStudentsForAttendance(req.user!.userId, sectionId, courseId, date, req.user!.tenantId);
        res.json(students);
    } catch (error) {
        next(error);
    }
});

// Get attendance records for a section/course
router.get('/attendance/:sectionId/:courseId/records', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sectionId = parseIntParam(req.params.sectionId, 'sectionId');
        const courseId = parseIntParam(req.params.courseId, 'courseId');
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

        const records = await teacherService.getAttendanceRecords(req.user!.userId, sectionId, courseId, startDate, endDate, req.user!.tenantId);
        res.json(records);
    } catch (error) {
        next(error);
    }
});

// Mark attendance
router.post('/attendance', bulkOperationLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = markAttendanceSchema.parse(req.body);

        const result = await teacherService.markAttendance(
            req.user!.userId,
            data.sectionId,
            data.courseId,
            new Date(data.date),
            data.entries,
            req.user!.tenantId
        );

        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Submit/lock attendance for a date
router.post('/attendance/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = submitAttendanceSchema.parse(req.body);

        const result = await teacherService.submitAttendance(
            req.user!.userId,
            data.sectionId,
            data.courseId,
            new Date(data.date),
            req.user!.tenantId
        );

        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// ============================================
// ATTENDANCE HISTORY
// ============================================

// Get attendance history for a section/course
router.get('/attendance/:sectionId/:courseId/history', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sectionId = parseIntParam(req.params.sectionId, 'sectionId');
        const courseId = parseIntParam(req.params.courseId, 'courseId');
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

        const history = await teacherService.getAttendanceHistory(sectionId, courseId, startDate, endDate);
        res.json(history);
    } catch (error) {
        next(error);
    }
});

// ============================================
// EDIT REQUESTS
// ============================================

// Create marks edit request (for locked marks)
router.post('/edit-requests/marks', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = marksEditRequestSchema.parse(req.body);

        const request = await teacherService.createMarksEditRequest(
            req.user!.userId,
            data.marksId,
            data.newValues,
            data.reason
        );

        res.status(201).json(request);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Create attendance edit request (for locked attendance)
router.post('/edit-requests/attendance', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = attendanceEditRequestSchema.parse(req.body);

        const request = await teacherService.createAttendanceEditRequest(
            req.user!.userId,
            data.attendanceId,
            data.newStatus,
            data.reason
        );

        res.status(201).json(request);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Get my edit requests
router.get('/edit-requests', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const requests = await teacherService.getMyEditRequests(req.user!.userId);
        res.json(requests);
    } catch (error) {
        next(error);
    }
});

// ============================================
// MENTOR DASHBOARD
// ============================================

import { mentorService } from '../../services/mentor/index.js';

// Check if current user is a mentor
router.get('/mentor/status', cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isMentor = await mentorService.isMentor(req.user!.userId);
        res.json({ isMentor });
    } catch (error) {
        next(error);
    }
});

// Get mentor profile with statistics
router.get('/mentor/profile', cacheResponse({ ttl: CacheDurations.USER_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const profile = await mentorService.getMentorProfile(req.user!.userId);
        res.json(profile);
    } catch (error) {
        next(error);
    }
});

// Get assigned students
router.get('/mentor/students', cacheResponse({ ttl: CacheDurations.USER_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const students = await mentorService.getAssignedStudents(req.user!.userId);
        res.json(students);
    } catch (error) {
        next(error);
    }
});

// Get student profile (mentor view)
router.get('/mentor/students/:usn', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usn = req.params.usn as string;
        const profile = await mentorService.getStudentProfile(req.user!.userId, usn);
        res.json(profile);
    } catch (error) {
        next(error);
    }
});

// Get student academic performance
router.get('/mentor/students/:usn/academic', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usn = req.params.usn as string;
        const performance = await mentorService.getStudentAcademicPerformance(req.user!.userId, usn);
        res.json(performance);
    } catch (error) {
        next(error);
    }
});

// Get student attendance
router.get('/mentor/students/:usn/attendance', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usn = req.params.usn as string;
        const attendance = await mentorService.getStudentAttendance(req.user!.userId, usn);
        res.json(attendance);
    } catch (error) {
        next(error);
    }
});

// ============================================
// MENTOR - INTERNAL MARKS APPROVAL
// ============================================

// Get pending marks approvals
router.get('/mentor/approvals', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const pendingMarks = await mentorService.getPendingApprovals(req.user!.userId);
        res.json(pendingMarks);
    } catch (error) {
        next(error);
    }
});

// Approve marks (bulk)
router.post('/mentor/approvals/approve', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = approveMarksSchema.parse(req.body);

        const result = await mentorService.approveMarks(req.user!.userId, data.marksIds);
        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Reject marks
router.post('/mentor/approvals/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const marksId = parseIntParam(req.params.id, 'id');
        const data = rejectMarksSchema.parse(req.body);

        const result = await mentorService.rejectMarks(req.user!.userId, marksId, data.reason);
        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Update marks as mentor (creates pending approval request)
router.put('/mentor/marks/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const marksId = parseIntParam(req.params.id, 'id');
        const data = updateMentorMarksSchema.parse(req.body);

        const result = await mentorService.updateMarksAsMentor(
            req.user!.userId,
            marksId,
            data
        );
        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// ============================================
// MENTOR - OBSERVATIONS (Digital Mentor Card)
// ============================================

// Record/update observation for a student
router.post('/mentor/students/:usn/observations', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usn = req.params.usn as string;
        const data = req.body;

        const result = await mentorService.recordObservation(req.user!.userId, usn, data);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// Get observations for a student
router.get('/mentor/students/:usn/observations', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usn = req.params.usn as string;

        const observations = await mentorService.getObservations(req.user!.userId, usn);
        res.json(observations);
    } catch (error) {
        next(error);
    }
});

// ============================================
// MENTOR - STUDENT INTERACTIONS
// ============================================

// Log student interaction/meeting
router.post('/mentor/students/:usn/interactions/student', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usn = req.params.usn as string;
        const data = studentInteractionSchema.parse(req.body);
        const payload = {
            ...data,
            interactionDate: new Date(data.interactionDate)
        };

        const result = await mentorService.logStudentInteraction(req.user!.userId, usn, payload);
        res.status(201).json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Log parent interaction
router.post('/mentor/students/:usn/interactions/parent', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usn = req.params.usn as string;
        const data = interactionSchema.parse(req.body);
        const payload = {
            ...data,
            interactionDate: new Date(data.interactionDate)
        };

        const result = await mentorService.logParentInteraction(req.user!.userId, usn, payload);
        res.status(201).json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Get all interactions for a student
router.get('/mentor/students/:usn/interactions', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usn = req.params.usn as string;

        const interactions = await mentorService.getInteractions(req.user!.userId, usn);
        res.json(interactions);
    } catch (error) {
        next(error);
    }
});

// MENTOR - CHANGE PARENT PASSWORD
router.put('/mentor/students/:usn/parent-password', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usn = req.params.usn as string;
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters' });
            return;
        }
        const result = await mentorService.changeParentPassword(req.user!.userId, usn, newPassword);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;

