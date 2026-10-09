import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import firstYearCoordinatorService from '../../services/first-year-coordinator.service.js';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middleware/index.js';
import { parseIntParam, parseOptionalInt } from '../../utils/param-utils.js';

// ─── Zod Schemas ──────────────────────────────────────────────
const allocateCycleSchema = z.object({
    batchId: z.coerce.number().int().positive(),
    optedDepartmentId: z.coerce.number().int().positive(),
    semester1CycleId: z.coerce.number().int().positive(),
});

const router = Router();

/**
 * Middleware to ensure user is a First Year Coordinator
 */
const requireFirstYearCoordinator = (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== UserRole.FIRST_YEAR_COORDINATOR) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Only First Year Coordinators can access this resource',
        });
    }
    next();
};

// Apply authentication and role check middleware to all routes
router.use(authenticate);
router.use(requireFirstYearCoordinator);

/**
 * GET /api/first-year-coordinator/students
 * Get all first year students (semester 1-2)
 */
router.get('/students', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { batchId, semester, departmentId } = req.query;

        const filters = {
            ...(batchId && { batchId: parseIntParam(batchId as string, 'batchId') }),
            ...(semester && { semester: parseIntParam(semester as string, 'semester') }),
            ...(departmentId && { departmentId: parseIntParam(departmentId as string, 'departmentId') }),
        };

        const students = await firstYearCoordinatorService.getFirstYearStudents(filters, req.user!.tenantId);

        res.json({
            success: true,
            data: students,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/first-year-coordinator/batches
 * Get all active batches with first year students
 */
router.get('/batches', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const batches = await firstYearCoordinatorService.getActiveBatches(req.user!.tenantId);
        res.json({ success: true, data: batches });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/first-year-coordinator/departments
 * Get all departments
 */
router.get('/departments', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departments = await firstYearCoordinatorService.getAllDepartments(req.user!.tenantId);
        res.json({ success: true, data: departments });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/first-year-coordinator/cycle-departments
 * Get cycle departments (Physics and Chemistry)
 */
router.get('/cycle-departments', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const cycleDepartments = await firstYearCoordinatorService.getCycleDepartments(req.user!.tenantId);
        res.json({ success: true, data: cycleDepartments });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/first-year-coordinator/allocations/:batchId
 * Get all cycle allocations for a specific batch
 */
router.get('/allocations/:batchId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const batchId = parseIntParam(req.params.batchId, 'batchId');
        const allocations = await firstYearCoordinatorService.getBatchAllocations(batchId, req.user!.tenantId);
        res.json({ success: true, data: allocations });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/first-year-coordinator/summary
 * Get allocation summary for dashboard
 */
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const summary = await firstYearCoordinatorService.getAllocationSummary(req.user!.tenantId);
        res.json({ success: true, data: summary });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/first-year-coordinator/allocate-cycle
 * Allocate a department to a cycle for semester 1
 */
router.post('/allocate-cycle', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = allocateCycleSchema.parse(req.body);

        if (!req.user?.userId) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not authenticated',
            });
        }

        const result = await firstYearCoordinatorService.allocateCycle(
            data.batchId,
            data.optedDepartmentId,
            data.semester1CycleId,
            req.user.userId,
            req.user.tenantId
        );

        res.json({
            success: true,
            data: result,
            message: result.message,
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

export default router;
