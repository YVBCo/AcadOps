import { Router, Request, Response, NextFunction } from 'express';
import { classroomService } from '../../../services/classroom.service.js';

const router = Router();

router.post('/classrooms', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, building, capacity, type } = req.body;
        const result = await classroomService.create(
            req.user!.tenantId,
            { name, building, capacity: capacity ? Number(capacity) : undefined, type }
        );
        res.json(result);
    } catch (error) { next(error); }
});

router.get('/classrooms', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type } = req.query;
        const result = await classroomService.list(req.user!.tenantId, type as string | undefined);
        res.json(result);
    } catch (error) { next(error); }
});

router.get('/classrooms/free', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { dayOfWeek, periodNumber, semesterId, type } = req.query;
        const result = await classroomService.getFreeClassrooms(
            req.user!.tenantId,
            Number(dayOfWeek),
            Number(periodNumber),
            Number(semesterId),
            type as string | undefined
        );
        res.json(result);
    } catch (error) { next(error); }
});

router.put('/classrooms/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const result = await classroomService.update(Number(id), req.body);
        res.json(result);
    } catch (error) { next(error); }
});

router.delete('/classrooms/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const result = await classroomService.remove(Number(id));
        res.json(result);
    } catch (error) { next(error); }
});

export default router;
