/**
 * Dept Admin — Timetable Sub-Router
 * ──────────────────────────────────────
 * Handles: time slot configuration, timetable CRUD
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { timetableService } from '../../../services/index.js';
import { parseIntParam } from '../../../utils/param-utils.js';
import { logger } from '../../../utils/logger.js';
import { getDepartmentId } from './shared.js';

const log = logger.child({ module: 'dept-admin-timetable' });

// ─── Zod Schemas ──────────────────────────────────────────────
const timeSlotsSchema = z.object({
    slotDuration: z.number().optional(),
    dayStartTime: z.string().optional(),
    dayEndTime: z.string().optional(),
    breakSlots: z.array(z.object({
        start: z.string(),
        end: z.string(),
        label: z.string().optional(),
    })).optional(),
});

const uploadTimetableSchema = z.object({
    sectionId: z.number().int().positive(),
    semesterId: z.number().int().positive(),
    semesterNumber: z.number().int().positive(),
    fileUrl: z.string().min(1),
    fileName: z.string().min(1),
    fileType: z.enum(['pdf', 'image']),
});

const router = Router();

// Get time slot configuration for department
router.get('/time-slots', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const departmentId = getDepartmentId(req);

        const config = await timetableService.getTimeSlotConfig(departmentId);

        res.json(config);
    } catch (error) {
        next(error);
    }
});

// Configure time slots for department
router.post('/time-slots', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const departmentId = getDepartmentId(req);
        const data = timeSlotsSchema.parse(req.body);

        const config = await timetableService.configureTimeSlots(
            departmentId,
            data,
            user.userId
        );

        res.json(config);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Get timetable for section
router.get('/timetable/:sectionId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const sectionId = parseIntParam(req.params.sectionId, 'sectionId');
        const { semesterId } = req.query;

        if (semesterId) {
            const timetable = await timetableService.getTimetable(
                sectionId,
                parseInt(semesterId as string)
            );
            return res.json(timetable);
        }

        const timetables = await timetableService.getTimetablesBySection(sectionId);
        res.json(timetables);
    } catch (error) {
        // Log and return empty array instead of 500 — table may not exist yet
        log.error({ err: error, sectionId: req.params.sectionId }, 'Error fetching timetables');
        res.json([]);
    }
});

// Upload timetable (PDF/image)
router.post('/timetable', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const data = uploadTimetableSchema.parse(req.body);

        const timetable = await timetableService.uploadTimetable(
            data,
            user.userId
        );

        res.status(201).json(timetable);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// Deactivate timetable
router.delete('/timetable/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const id = parseIntParam(req.params.id, 'id');

        const timetable = await timetableService.deactivateTimetable(id, user.userId);

        res.json(timetable);
    } catch (error) {
        next(error);
    }
});

export default router;
