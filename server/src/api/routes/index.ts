import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { enforceTenant } from '../middleware/tenant.middleware.js';
import { checkModuleAccess } from '../middleware/module-access.middleware.js';
import authRoutes from './auth.routes.js';
import departmentRoutes from './department.routes.js';
import semesterRoutes from './semester.routes.js';
import userRoutes from './user.routes.js';
import courseRoutes from './course.routes.js';
import subjectRoutes from './subject.routes.js';
import programRoutes from './program.routes.js';
import attendanceRoutes from './attendance.routes.js';
import assignmentRoutes from './assignment.routes.js';
import marksRoutes from './marks.routes.js';
import auditLogsRoutes from './audit-logs.routes.js';
import { editRequestRoutes } from './edit-request.routes.js';
import sectionRoutes from './section.routes.js';
import batchRoutes from './batch.routes.js';
import clerkRoutes from './clerk.routes.js';
import clerkMarksRoutes from './clerk-marks.routes.js';
import deptAdminRoutes from './dept-admin/index.js';
import teacherRoutes from './teacher.routes.js';
import studentRoutes from './student.routes.js';
import admissionsRoutes from './admissions.routes.js';
import usnRequestRoutes from './usn-request.routes.js';
import coeRoutes from './coe.routes.js';
import semesterMarksRoutes from './semester-marks.routes.js';
import firstYearCoordinatorRoutes from './first-year-coordinator.routes.js';
import resultsRoutes from './results.routes.js';
import revaluationsRoutes from './revaluations.routes.js';
import developerRoutes from './developer.routes.js';
import parentRoutes from './parent.routes.js';
import chatRoutes from './chat.routes.js';
import nodueRoutes from './nodue/index.js';
import placementRoutes from './placement/index.js';

const router = Router();

// ─── Public / self-authenticating routes (no global tenant enforcement) ───
router.use('/dev', developerRoutes);
router.use('/auth', authRoutes);
router.use('/admissions', admissionsRoutes); // Has public endpoints (apply form)

// ─── Tenant-enforced routes ──────────────────────────────────────────────
// All routes below require active tenant validation after authentication.
// enforceTenant verifies the user's tenant is still active (cached).
const tenantRouter = Router();
tenantRouter.use(authenticate);    // Must run first to populate req.user
tenantRouter.use(enforceTenant);

tenantRouter.use('/departments', departmentRoutes);
tenantRouter.use('/semesters', semesterRoutes);
tenantRouter.use('/users', userRoutes);
tenantRouter.use('/courses', courseRoutes);
tenantRouter.use('/subjects', subjectRoutes);
tenantRouter.use('/programs', programRoutes);
tenantRouter.use('/attendance', checkModuleAccess('erp.attendance'), attendanceRoutes);
tenantRouter.use('/assignments', checkModuleAccess('erp.internal_assessment'), assignmentRoutes);
tenantRouter.use('/marks', checkModuleAccess('erp.internal_assessment'), marksRoutes);
tenantRouter.use('/audit-logs', auditLogsRoutes);
tenantRouter.use('/edit-requests', editRequestRoutes);
tenantRouter.use('/sections', sectionRoutes);
tenantRouter.use('/batches', batchRoutes);
tenantRouter.use('/clerks', checkModuleAccess('erp.examinations'), clerkRoutes);
tenantRouter.use('/clerk-marks', checkModuleAccess('erp.examinations'), clerkMarksRoutes);
tenantRouter.use('/dept-admin', deptAdminRoutes);
tenantRouter.use('/teacher', teacherRoutes);
tenantRouter.use('/student', studentRoutes);
tenantRouter.use('/usn-requests', usnRequestRoutes);
tenantRouter.use('/coe', checkModuleAccess('erp.examinations'), coeRoutes);
tenantRouter.use('/semester-marks', checkModuleAccess('erp.examinations'), semesterMarksRoutes);
tenantRouter.use('/first-year-coordinator', checkModuleAccess('erp.first_year_coordinator'), firstYearCoordinatorRoutes);
tenantRouter.use('/results', checkModuleAccess('erp.examinations'), resultsRoutes);
tenantRouter.use('/revaluations', checkModuleAccess('erp.examinations'), revaluationsRoutes);
tenantRouter.use('/parent', checkModuleAccess('erp.parent_portal'), parentRoutes);
tenantRouter.use('/chat', checkModuleAccess('erp.parent_portal'), chatRoutes);
tenantRouter.use('/nodue', checkModuleAccess('nodue'), nodueRoutes);
tenantRouter.use('/placement', checkModuleAccess('placepro'), placementRoutes);


// Mount tenant-enforced routes (authenticate is applied per-route-file)
router.use(tenantRouter);

// Health check endpoint (with DB + Redis connectivity)
router.get('/health', async (req, res) => {
    const health: Record<string, unknown> = {
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    };

    // Check database
    try {
        const { checkDatabaseConnection } = await import('../../data-access/prisma.js');
        const isConnected = await checkDatabaseConnection();
        health.database = isConnected ? 'connected' : 'disconnected';
        if (!isConnected) health.status = 'degraded';
    } catch {
        health.database = 'disconnected';
        health.status = 'degraded';
    }

    // Check Redis
    try {
        const { default: cacheService } = await import('../../services/cache.service.js');
        health.redis = cacheService.isAvailable() ? 'connected' : 'unavailable';
    } catch {
        health.redis = 'error';
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
});

export default router;
