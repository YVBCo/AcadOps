import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { departmentService } from '../../services/index.js';
import { authenticate, superAdminOnly, cacheResponse, invalidateCache, CacheDurations } from '../middleware/index.js';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

// Validation schemas
const createDepartmentSchema = z.object({
    name: z.string().min(2),
    code: z.string().min(2).max(10).toUpperCase(),
    description: z.string().optional(),
});

const updateDepartmentSchema = z.object({
    name: z.string().min(2).optional(),
    code: z.string().min(2).max(10).toUpperCase().optional(),
    description: z.string().optional(),
});

// GET /api/departments - Get all departments (tenant-scoped)
router.get('/', authenticate, cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departments = await departmentService.getAllByTenant(req.user!.tenantId);
        res.json(departments);
    } catch (error) {
        next(error);
    }
});

// GET /api/departments/cycle - Get cycle departments only (PHY, CHEM)
router.get('/cycle', authenticate, cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const cycleDepts = await departmentService.getCycleDepartments(req.user!.tenantId);
        res.json(cycleDepts);
    } catch (error) {
        next(error);
    }
});

// GET /api/departments/opted - Get non-cycle departments (CS, EC, etc.) for opted selection
router.get('/opted', authenticate, cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const optedDepts = await departmentService.getOptedDepartments(req.user!.tenantId);
        res.json(optedDepts);
    } catch (error) {
        next(error);
    }
});

// GET /api/departments/:id - Get department by ID
router.get('/:id', authenticate, cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const department = await departmentService.getById(id);

        if (!department) {
            res.status(404).json({ error: 'Department not found' });
            return;
        }

        res.json(department);
    } catch (error) {
        next(error);
    }
});

// POST /api/departments - Create department (Super Admin only)
router.post('/', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createDepartmentSchema.parse(req.body);
        const department = await departmentService.create({ ...data, tenantId: req.user!.tenantId }, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:/api/departments*`);
        res.status(201).json(department);
    } catch (error) {
        next(error);
    }
});

// Validation schema for creating department with admin
const createDepartmentWithAdminSchema = z.object({
    department: z.object({
        name: z.string().min(2),
        code: z.string().min(2).max(10).toUpperCase(),
        description: z.string().optional(),
    }),
    admin: z.object({
        name: z.string().min(2),
        email: z.string().email(),
    }),
});

// POST /api/departments/with-admin - Create department with admin (Super Admin only)
router.post('/with-admin', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createDepartmentWithAdminSchema.parse(req.body);
        const result = await departmentService.createWithAdmin(
            { ...data.department, tenantId: req.user!.tenantId },
            data.admin,
            req.user!.userId,
            req.user!.tenantId
        );

        res.status(201).json({
            department: result.department,
            admin: {
                email: result.admin.email,
                password: result.admin.password,
                message: 'Admin credentials have been sent to the provided email. The password is shown here only once.',
            },
        });
        await invalidateCache(`api:${req.user!.tenantId}:/api/departments*`);
    } catch (error) {
        next(error);
    }
});

// PUT /api/departments/:id - Update department (Super Admin only)
router.put('/:id', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const data = updateDepartmentSchema.parse(req.body);
        const department = await departmentService.update(id, data, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:/api/departments*`);
        res.json(department);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/departments/:id - Delete department (Super Admin only)
router.delete('/:id', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        await departmentService.delete(id, req.user!.userId);
        await invalidateCache(`api:${req.user!.tenantId}:/api/departments*`);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

export default router;
