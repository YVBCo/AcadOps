import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { UserRole, Prisma } from '@prisma/client';
import { userService } from '../../services/index.js';
import { authenticate, adminOnly, superAdminOnly, admissionsStaff, requireRole, invalidateCache } from '../middleware/index.js';
import { parseIntParam, parseOptionalInt } from '../../utils/param-utils.js';
import { bulkOperationLimiter } from '../middleware/rate-limiters.js';

const router = Router();

/**
 * Extract a user-friendly error message from any thrown error during user creation.
 * Handles Prisma unique constraint violations, plain Errors, and unknown errors.
 */
function getCreationErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
            const target = (error.meta?.target as string[]) || [];
            if (target.includes('email') || target.includes('tenantId_email')) {
                return 'Email already registered in this institution';
            }
            if (target.includes('roll_number') || target.includes('rollNumber')) {
                return 'A student with this roll number already exists';
            }
            return `A record with this ${target[0] || 'value'} already exists`;
        }
        if (error.code === 'P2025') {
            return 'Referenced record not found';
        }
        return error.message;
    }
    if (error instanceof Error) {
        return error.message || fallback;
    }
    return fallback;
}


// Validation schemas
const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    role: z.nativeEnum(UserRole),
    departmentId: z.number().optional(),
    isActive: z.boolean().optional(),
    // Student-specific fields (required when role is STUDENT)
    rollNumber: z.string().min(1).optional(),
    admissionYear: z.number().int().min(2000).max(2100).optional(),
    currentSemester: z.number().int().min(1).max(8).optional(),
});

const updateUserSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().min(2).optional(),
    role: z.nativeEnum(UserRole).optional(),
    departmentId: z.number().optional(),
    isActive: z.boolean().optional(),
});

// GET /api/users - Get all users (Admin only)
router.get('/', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { skip, take, role, departmentId } = req.query;

        let deptFilter = departmentId ? parseIntParam(departmentId as string, 'departmentId') : undefined;
        if (req.user?.role === 'DEPARTMENT_ADMIN' && req.user.departmentId) {
            deptFilter = req.user.departmentId;
        }

        const result = await userService.getAll({
            skip: skip ? parseIntParam(skip as string, 'skip') : undefined,
            take: Math.min(take ? parseIntParam(take as string, 'take') : 50, 200),
            role: role as UserRole | undefined,
            departmentId: deptFilter,
            tenantId: req.user!.tenantId,
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/users/students - Get students for section assignment
// NOTE: This route must be BEFORE /:id routes to prevent Express from matching 'students' as an ID
router.get('/students', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { programId, sectionId, batchId, unassignedOnly, skip, take } = req.query;

        let deptFilter = req.user?.departmentId;
        if (req.user?.role === 'SUPER_ADMIN') {
            deptFilter = req.query.departmentId ? parseIntParam(req.query.departmentId as string, 'departmentId') : undefined;
        }

        const result = await userService.getStudentsForSectionAssignment({
            departmentId: deptFilter,
            programId: programId ? parseIntParam(programId as string, 'programId') : undefined,
            sectionId: sectionId ? parseIntParam(sectionId as string, 'sectionId') : undefined,
            batchId: batchId ? parseIntParam(batchId as string, 'batchId') : undefined,
            unassignedOnly: unassignedOnly === 'true',
            skip: skip ? parseIntParam(skip as string, 'skip') : undefined,
            take: take ? parseIntParam(take as string, 'take') : 100,
            tenantId: req.user!.tenantId,
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/users/:id - Get user by ID (All admin and staff roles)
router.get('/:id', authenticate, requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'ADMISSIONS_ADMIN', 'ADMIN_CLERK', 'COE', 'CLERK'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const user = await userService.getById(id);

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Tenant isolation: ensure user belongs to same tenant
        if (user.tenantId !== req.user!.tenantId) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        if (req.user?.role === 'DEPARTMENT_ADMIN' && user.departmentId !== req.user.departmentId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const { passwordHash: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        next(error);
    }
});

// POST /api/users - Create user (Admin only)
router.post('/', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createUserSchema.parse(req.body);

        if (req.user?.role === 'DEPARTMENT_ADMIN') {
            if (!data.departmentId || data.departmentId !== req.user.departmentId) {
                res.status(403).json({ error: 'Can only create users in your department' });
                return;
            }
            if (data.role === 'SUPER_ADMIN' || data.role === 'DEPARTMENT_ADMIN') {
                res.status(403).json({ error: 'Cannot create admin users' });
                return;
            }
        }

        // Handle TEACHER / COE creation with email notification
        if (data.role === 'TEACHER' || data.role === 'COE') {
            const result = await userService.createWithEmailNotification(
                {
                    email: data.email,
                    name: data.name,
                    role: data.role,
                    departmentId: data.departmentId,
                    tenantId: req.user!.tenantId,
                },
                req.user!.userId
            );
            const { passwordHash: _, ...userWithoutPassword } = result.user;
            res.status(201).json({
                ...userWithoutPassword,
                message: `${data.role === 'COE' ? 'COE' : 'Teacher'} created. Welcome email with credentials sent to ${data.email}`,
            });
            return;
        }

        // Handle STUDENT creation — must also create a StudentProfile
        if (data.role === 'STUDENT') {
            if (!data.rollNumber || !data.admissionYear || !data.departmentId) {
                res.status(400).json({ error: 'Roll number, admission year, and department are required for student creation' });
                return;
            }

            const student = await userService.createStudentWithProfile({
                email: data.email,
                password: data.password,
                name: data.name,
                rollNumber: data.rollNumber,
                admissionYear: data.admissionYear,
                departmentId: data.departmentId,
                currentSemester: data.currentSemester,
                tenantId: req.user!.tenantId,
            });

            // Student creation changes the batch student counts shown in the
            // admin and semester dashboards. Drop those tenant-scoped cached
            // batch responses immediately after the successful write.
            await invalidateCache(`api:${req.user!.tenantId}:/api/batches*`);

            const { passwordHash: _, ...userWithoutPassword } = student;
            res.status(201).json(userWithoutPassword);
            return;
        }

        // Generic user creation for other roles
        const user = await userService.create({ ...data, tenantId: req.user!.tenantId }, req.user!.userId);
        const { passwordHash: _, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
    } catch (error: unknown) {
        if (error instanceof ZodError) return next(error);
        res.status(400).json({ error: getCreationErrorMessage(error, 'Failed to create user') });
    }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const data = updateUserSchema.parse(req.body);

        const existing = await userService.getById(id);
        if (!existing) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Tenant isolation: ensure user belongs to same tenant
        if (existing.tenantId !== req.user!.tenantId) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        if (req.user?.role === 'DEPARTMENT_ADMIN') {
            if (existing.departmentId !== req.user.departmentId) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
            if (data.role === 'SUPER_ADMIN' || data.role === 'DEPARTMENT_ADMIN') {
                res.status(403).json({ error: 'Cannot assign admin roles' });
                return;
            }
        }

        const user = await userService.update(id, data, req.user!.userId);
        const { passwordHash: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        next(error);
    }
});

// PUT /api/users/:id/activation - Toggle user activation status (Admin only)
router.put('/:id/activation', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            res.status(400).json({ error: 'isActive must be a boolean' });
            return;
        }

        // Tenant isolation: verify user belongs to same tenant
        const existing = await userService.getById(id);
        if (!existing || existing.tenantId !== req.user!.tenantId) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const user = await userService.toggleActivation(id, isActive, req.user!.userId);
        const { passwordHash: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        next(error);
    }
});

// POST /api/users/department-admin - Create Department Admin with email notification (Super Admin only)
const createDeptAdminSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2),
    departmentId: z.number(),
});

router.post('/department-admin', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createDeptAdminSchema.parse(req.body);

        const result = await userService.createWithEmailNotification(
            {
                email: data.email,
                name: data.name,
                role: 'DEPARTMENT_ADMIN',
                departmentId: data.departmentId,
                tenantId: req.user!.tenantId,
            },
            req.user!.userId
        );

        const { passwordHash: _, ...userWithoutPassword } = result.user;
        res.status(201).json({
            ...userWithoutPassword,
            message: `Welcome email with credentials sent to ${data.email}`,
        });
    } catch (error: unknown) {
        if (error instanceof ZodError) return next(error);
        res.status(400).json({ error: getCreationErrorMessage(error, 'Failed to create department admin') });
    }
});

// POST /api/users/admissions-admin - Create Admissions Admin with email notification (Super Admin only)
const createAdmissionsAdminSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2),
});

router.post('/admissions-admin', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createAdmissionsAdminSchema.parse(req.body);

        const result = await userService.createWithEmailNotification(
            {
                email: data.email,
                name: data.name,
                role: 'ADMISSIONS_ADMIN' as UserRole,
                tenantId: req.user!.tenantId,
            },
            req.user!.userId
        );

        const { passwordHash: _, ...userWithoutPassword } = result.user;
        res.status(201).json({
            ...userWithoutPassword,
            message: `Admissions Administrator created. Welcome email with credentials sent to ${data.email}`,
        });
    } catch (error: unknown) {
        if (error instanceof ZodError) return next(error);
        res.status(400).json({ error: getCreationErrorMessage(error, 'Failed to create admissions admin') });
    }
});

// POST /api/users/first-year-coordinator - Create First Year Coordinator with email notification (Super Admin only)
const createFirstYearCoordinatorSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2),
});

router.post('/first-year-coordinator', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createFirstYearCoordinatorSchema.parse(req.body);

        const result = await userService.createWithEmailNotification(
            {
                email: data.email,
                name: data.name,
                role: 'FIRST_YEAR_COORDINATOR' as UserRole,
                tenantId: req.user!.tenantId,
            },
            req.user!.userId
        );

        const { passwordHash: _, ...userWithoutPassword } = result.user;
        res.status(201).json({
            ...userWithoutPassword,
            message: `First Year Coordinator created. Welcome email with credentials sent to ${data.email}`,
        });
    } catch (error: unknown) {
        if (error instanceof ZodError) return next(error);
        res.status(400).json({ error: getCreationErrorMessage(error, 'Failed to create first year coordinator') });
    }
});

// POST /api/users/librarian - Create a Librarian with emailed credentials (Super Admin only)
router.post('/librarian', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = z.object({ email: z.string().email(), name: z.string().min(2) }).parse(req.body);
        const result = await userService.createWithEmailNotification(
            { ...data, role: 'LIBRARIAN', tenantId: req.user!.tenantId },
            req.user!.userId
        );
        const { passwordHash: _, ...userWithoutPassword } = result.user;
        res.status(201).json({
            ...userWithoutPassword,
            message: `Librarian created. Welcome email with credentials sent to ${data.email}`,
        });
    } catch (error: unknown) {
        if (error instanceof ZodError) return next(error);
        res.status(400).json({ error: getCreationErrorMessage(error, 'Failed to create librarian') });
    }
});

// DELETE /api/users/:id - Delete user (Super Admin only)
router.delete('/:id', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');

        // Tenant isolation: verify user belongs to same tenant
        const existing = await userService.getById(id);
        if (!existing || existing.tenantId !== req.user!.tenantId) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        await userService.delete(id, req.user!.userId);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// Validation schema for bulk student creation
const bulkCreateStudentsSchema = z.object({
    rollNumberPrefix: z.string().min(2).max(20),
    startNumber: z.number().int().min(1),
    endNumber: z.number().int().min(1),
    programId: z.number().int().positive().optional(),  // Optional - resolved from department
    admissionYear: z.number().int().min(2000).max(2100),  // Required - also used as batch year
    departmentId: z.number().int().positive(),
    emailDomain: z.string().optional(),
    currentSemester: z.number().int().min(1).max(8),
    cycle: z.enum(['PHYSICS', 'CHEMISTRY']).optional(),
}).refine(data => data.endNumber >= data.startNumber, {
    message: 'End number must be greater than or equal to start number',
});

// POST /api/users/bulk-students - Bulk create students (Admissions Admin only)
router.post('/bulk-students', authenticate, admissionsStaff, bulkOperationLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = bulkCreateStudentsSchema.parse(req.body);

        if (req.user?.role !== 'ADMISSIONS_ADMIN') {
            res.status(403).json({ error: 'Only Admissions Administrators can bulk create students' });
            return;
        }

        const batchSize = data.endNumber - data.startNumber + 1;
        if (batchSize > 500) {
            res.status(400).json({ error: 'Maximum 500 students can be created at once' });
            return;
        }

        const result = await userService.createBulkStudents({ ...data, tenantId: req.user!.tenantId }, req.user!.userId);

        if (result.created > 0) {
            await invalidateCache(`api:${req.user!.tenantId}:/api/batches*`);
        }

        res.status(201).json({
            message: `Successfully created ${result.created} students`,
            created: result.created,
            skipped: result.skipped,
            skippedCount: result.skipped.length,
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/users/student-counts/:batchId - Get student counts per department for a batch
router.get('/student-counts/:batchId', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const batchId = parseIntParam(req.params.batchId, 'batchId');
        const counts = await userService.getStudentCountsByBatch(batchId, req.user!.tenantId);
        res.json(counts);
    } catch (error) {
        next(error);
    }
});

// GET /api/users/:id/academic-history - Get student's complete academic history
router.get('/:id/academic-history', authenticate, adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = parseIntParam(req.params.id, 'id');

        // Tenant isolation: verify user belongs to same tenant
        const user = await userService.getById(userId);
        if (!user || user.tenantId !== req.user!.tenantId) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }

        const academicHistory = await userService.getStudentAcademicHistory(userId);
        if (!academicHistory) {
            res.status(404).json({ error: 'Student not found' });
            return;
        }

        res.json(academicHistory);
    } catch (error) {
        next(error);
    }
});

export default router;
