import { Router, Request, Response, NextFunction } from 'express';
import { academicCalendarService } from '../../../services/academic-calendar.service.js';

const router = Router();

router.post('/calendar/day', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { date, type, label, overrideDay, departmentId } = req.body;
        const result = await academicCalendarService.declareCalendarDay(
            req.user!.tenantId,
            req.user!.userId,
            { date, type, label, overrideDay: overrideDay ? Number(overrideDay) : undefined, departmentId: departmentId ? Number(departmentId) : undefined }
        );
        res.json(result);
    } catch (error) { next(error); }
});

router.get('/calendar/month/:year/:month', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { year, month } = req.params;
        const { departmentId } = req.query;
        const result = await academicCalendarService.getCalendarForMonth(
            req.user!.tenantId,
            Number(year),
            Number(month),
            departmentId ? Number(departmentId) : undefined
        );
        res.json(result);
    } catch (error) { next(error); }
});

router.delete('/calendar/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const result = await academicCalendarService.removeCalendarDay(Number(id));
        res.json(result);
    } catch (error) { next(error); }
});

export default router;
