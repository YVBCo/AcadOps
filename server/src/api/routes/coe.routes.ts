import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { admissionsService } from '../../services/admissions/index.js';
import { coeService } from '../../services/coe.service.js';
import { authenticate } from '../middleware/index.js';
import { parseIntParam, parseOptionalInt } from '../../utils/param-utils.js';

const router = Router();

// Middleware: Only COE and CLERK roles allowed
function coeStaffOnly(req: Request, res: Response, next: Function) {
    const role = req.user?.role;
    if (role !== 'COE' && role !== 'CLERK') {
        res.status(403).json({ error: 'Access denied. Only COE and COE Clerk can perform this action.' });
        return;
    }
    next();
}

// ============================================
// PERMANENT USN MANAGEMENT (COE & CLERK ONLY)
// ============================================

// POST /api/coe/assign-permanent-usn - Assign permanent USN to a student
router.post('/assign-permanent-usn', authenticate, coeStaffOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { studentProfileId, permanentUsn } = req.body;

        // Validate input
        const schema = z.object({
            studentProfileId: z.number().int().positive(),
            permanentUsn: z.string().min(1, 'Permanent USN is required'),
        });

        const data = schema.parse({ studentProfileId, permanentUsn });

        const result = await admissionsService.assignPermanentUsn(
            data.studentProfileId,
            data.permanentUsn,
            req.user!.userId,
            req.user!.tenantId
        );

        res.json({
            message: 'Permanent USN assigned successfully',
            result,
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/coe/students - Get students with temporary USNs (filter in DB, not JS)
router.get('/students', authenticate, coeStaffOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const students = await coeService.getStudentsWithTempUsn(req.user!.tenantId);
        res.json(students);
    } catch (error) {
        next(error);
    }
});

// GET /api/coe/internal-marks - Get internal marks submissions for COE review
router.get('/internal-marks', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const role = req.user?.role;
        if (role !== 'COE') {
            res.status(403).json({ error: 'Access denied. Only COE can view internal marks.' });
            return;
        }

        const { departmentId, batchId, courseId } = req.query;

        const result = await coeService.getInternalMarksSubmissions(req.user!.tenantId, {
            departmentId: departmentId ? parseIntParam(departmentId as string, 'departmentId') : undefined,
            batchId: batchId ? parseIntParam(batchId as string, 'batchId') : undefined,
            courseId: courseId ? parseIntParam(courseId as string, 'courseId') : undefined,
        });

        res.json(result);
    } catch (error) {
        next(error);
    }
});

export default router;
