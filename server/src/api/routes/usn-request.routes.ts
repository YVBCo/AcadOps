import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { usnRequestService } from '../../services/usn-request.service.js';
import { authenticate, admissionsAdminOnly, requireRole } from '../middleware/index.js';
import { parseIntParam, parseOptionalInt } from '../../utils/param-utils.js';

const router = Router();

// POST /api/usn-requests - Create USN request (Teacher/Mentor)
router.post('/', authenticate, requireRole('TEACHER'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const schema = z.object({
            studentProfileId: z.number().int().positive(),
            reason: z.string().optional(),
        });
        const data = schema.parse(req.body);

        const request = await usnRequestService.createRequest(
            data.studentProfileId,
            req.user!.userId,
            data.reason
        );
        res.status(201).json({ message: 'USN request submitted', request });
    } catch (error) {
        next(error);
    }
});

// GET /api/usn-requests - List USN requests
router.get('/', authenticate, requireRole('TEACHER', 'ADMISSIONS_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status, skip, take } = req.query;

        let requestedBy: number | undefined;
        if (req.user?.role === 'TEACHER') {
            requestedBy = req.user.userId;
        }

        const result = await usnRequestService.getRequests({
            status: status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined,
            requestedBy,
            skip: skip ? parseIntParam(skip as string, 'skip') : undefined,
            take: take ? parseIntParam(take as string, 'take') : undefined,
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/usn-requests/:id - Get single request
router.get('/:id', authenticate, requireRole('TEACHER', 'ADMISSIONS_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');

        const request = await usnRequestService.getRequestById(id);
        if (!request) { res.status(404).json({ error: 'USN request not found' }); return; }

        if (req.user?.role === 'TEACHER' && request.requestedBy !== req.user.userId) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        res.json(request);
    } catch (error) {
        next(error);
    }
});

// POST /api/usn-requests/:id/review - Review USN request (Admissions Admin)
router.post('/:id/review', authenticate, admissionsAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');

        const schema = z.object({
            status: z.enum(['APPROVED', 'REJECTED']),
            permanentUsn: z.string().optional(),
            reviewNote: z.string().optional(),
        });
        const data = schema.parse(req.body);

        const result = await usnRequestService.reviewRequest(
            id,
            data.status,
            req.user!.userId,
            data.permanentUsn,
            data.reviewNote
        );

        res.json({ message: `USN request ${data.status.toLowerCase()}`, result });
    } catch (error) {
        next(error);
    }
});

export default router;
