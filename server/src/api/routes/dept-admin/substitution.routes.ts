import { Router, Request, Response, NextFunction } from 'express';
import { substitutionService } from '../../../services/substitution.service.js';

const router = Router();

router.get('/substitutions/available-teachers', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { semesterId, dayOfWeek, periodNumber, date, departmentId } = req.query;
        const result = await substitutionService.getAvailableTeachers(
            req.user!.tenantId,
            Number(semesterId),
            Number(dayOfWeek),
            Number(periodNumber),
            new Date(date as string),
            departmentId ? Number(departmentId) : undefined
        );
        res.json(result);
    } catch (error) { next(error); }
});

router.post('/substitutions/assign', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { timetableSlotId, date, originalTeacherId, substituteTeacherId, substituteCourseId, reason } = req.body;
        const result = await substitutionService.assignSubstitute({
            timetableSlotId: Number(timetableSlotId),
            date,
            originalTeacherId: Number(originalTeacherId),
            substituteTeacherId: Number(substituteTeacherId),
            substituteCourseId: substituteCourseId ? Number(substituteCourseId) : undefined,
            reason,
            assignedBy: req.user!.userId,
        });
        res.json(result);
    } catch (error) { next(error); }
});

router.get('/substitutions/date/:date', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { date } = req.params;
        const { departmentId } = req.query;
        const result = await substitutionService.getSubstitutionsForDate(
            req.user!.tenantId,
            date as string,
            departmentId ? Number(departmentId as string) : undefined
        );
        res.json(result);
    } catch (error) { next(error); }
});

router.delete('/substitutions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const result = await substitutionService.removeSubstitution(Number(id));
        res.json(result);
    } catch (error) { next(error); }
});

export default router;
