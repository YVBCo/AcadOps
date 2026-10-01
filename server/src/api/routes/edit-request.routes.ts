import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { editRequestService } from '../../services/edit-request.service.js';
import { authenticate, requireRole, adminOnly } from '../middleware/auth.middleware.js';
import { EditRequest } from '@prisma/client';

const router = Router();

// ─── Zod Schemas ──────────────────────────────────────────────
const createEditRequestSchema = z.object({
    type: z.enum(['ATTENDANCE', 'MARKS']),
    subjectId: z.number().int().positive(),
    entityType: z.string().min(1),
    entityId: z.number().int().positive(),
    oldValue: z.record(z.string(), z.unknown()),
    newValue: z.record(z.string(), z.unknown()),
    reason: z.string().optional(),
});

const reviewEditRequestSchema = z.object({
    reviewNote: z.string().optional(),
});

const listEditRequestsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    type: z.enum(['ATTENDANCE', 'MARKS']).optional(),
});

// All routes require authentication
router.use(authenticate);

// Create edit request (Teachers only)
router.post('/', requireRole('TEACHER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createEditRequestSchema.parse(req.body);

        const request = await editRequestService.create({
            type: data.type,
            requesterId: req.user!.userId,
            subjectId: data.subjectId,
            entityType: data.entityType,
            entityId: data.entityId,
            oldValue: data.oldValue,
            newValue: data.newValue,
            reason: data.reason,
        }, req.user!.userId);

        res.status(201).json(request);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Get all edit requests (Admin only)
router.get('/', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { page, limit, status, type } = listEditRequestsQuerySchema.parse(req.query);

        const skip = (page - 1) * limit;
        const result = await editRequestService.getAll({
            skip,
            take: limit,
            status,
            type,
        });

        res.json({
            requests: result.requests,
            total: result.total,
            page,
            totalPages: Math.ceil(result.total / limit),
        });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Get pending requests for the admin's department
router.get('/pending', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        let requests: EditRequest[];
        if (req.user!.role === 'SUPER_ADMIN') {
            requests = await editRequestService.getPending();
        } else if (req.user!.departmentId) {
            requests = await editRequestService.getPendingByDepartment(req.user!.departmentId);
        } else {
            requests = [];
        }
        res.json(requests);
    } catch (error) {
        next(error);
    }
});

// Get count of pending requests
router.get('/pending/count', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        let count: number;
        if (req.user!.role === 'SUPER_ADMIN') {
            count = await editRequestService.countPending();
        } else if (req.user!.departmentId) {
            count = await editRequestService.countPendingByDepartment(req.user!.departmentId);
        } else {
            count = 0;
        }
        res.json({ count });
    } catch (error) {
        next(error);
    }
});

// Get my edit requests (Teacher sees their own)
router.get('/my', requireRole('TEACHER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const requests = await editRequestService.getByRequester(req.user!.userId);
        res.json(requests);
    } catch (error) {
        next(error);
    }
});

// Get single request
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const request = await editRequestService.getById(Number(req.params.id));
        if (!request) {
            return res.status(404).json({ error: 'Edit request not found' });
        }
        res.json(request);
    } catch (error) {
        next(error);
    }
});

// Approve edit request (Admin only)
router.put('/:id/approve', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = reviewEditRequestSchema.parse(req.body);
        const request = await editRequestService.approve(
            Number(req.params.id),
            req.user!.userId,
            data.reviewNote
        );
        res.json(request);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Reject edit request (Admin only)
router.put('/:id/reject', adminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = reviewEditRequestSchema.parse(req.body);
        const request = await editRequestService.reject(
            Number(req.params.id),
            req.user!.userId,
            data.reviewNote
        );
        res.json(request);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

export const editRequestRoutes = router;
