/**
 * Dept Admin — Route Aggregator
 * ──────────────────────────────────────
 * Composes all dept-admin sub-routers into a single router.
 * All routes require DEPARTMENT_ADMIN role.
 *
 * Sub-routers:
 *   - sections:   students, section CRUD, student assignment
 *   - courses:    course listing, allocations, teachers
 *   - marks:      IA config, internal marks entry/editing
 *   - attendance: attendance records, semester marks
 *   - timetable:  time slots, timetable management
 *   - admin:      audit logs, edit requests, mentor assignments
 */
import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

import sectionsRouter from './sections.routes.js';
import coursesRouter from './courses.routes.js';
import marksRouter from './marks.routes.js';
import attendanceRouter from './attendance.routes.js';
import timetableRouter from './timetable.routes.js';
import adminRouter from './admin.routes.js';
import timetableGeneratorRouter from './timetable-generator.routes.js';
import substitutionRouter from './substitution.routes.js';
import calendarRouter from './calendar.routes.js';
import classroomRouter from './classroom.routes.js';

const router = Router();

// All routes require authentication and DEPARTMENT_ADMIN role
router.use(authenticate);
router.use(requireRole('DEPARTMENT_ADMIN'));

// Mount sub-routers (no prefix — routes defined within each sub-router)
router.use(sectionsRouter);
router.use(coursesRouter);
router.use(marksRouter);
router.use(attendanceRouter);
router.use(timetableRouter);
router.use(adminRouter);
router.use(timetableGeneratorRouter);
router.use(substitutionRouter);
router.use(calendarRouter);
router.use(classroomRouter);

export default router;
