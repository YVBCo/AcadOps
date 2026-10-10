import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { AdmissionStatus } from '@prisma/client';
import { admissionsService, type CreateAdmissionInput } from '../../services/admissions/index.js';
import { formConfigService } from '../../services/form-config.service.js';
import { authenticate, admissionsAdminOnly, admissionsStaff, studentEditAllowed, editRequestors, cacheResponse, CacheDurations } from '../middleware/index.js';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

// ─── Rate Limiters for Public Endpoints ──────────────────────────

// Public application submission: 5 per hour per IP (strict)
const publicApplyLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many applications submitted. Please try again later.' },
});

// Public read endpoints (form config, departments): 30 per 15 minutes per IP
const publicReadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again later.' },
});

// Multer for logo upload (memory storage)
const logoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    },
});

// ============================================
// Admission CRUD
// ============================================

const createAdmissionSchema = z.object({
    applicantName: z.string().min(2),
    applyingThrough: z.string().optional(),
    gender: z.string().optional(),
    bloodGroup: z.string().optional(),
    dateOfBirth: z.string().optional(),
    nationality: z.string().optional(),
    religion: z.string().optional(),
    category: z.string().optional(),
    subCaste: z.string().optional(),
    motherTongue: z.string().optional(),
    speciallyAbled: z.boolean().optional(),
    aadhaarNumber: z.string().optional(),
    emailId: z.union([z.string().email(), z.literal('')]).optional(),
    mobileNumber: z.string().optional(),
    hostel: z.boolean().optional(),
    pickupPlace: z.string().optional(),
    permanentAddress: z.object({
        address: z.string().max(500).optional(),
        state: z.string().max(100).optional(),
        pin: z.string().max(10).optional(),
    }).passthrough().optional(),
    localAddress: z.object({
        address: z.string().max(500).optional(),
        state: z.string().max(100).optional(),
        pin: z.string().max(10).optional(),
    }).passthrough().optional(),
    fatherDetails: z.object({
        name: z.string().max(200).optional(),
        email: z.string().max(200).optional(),
        mobile: z.string().max(20).optional(),
        occupation: z.string().max(200).optional(),
        annualIncome: z.union([z.string(), z.number()]).optional(),
    }).passthrough().optional(),
    motherDetails: z.object({
        name: z.string().max(200).optional(),
        email: z.string().max(200).optional(),
        mobile: z.string().max(20).optional(),
        occupation: z.string().max(200).optional(),
        annualIncome: z.union([z.string(), z.number()]).optional(),
    }).passthrough().optional(),
    branchSelection: z.string().optional(),
    cetRollNo: z.string().optional(),
    cetRank: z.string().optional(),
    cetAllottedCategory: z.string().optional(),
    comedkRollNo: z.string().optional(),
    comedkRank: z.string().optional(),
    sslcDetails: z.object({
        board: z.string().max(200).optional(),
        schoolName: z.string().max(300).optional(),
        registerNo: z.string().max(50).optional(),
        medium: z.string().max(50).optional(),
        marks: z.union([z.string(), z.number()]).optional(),
        maxMarks: z.union([z.string(), z.number()]).optional(),
        percentage: z.union([z.string(), z.number()]).optional(),
        yearOfPassing: z.union([z.string(), z.number()]).optional(),
    }).passthrough().optional(),
    pucDetails: z.object({
        board: z.string().max(200).optional(),
        collegeName: z.string().max(300).optional(),
        registerNo: z.string().max(50).optional(),
        medium: z.string().max(50).optional(),
        marks: z.union([z.string(), z.number()]).optional(),
        maxMarks: z.union([z.string(), z.number()]).optional(),
        percentage: z.union([z.string(), z.number()]).optional(),
        yearOfPassing: z.union([z.string(), z.number()]).optional(),
    }).passthrough().optional(),
    subjectWiseMarks: z.object({
        physics: z.union([z.string(), z.number()]).optional(),
        mathematics: z.union([z.string(), z.number()]).optional(),
        chemistry: z.union([z.string(), z.number()]).optional(),
        biologyOrOther: z.union([z.string(), z.number()]).optional(),
    }).passthrough().optional(),
    documents: z.array(z.object({
        type: z.string().max(100),
        url: z.string().max(1000),
    })).max(20).optional(),
    howDidYouKnow: z.string().optional(),
    applicantDeclaration: z.boolean().optional(),
    parentDeclaration: z.boolean().optional(),
    admissionYear: z.coerce.number({ message: "Admission Year is required" }).int().min(2000).max(2100),
    // Keep all fields generated by a tenant's configurable admission form.
    formData: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

// ============================================
// Form Config Management (Authenticated)
// ============================================

// GET /api/admissions/form-config - Get form config for current tenant
// Admissions clerks need the configured fields to enter an application. Keep
// updates and logo uploads restricted to admissions admins below.
router.get('/form-config', authenticate, admissionsStaff, cacheResponse({ ttl: CacheDurations.REFERENCE_DATA }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const config = await formConfigService.getConfig(req.user!.tenantId);
        res.json(config);
    } catch (error) {
        next(error);
    }
});

// PUT /api/admissions/form-config - Update form config
router.put('/form-config', authenticate, admissionsAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const config = await formConfigService.updateConfig(req.user!.tenantId, req.body);
        // Invalidate cached form-config so print page gets latest
        const { invalidateCache } = await import('../middleware/cache.middleware.js');
        await invalidateCache(`api:${req.user!.tenantId}:*form-config*`);
        res.json(config);
    } catch (error) {
        next(error);
    }
});

// POST /api/admissions/form-config/logo - Upload form watermark logo
router.post('/form-config/logo', authenticate, admissionsAdminOnly, logoUpload.single('logo'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No logo file provided' });
            return;
        }
        const result = await formConfigService.uploadLogo(req.user!.tenantId, req.file);
        // Invalidate cached form-config
        const { invalidateCache } = await import('../middleware/cache.middleware.js');
        await invalidateCache(`api:${req.user!.tenantId}:*form-config*`);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ============================================
// Public Endpoints (No Auth Required)
// ============================================

// GET /api/admissions/public/form-config/:slug - Get published form config by tenant slug
router.get('/public/form-config/:slug', publicReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const config = await formConfigService.getPublicConfig(req.params.slug as string);
        res.json(config);
    } catch (error) {
        next(error);
    }
});

// GET /api/admissions/public/departments/:slug - Public departments list for branch selection (tenant-scoped)
router.get('/public/departments/:slug', publicReadLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const depts = await formConfigService.getPublicDepartments(req.params.slug as string);
        res.json(depts);
    } catch (error) {
        next(error);
    }
});

// Strict validation schema for public applications — all key fields required
const publicApplySchema = z.object({
    applicantName: z.string().min(2, 'Applicant name is required (min 2 characters)'),
    applyingThrough: z.string().optional(),
    gender: z.string().optional(),
    bloodGroup: z.string().optional(),
    dateOfBirth: z.string().optional(),
    nationality: z.string().optional(),
    religion: z.string().optional(),
    category: z.string().optional(),
    subCaste: z.string().optional(),
    motherTongue: z.string().optional(),
    speciallyAbled: z.boolean().optional(),
    aadhaarNumber: z.string().optional(),
    emailId: z.string().optional(),
    mobileNumber: z.string().optional(),
    hostel: z.boolean().optional(),
    pickupPlace: z.string().optional(),
    permanentAddress: z.object({
        address: z.string().max(500).optional(),
        state: z.string().max(100).optional(),
        pin: z.string().max(10).optional(),
    }).passthrough().optional(),
    localAddress: z.object({
        address: z.string().max(500).optional(),
        state: z.string().max(100).optional(),
        pin: z.string().max(10).optional(),
    }).passthrough().optional(),
    fatherDetails: z.object({
        name: z.string().max(200).optional(),
        email: z.string().max(200).optional(),
        mobile: z.string().max(20).optional(),
        occupation: z.string().max(200).optional(),
        annualIncome: z.union([z.string(), z.number()]).optional(),
    }).passthrough().optional(),
    motherDetails: z.object({
        name: z.string().max(200).optional(),
        email: z.string().max(200).optional(),
        mobile: z.string().max(20).optional(),
        occupation: z.string().max(200).optional(),
        annualIncome: z.union([z.string(), z.number()]).optional(),
    }).passthrough().optional(),
    branchSelection: z.string().optional(),
    cetRollNo: z.string().optional(),
    cetRank: z.string().optional(),
    cetAllottedCategory: z.string().optional(),
    comedkRollNo: z.string().optional(),
    comedkRank: z.string().optional(),
    sslcDetails: z.object({
        board: z.string().max(200).optional(),
        schoolName: z.string().max(300).optional(),
        registerNo: z.string().max(50).optional(),
        medium: z.string().max(50).optional(),
        marks: z.union([z.string(), z.number()]).optional(),
        maxMarks: z.union([z.string(), z.number()]).optional(),
        percentage: z.union([z.string(), z.number()]).optional(),
        yearOfPassing: z.union([z.string(), z.number()]).optional(),
    }).passthrough().optional(),
    pucDetails: z.object({
        board: z.string().max(200).optional(),
        collegeName: z.string().max(300).optional(),
        registerNo: z.string().max(50).optional(),
        medium: z.string().max(50).optional(),
        marks: z.union([z.string(), z.number()]).optional(),
        maxMarks: z.union([z.string(), z.number()]).optional(),
        percentage: z.union([z.string(), z.number()]).optional(),
        yearOfPassing: z.union([z.string(), z.number()]).optional(),
    }).passthrough().optional(),
    subjectWiseMarks: z.object({
        physics: z.union([z.string(), z.number()]).optional(),
        mathematics: z.union([z.string(), z.number()]).optional(),
        chemistry: z.union([z.string(), z.number()]).optional(),
        biologyOrOther: z.union([z.string(), z.number()]).optional(),
    }).passthrough().optional(),
    documents: z.array(z.object({
        type: z.string().max(100),
        url: z.string().max(1000),
    })).max(20).optional(),
    howDidYouKnow: z.string().optional(),
    applicantDeclaration: z.boolean().optional(),
    parentDeclaration: z.boolean().optional(),
    admissionYear: z.number({ message: "Admission Year is required" }),
});

// POST /api/admissions/public/apply/:slug - Public application submission
router.post('/public/apply/:slug', publicApplyLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Validate form config is published
        let publicConfig;
        try {
            publicConfig = await formConfigService.getPublicConfig(req.params.slug as string);
        } catch {
            res.status(403).json({ error: 'Application form is not currently available.' });
            return;
        }
        if (!publicConfig) {
            res.status(403).json({ error: 'Application form is not currently available.' });
            return;
        }

        // Validate required fields from form config
        // Check both top-level body and nested formData (client sends values in both places)
        const formFields = publicConfig.formFields || [];
        const bodyFormData = req.body.formData || {};
        const missingFields: string[] = [];
        for (const field of formFields) {
            if (field.required) {
                const value = req.body[field.id] ?? bodyFormData[field.id];
                if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
                    missingFields.push(field.label);
                }
            }
        }
        if (missingFields.length > 0) {
            res.status(400).json({ error: `Missing required fields: ${missingFields.join(', ')}` });
            return;
        }

        // Ensure key fields are at top level (client may send them inside formData only)
        // This is critical: without promotion, fields like emailId end up only in the
        // JSON formData blob and never reach the dedicated DB column — causing
        // students to get @noreply.internal emails instead of their real ones.
        const fieldsToPromote = [
            'applicantName', 'emailId', 'mobileNumber', 'gender', 'bloodGroup',
            'nationality', 'religion', 'category', 'subCaste', 'motherTongue',
            'aadhaarNumber', 'branchSelection', 'applyingThrough', 'pickupPlace',
            'howDidYouKnow', 'cetRollNo', 'cetRank', 'comedkRollNo', 'comedkRank',
        ];
        for (const field of fieldsToPromote) {
            if (!req.body[field] && bodyFormData[field]) {
                req.body[field] = bodyFormData[field];
            }
        }
        if (!req.body.admissionYear) {
            req.body.admissionYear = new Date().getFullYear();
        }

        // Parse basic fields (should not fail now since we resolved from formData)
        let data;
        try {
            data = publicApplySchema.parse(req.body);
        } catch (zodErr) {
            const issues = zodErr instanceof Error && 'issues' in zodErr
                ? (zodErr as { issues: { message: string }[] }).issues.map(i => i.message).join(', ')
                : 'Invalid form data';
            res.status(400).json({ error: issues });
            return;
        }

        // Resolve tenant and system user via service
        const { tenant, systemUser } = await admissionsService.resolveTenantAndSystemUser(req.params.slug as string);
        if (!tenant) {
            res.status(404).json({ error: 'Institution not found or inactive' });
            return;
        }

        if (!systemUser) {
            res.status(500).json({ error: 'No admin user found for this institution. Please contact the office.' });
            return;
        }

        // Create admission entry via the service (merge full body with parsed data)
        const fullData = { ...req.body, ...data, formData: bodyFormData };
        const admission = await admissionsService.createAdmission(
            fullData as CreateAdmissionInput,
            systemUser.id,
            tenant.id,
        );

        // Public applications go to DRAFT — admin/clerk will review, add admission year, and submit
        res.status(201).json({
            message: 'Application received successfully! Your reference ID is ' + admission.admissionId + '. The admissions office will review your application.',
            admissionId: admission.admissionId,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/admissions/public/apply - Legacy route redirects
router.post('/public/apply', async (_req: Request, res: Response) => {
    res.status(400).json({ error: 'Please use /api/admissions/public/apply/:slug with your institution slug.' });
});

// REMOVED: Legacy /public/departments endpoint (cross-tenant data leak — no tenantId filter).
// Use /public/departments/:slug for tenant-scoped department listing.

// POST /api/admissions - Create admission entry (Admin Clerk or Admissions Admin)
router.post('/', authenticate, admissionsStaff, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createAdmissionSchema.parse(req.body);
        const admission = await admissionsService.createAdmission(data, req.user!.userId, req.user!.tenantId);
        res.status(201).json(admission);
    } catch (error) {
        if (error instanceof ZodError) {
            res.status(400).json({
                error: 'Admission details need correction',
                details: error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })),
            });
            return;
        }
        next(error);
    }
});

// GET /api/admissions - List admissions with role-based visibility
router.get('/', authenticate, admissionsStaff, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status, search, skip, take } = req.query;

        // Visibility rules based on role and status:
        // - DRAFT: Show ALL to both admin and clerk
        // - SUBMITTED: Show only OWN to clerk, ALL to admin
        // - APPROVED/REJECTED: Show ALL to both
        let enteredBy: number | undefined;
        if (req.user?.role === 'ADMIN_CLERK' && status === 'SUBMITTED') {
            // Clerk can only see their own SUBMITTED applications
            enteredBy = req.user.userId;
        }
        // For DRAFT, APPROVED, REJECTED, or when user is ADMIN: no enteredBy filter (show all)

        const result = await admissionsService.getAdmissions({
            status: status as AdmissionStatus | undefined,
            search: search as string,
            skip: skip ? parseInt(skip as string) : undefined,
            take: take ? parseInt(take as string) : undefined,
            enteredBy,
            tenantId: req.user!.tenantId,
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/admissions/stats - Dashboard stats (Admissions Staff: Admin + Clerk)
router.get('/stats', authenticate, admissionsStaff, cacheResponse({ ttl: CacheDurations.DYNAMIC }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stats = await admissionsService.getDashboardStats(req.user!.tenantId);
        res.json(stats);
    } catch (error) {
        next(error);
    }
});

// GET /api/admissions/students - Get all approved students (Admissions staff)
router.get('/students', authenticate, admissionsStaff, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { skip, take } = req.query;
        const result = await admissionsService.getApprovedStudents(
            req.user!.tenantId,
            skip ? parseInt(skip as string) : undefined,
            take ? parseInt(take as string) : undefined,
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/admissions/clerks - Get admin clerks (Admissions Admin only)
router.get('/clerks', authenticate, admissionsAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { skip, take } = req.query;
        const result = await admissionsService.getAdminClerks(
            req.user!.tenantId,
            skip ? parseInt(skip as string) : undefined,
            take ? parseInt(take as string) : undefined,
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/admissions/edit-requests - Get pending edit requests (Admissions Staff)
router.get('/edit-requests', authenticate, admissionsStaff, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const status = req.query.status as string || 'PENDING';
        const { skip, take } = req.query;
        const result = await admissionsService.getEditRequests(
            status,
            req.user!.tenantId,
            skip ? parseInt(skip as string) : undefined,
            take ? parseInt(take as string) : undefined,
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/admissions/department-status - Get department admission status (must be before /:id)
router.get('/department-status', authenticate, admissionsStaff, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const status = await admissionsService.getDepartmentAdmissionStatus(req.user!.tenantId);
        res.json(status);
    } catch (error) {
        next(error);
    }
});

// GET /api/admissions/:id - Get admission detail (with role-based access)
router.get('/:id', authenticate, admissionsStaff, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

        const admission = await admissionsService.getAdmissionById(id);
        if (!admission) { res.status(404).json({ error: 'Admission not found' }); return; }

        // Access control for clerks:
        // - Can access ALL drafts (for editing)
        // - Can only access their OWN submitted entries
        // - Can access all approved/rejected (read-only visibility)
        if (req.user?.role === 'ADMIN_CLERK') {
            if (admission.status === 'SUBMITTED' && admission.enteredBy !== req.user.userId) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
        }

        res.json(admission);
    } catch (error) {
        next(error);
    }
});

// PUT /api/admissions/:id - Update admission (Clerk, only DRAFT/REJECTED)
router.put('/:id', authenticate, admissionsStaff, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

        const data = createAdmissionSchema.partial().parse(req.body);
        const updated = await admissionsService.updateAdmission(id, data, req.user!.userId);
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// POST /api/admissions/:id/submit - Submit for review (Clerk)
router.post('/:id/submit', authenticate, admissionsStaff, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }
        const result = await admissionsService.submitAdmission(id, req.user!.userId);
        res.json({ message: 'Admission submitted for review', admission: result });
    } catch (error) {
        next(error);
    }
});

// POST /api/admissions/:id/review - Approve/Reject (Admissions Admin only)
router.post('/:id/review', authenticate, admissionsAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

        const { status, reason, batchSemester, isLateralEntry } = req.body;
        if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
            res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
            return;
        }

        // Validate batchSemester if provided
        if (batchSemester !== undefined) {
            const semester = parseInt(batchSemester);
            if (isNaN(semester) || semester < 1 || semester > 8) {
                res.status(400).json({ error: 'batchSemester must be between 1 and 8' });
                return;
            }
        }

        const result = await admissionsService.reviewAdmission(id, status, req.user!.userId, reason, batchSemester, req.user!.tenantId, isLateralEntry);
        res.json({ message: `Admission ${status.toLowerCase()}`, result });
    } catch (error) {
        // Classify known validation errors as 400 instead of 500
        const knownValidationErrors = [
            'Admission not found',
            'Can only review admissions in SUBMITTED status',
            'Rejection reason is required',
            'Tenant ID is required',
            'Branch selection is missing',
        ];
        if (error instanceof Error && knownValidationErrors.some(msg => error.message.includes(msg))) {
            res.status(400).json({ error: error.message });
            return;
        }
        next(error);
    }
});

// ============================================
// PERMANENT USN ASSIGNMENT
// ============================================

// POST /api/admissions/assign-usn - Assign permanent USN (multiple roles)
router.post('/assign-usn', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Allow: ADMISSIONS_ADMIN, ADMIN_CLERK, DEPARTMENT_ADMIN, TEACHER (mentors)
        const allowedRoles = ['ADMISSIONS_ADMIN', 'ADMIN_CLERK', 'DEPARTMENT_ADMIN', 'TEACHER', 'SUPER_ADMIN'];
        if (!allowedRoles.includes(req.user!.role)) {
            res.status(403).json({ error: 'You do not have permission to assign permanent USN' });
            return;
        }

        const { studentProfileId, permanentUsn } = req.body;
        if (!studentProfileId || !permanentUsn) {
            res.status(400).json({ error: 'studentProfileId and permanentUsn are required' });
            return;
        }

        const result = await admissionsService.assignPermanentUsn(
            studentProfileId,
            permanentUsn,
            req.user!.userId,
            req.user!.tenantId,
        );
        res.json({ message: 'Permanent USN assigned', result });
    } catch (error) {
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('already assigned') || error.message.includes('locked'))) {
            res.status(400).json({ error: error.message });
            return;
        }
        next(error);
    }
});


// ============================================
// DEPARTMENT ADMISSION CLOSURE
// ============================================



// POST /api/admissions/close-admissions/:departmentId - Close admissions for department
router.post('/close-admissions/:departmentId', authenticate, admissionsAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = parseIntParam(req.params.departmentId, 'departmentId');
        if (isNaN(departmentId)) {
            res.status(400).json({ error: 'Invalid department ID' });
            return;
        }

        const result = await admissionsService.closeAdmissionsForDepartment(departmentId, req.user!.userId, req.user!.tenantId);
        res.json(result);
    } catch (error) {
        // Classify known validation errors as 400
        const knownErrors = [
            'Department not found',
            'does not belong to your tenant',
            'already closed',
            'No students pending',
        ];
        if (error instanceof Error && knownErrors.some(msg => error.message.includes(msg))) {
            res.status(400).json({ error: error.message });
            return;
        }
        // Prisma unique constraint violations during USN allocation
        if (error instanceof Error && (error as any).code === 'P2002') {
            const target = (error as any).meta?.target;
            res.status(409).json({
                error: `USN allocation conflict on field: ${target?.join(', ') || 'unknown'}. Please try again.`,
                retryable: true,
            });
            return;
        }
        next(error);
    }
});

// POST /api/admissions/reopen-admissions/:departmentId - Reopen admissions for department
router.post('/reopen-admissions/:departmentId', authenticate, admissionsAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = parseIntParam(req.params.departmentId, 'departmentId');
        if (isNaN(departmentId)) {
            res.status(400).json({ error: 'Invalid department ID' });
            return;
        }

        const result = await admissionsService.reopenAdmissionsForDepartment(departmentId, req.user!.userId, req.user!.tenantId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ============================================
// Admin Clerk Management
// ============================================

// POST /api/admissions/clerks - Create admin clerk (Admissions Admin only)
router.post('/clerks', authenticate, admissionsAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({
            email: z.string().email(),
            name: z.string().min(2),
        });
        const data = schema.parse(req.body);
        const result = await admissionsService.createAdminClerk(data, req.user!.userId, req.user!.tenantId);

        res.status(201).json({
            ...result.user,
            message: 'Admin Clerk created. Login credentials have been sent to their email.',
        });
    } catch (error) {
        next(error);
    }
});



// ============================================
// Student Info Edit (Post-Approval)
// ============================================

// PUT /api/admissions/student/:userId - Admin/Super Admin directly edits student info
router.put('/student/:userId', authenticate, studentEditAllowed, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = parseIntParam(req.params.userId, 'userId');
        if (isNaN(userId)) { res.status(400).json({ error: 'Invalid user ID' }); return; }

        // Super Admin must provide a reason
        if (req.user!.role === 'SUPER_ADMIN' && !req.body.reason?.trim()) {
            res.status(400).json({ error: 'Main Admin must provide a reason for editing student info' });
            return;
        }

        const result = await admissionsService.updateStudentInfo(userId, req.body, req.user!.userId, req.body.reason);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/admissions/student/:userId/edit-request - Clerk or Dept Admin submits edit request
router.post('/student/:userId/edit-request', authenticate, editRequestors, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = parseIntParam(req.params.userId, 'userId');
        if (isNaN(userId)) { res.status(400).json({ error: 'Invalid user ID' }); return; }

        const result = await admissionsService.createEditRequest(userId, req.body, req.user!.userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});



// POST /api/admissions/edit-requests/:id/approve - Approve edit request (Admin)
router.post('/edit-requests/:id/approve', authenticate, admissionsAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

        const result = await admissionsService.approveEditRequest(id, req.user!.userId, req.body.reviewNote);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/admissions/edit-requests/:id/reject - Reject edit request (Admin)
router.post('/edit-requests/:id/reject', authenticate, admissionsAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return; }

        const result = await admissionsService.rejectEditRequest(id, req.user!.userId, req.body.reviewNote);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ============================================
// Branch Change
// ============================================

// PUT /api/admissions/student/:userId/branch - Change student branch (Admissions Admin only)
router.put('/student/:userId/branch', authenticate, admissionsAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = parseIntParam(req.params.userId, 'userId');
        if (isNaN(userId)) { res.status(400).json({ error: 'Invalid user ID' }); return; }

        const { newBranch } = req.body;
        if (!newBranch?.trim()) {
            res.status(400).json({ error: 'New branch is required' });
            return;
        }

        const result = await admissionsService.changeBranch(userId, newBranch, req.user!.userId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// ============================================
// BULK UPLOAD (Admissions Admin only)
// ============================================

// Multer for Excel upload (memory storage)
const excelUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        const validMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
        ];
        if (validMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        }
    },
});

// GET /api/admissions/bulk-upload/template - Download Excel template
router.get('/bulk-upload/template', authenticate, admissionsAdminOnly, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const buffer = await admissionsService.generateTemplate();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="student_admission_template.xlsx"');
        res.send(buffer);
    } catch (error) {
        next(error);
    }
});

// POST /api/admissions/bulk-upload/parse - Upload & parse Excel file
router.post('/bulk-upload/parse', authenticate, admissionsAdminOnly, excelUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const tenantId = req.user!.tenantId;
        const result = await admissionsService.parseStudentExcel(req.file.buffer, tenantId);
        res.json(result);
    } catch (error) {
        // Template mismatch errors should be 400
        if (error instanceof Error && (error.message.includes('Invalid template') || error.message.includes('No data rows'))) {
            res.status(400).json({ error: error.message });
            return;
        }
        next(error);
    }
});

// POST /api/admissions/bulk-upload/confirm - Confirm and create students
router.post('/bulk-upload/confirm', authenticate, admissionsAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { rows } = req.body;
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            res.status(400).json({ error: 'No rows provided' });
            return;
        }

        const tenantId = req.user!.tenantId;
        if (!tenantId) {
            res.status(400).json({ error: 'Tenant context required' });
            return;
        }

        const result = await admissionsService.bulkCreateApprovedStudents(rows, req.user!.userId, tenantId);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
