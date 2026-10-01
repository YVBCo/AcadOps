import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { batchService } from '../../services/batch.service.js';
import { semesterProgressionService } from '../../services/semester-progression.service.js';
import { authenticate, superAdminOnly, superOrAdmissionsAdmin, cacheResponse, invalidateCache, CacheDurations } from '../middleware/index.js';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

// Validation schemas
const createBatchSchema = z.object({
    name: z.string().min(4).max(4), // e.g., "2024"
    startYear: z.coerce.number().int().min(2000).max(2100)
        .refine((v) => !isNaN(v), { message: 'Start year must be a valid number' }),
});

const updateBatchSchema = z.object({
    name: z.string().min(4).max(4).optional(),
    startYear: z.coerce.number().int().min(2000).max(2100)
        .refine((v) => !isNaN(v), { message: 'Start year must be a valid number' })
        .optional(),
});

const assignDepartmentSchema = z.object({
    departmentId: z.number().int().positive(),
});

// GET /api/batches - Get all batches
router.get('/', authenticate, cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const batches = await batchService.getAll(req.user!.tenantId);
        res.json(batches);
    } catch (error) {
        next(error);
    }
});

// GET /api/batches/:id - Get batch by ID
router.get('/:id', authenticate, cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const batch = await batchService.getById(id);

        if (!batch) {
            res.status(404).json({ error: 'Batch not found' });
            return;
        }

        res.json(batch);
    } catch (error) {
        next(error);
    }
});

// GET /api/batches/:id/students - Get students in a batch
router.get('/:id/students', authenticate, cacheResponse({ ttl: CacheDurations.SEMI_STATIC }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const students = await batchService.getStudents(id);
        res.json(students);
    } catch (error) {
        next(error);
    }
});

// POST /api/batches - Create batch (Super Admin or Admissions Admin)
router.post('/', authenticate, superOrAdmissionsAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createBatchSchema.parse(req.body);
        const batch = await batchService.create(
            { ...data, tenantId: req.user!.tenantId },
            req.user!.userId
        );
        await invalidateCache(`api:${req.user!.tenantId}:/api/batches*`);
        res.status(201).json(batch);
    } catch (error) {
        next(error);
    }
});

// POST /api/batches/:id/assign-department - Assign batch to department (Super Admin or Admissions Admin)
router.post('/:id/assign-department', authenticate, superOrAdmissionsAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const { departmentId } = assignDepartmentSchema.parse(req.body);
        const count = await batchService.assignToDepartment(id, departmentId, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:/api/batches*`);
        res.json({
            message: `Successfully assigned ${count} students to department`,
            studentsUpdated: count
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/batches/:id/assign-cycle - Assign batch to First Year Cycle (Super Admin only)
const assignCycleSchema = z.object({
    cycle: z.enum(['PHYSICS', 'CHEMISTRY']),
});

router.post('/:id/assign-cycle', authenticate, superOrAdmissionsAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const { cycle } = assignCycleSchema.parse(req.body);
        const count = await batchService.assignToCycle(id, cycle, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:/api/batches*`);
        res.json({
            message: `Successfully assigned ${count} students to ${cycle} cycle`,
            studentsUpdated: count
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/batches/:id/progress-semester - Progress batch to next semester (Super Admin only)
router.post('/:id/progress-semester', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const result = await semesterProgressionService.endSemester(id, req.user!.userId);

        let message = `Batch progressed from semester ${result.previousSemester} to ${result.newSemester}. ${result.studentsProgressed} students updated.`;

        if (result.swapInfo) {
            message += ` PHY→CHEM: ${result.swapInfo.phyToChem}, CHEM→PHY: ${result.swapInfo.chemToPhy}.`;
        }

        await invalidateCache(`api:${req.user!.tenantId}:/api/batches*`);
        res.json({
            ...result,
            message,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/batches/:id/migrate-to-branches - Migrate students to branches (Super Admin only)
router.post('/:id/migrate-to-branches', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const result = await batchService.migrateStudentsToBranches(id, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:/api/batches*`);
        res.json({
            message: `Migration complete: ${result.migrated} students migrated`,
            migrated: result.migrated,
            failed: result.failed,
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/batches/:id - Update batch (Super Admin or Admissions Admin)
router.put('/:id', authenticate, superOrAdmissionsAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const data = updateBatchSchema.parse(req.body);
        const batch = await batchService.update(id, data, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:/api/batches*`);
        res.json(batch);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/batches/:id - Delete batch (Super Admin only)
router.delete('/:id', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        await batchService.delete(id, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:/api/batches*`);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
