/**
 * Subject Routes
 * ──────────────────────────────────────
 * CRUD for subjects, teacher/student assignment,
 * and student academic history.
 * All data logic delegated to SubjectService.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { subjectService } from '../../services/index.js';
import { authenticate, adminOnly, cacheResponse, invalidateCache, CacheDurations } from '../middleware/index.js';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

// ── Zod Schemas ──────────────────────────────────────────────
const createSubjectSchema = z.object({
    courseId: z.number(),
    semesterId: z.number(),
    section: z.string().min(1).max(10),
});

const updateSubjectSchema = z.object({
    section: z.string().min(1).max(10).optional(),
});

const assignTeacherSchema = z.object({
    teacherId: z.number(),
    isPrimary: z.boolean().default(false),
});

const enrollStudentSchema = z.object({
    studentId: z.number(),
});

// ── Routes ───────────────────────────────────────────────────

// GET /api/subjects - Get subjects by semester
router.get('/', authenticate, cacheResponse({ ttl: CacheDurations.SEMI_STATIC }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { semesterId, departmentId } = req.query;

        if (!semesterId) {
            res.status(400).json({ error: 'Semester ID is required' });
            return;
        }

        const semId = parseIntParam(semesterId as string, 'semesterId');
        let subjects;

        if (departmentId || req.user?.departmentId) {
            const deptId = departmentId ? parseIntParam(departmentId as string, 'departmentId') : req.user!.departmentId!;
            subjects = await subjectService.getByDepartmentAndSemester(deptId, semId);
        } else {
            subjects = await subjectService.getBySemester(semId);
        }

        res.json(subjects);
    } catch (error) {
        next(error);
    }
});

// GET /api/subjects/my-subjects - Get current user's assigned/enrolled subjects
router.get('/my-subjects', authenticate, cacheResponse({ ttl: CacheDurations.USER_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;

        if (user.role === 'TEACHER') {
            const profileId = await subjectService.getUserProfileId(user.userId, 'TEACHER');
            if (!profileId) {
                res.status(404).json({ error: 'Teacher profile not found' });
                return;
            }
            const subjects = await subjectService.getByTeacher(profileId);
            res.json(subjects);
        } else if (user.role === 'STUDENT') {
            const profileId = await subjectService.getUserProfileId(user.userId, 'STUDENT');
            if (!profileId) {
                res.status(404).json({ error: 'Student profile not found' });
                return;
            }
            const subjects = await subjectService.getByStudent(profileId);
            res.json(subjects);
        } else {
            res.status(400).json({ error: 'Only teachers and students have assigned subjects' });
        }
    } catch (error) {
        next(error);
    }
});

// GET /api/subjects/student/history - Student's complete academic history
router.get('/student/history', authenticate, cacheResponse({ ttl: CacheDurations.USER_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.user!.role !== 'STUDENT') {
            res.status(403).json({ error: 'Only students can view their academic history' });
            return;
        }
        const history = await subjectService.getStudentHistory(req.user!.userId);
        res.json(history);
    } catch (error) {
        next(error);
    }
});

// GET /api/subjects/:id - Get subject by ID
router.get('/:id', authenticate, cacheResponse({ ttl: CacheDurations.SEMI_STATIC }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');

        // Students and teachers must only be able to open subjects they are
        // enrolled in or assigned to. The dashboard hides other subjects, but
        // direct URL/API requests must enforce the same access boundary.
        if (req.user!.role === 'STUDENT' || req.user!.role === 'TEACHER') {
            const role = req.user!.role;
            const profileId = await subjectService.getUserProfileId(req.user!.userId, role);
            if (!profileId) {
                res.status(404).json({ error: `${role === 'STUDENT' ? 'Student' : 'Teacher'} profile not found` });
                return;
            }

            const accessibleSubjects = role === 'STUDENT'
                ? await subjectService.getByStudent(profileId)
                : await subjectService.getByTeacher(profileId);
            if (!accessibleSubjects.some(subject => subject.id === id)) {
                res.status(404).json({ error: 'Subject not found' });
                return;
            }
        }

        const subject = await subjectService.getById(id);
        if (!subject) {
            res.status(404).json({ error: 'Subject not found' });
            return;
        }

        if (req.user!.role === 'STUDENT') {
            // Enrollment lists contain classmates' personal details and are
            // only needed by staff. The student subject page needs course,
            // semester, and instructor data only.
            const subjectWithRelations = subject as typeof subject & {
                enrollments?: unknown;
                _count?: unknown;
            };
            const { enrollments: _enrollments, _count: _count, ...studentSubject } = subjectWithRelations;
            res.json(studentSubject);
            return;
        }

        res.json(subject);
    } catch (error) {
        next(error);
    }
});

// POST /api/subjects - Create subject (Admin only)
router.post('/', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createSubjectSchema.parse(req.body);
        const subject = await subjectService.create(data, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:*`);
        res.status(201).json(subject);
    } catch (error) {
        next(error);
    }
});

// PUT /api/subjects/:id - Update subject (Admin only)
router.put('/:id', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const data = updateSubjectSchema.parse(req.body);
        const subject = await subjectService.update(id, data, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:*`);
        res.json(subject);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/subjects/:id - Delete subject (Admin only)
router.delete('/:id', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        await subjectService.delete(id, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:*`);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// POST /api/subjects/:id/teachers - Assign teacher
router.post('/:id/teachers', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const data = assignTeacherSchema.parse(req.body);
        await subjectService.assignTeacher(id, data.teacherId, data.isPrimary, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:*`);
        res.status(201).json({ message: 'Teacher assigned successfully' });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/subjects/:id/teachers/:teacherId - Remove teacher
router.delete('/:id/teachers/:teacherId', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const teacherId = parseIntParam(req.params.teacherId, 'teacherId');
        await subjectService.removeTeacher(id, teacherId, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:*`);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// POST /api/subjects/:id/students - Enroll student
router.post('/:id/students', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const data = enrollStudentSchema.parse(req.body);
        await subjectService.enrollStudent(id, data.studentId, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:*`);
        res.status(201).json({ message: 'Student enrolled successfully' });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/subjects/:id/students/:studentId - Unenroll student
router.delete('/:id/students/:studentId', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const studentId = parseIntParam(req.params.studentId, 'studentId');
        await subjectService.unenrollStudent(id, studentId, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:*`);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// GET /api/subjects/:id/students - Get enrolled students
router.get('/:id/students', authenticate, cacheResponse({ ttl: CacheDurations.SEMI_STATIC }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const students = await subjectService.getEnrolledStudents(id);
        res.json(students);
    } catch (error) {
        next(error);
    }
});

// GET /api/subjects/:id/teachers - Get assigned teachers
router.get('/:id/teachers', authenticate, cacheResponse({ ttl: CacheDurations.SEMI_STATIC }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const teachers = await subjectService.getAssignedTeachers(id);
        res.json(teachers);
    } catch (error) {
        next(error);
    }
});

export default router;
