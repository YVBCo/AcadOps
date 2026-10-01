/**
 * Results Routes
 * ──────────────────────────────────────
 * COE result management: listing, publishing, generation.
 * All logic delegated to ResultsService.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { authenticate } from '../middleware/index.js';
import { resultsService } from '../../services/results.service.js';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

// ── Zod Schemas ──────────────────────────────────────────────
const publishBatchSchema = z.object({
    departmentId: z.number().int().positive().optional(),
    batchId: z.number().int().positive().optional(),
    courseId: z.number().int().positive().optional(),
});

const generateResultsSchema = z.object({
    departmentId: z.number().int().positive(),
    batchId: z.number().int().positive(),
    courseId: z.number().int().positive(),
});

const listResultsQuerySchema = z.object({
    status: z.string().optional(),
    isPublished: z.enum(['true', 'false']).optional(),
    departmentId: z.coerce.number().int().positive().optional(),
    batchId: z.coerce.number().int().positive().optional(),
    courseId: z.coerce.number().int().positive().optional(),
});

// Middleware: Only COE can access results management
function coeOnly(req: Request, res: Response, next: NextFunction) {
    const role = req.user?.role;
    if (role !== 'COE') {
        res.status(403).json({ error: 'Access denied. Only COE can manage results.' });
        return;
    }
    next();
}

// GET /api/results
router.get('/', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const filters = listResultsQuerySchema.parse(req.query);
        const results = await resultsService.list({
            ...filters,
            isPublished: filters.isPublished === 'true' ? true : filters.isPublished === 'false' ? false : undefined,
        });
        res.json(results);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// PUT /api/results/:id/publish
router.put('/:id/publish', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const updated = await resultsService.publishOne(id, req.user!.userId);
        res.json({ message: 'Result published successfully', result: updated });
    } catch (error) {
        next(error);
    }
});

// POST /api/results/publish-batch
router.post('/publish-batch', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = publishBatchSchema.parse(req.body);
        const result = await resultsService.publishBatch(data, req.user!.userId);
        res.json({ message: `Published ${result.count} results`, count: result.count });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// POST /api/results/generate
router.post('/generate', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = generateResultsSchema.parse(req.body);
        const result = await resultsService.generate(data.departmentId, data.batchId, data.courseId);
        res.json({ message: `Generated ${result.generated} results`, ...result });
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

export default router;
