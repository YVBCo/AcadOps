import { Router, Request, Response, NextFunction } from 'express';
import { timetableGeneratorService } from '../../../services/timetable-generator.service.js';

const router = Router();

router.post('/timetable-generator/config', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sectionId, semesterId, maxPeriodsPerDay, teacherMaxPerDay, courseWeeklyClasses, courseIsLab, labBlockSize } = req.body;
        const result = await timetableGeneratorService.saveConfig(
            Number(sectionId),
            Number(semesterId),
            { maxPeriodsPerDay, teacherMaxPerDay, courseWeeklyClasses, courseIsLab, labBlockSize }
        );
        res.json(result);
    } catch (error) { next(error); }
});

router.get('/timetable-generator/config/:sectionId/:semesterId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sectionId, semesterId } = req.params;
        const result = await timetableGeneratorService.getConfig(Number(sectionId), Number(semesterId));
        res.json(result);
    } catch (error) { next(error); }
});

router.post('/timetable-generator/generate', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sectionId, sectionIds, semesterId, allowExceedLimits } = req.body;
        const ids = sectionIds || (sectionId ? [sectionId] : []);
        const result = await timetableGeneratorService.generate(
            ids.map(Number), 
            Number(semesterId), 
            req.user!.tenantId, 
            allowExceedLimits === true
        );
        res.json(result);
    } catch (error) { next(error); }
});

router.get('/timetable-generator/teacher-load/:semesterId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { semesterId } = req.params;
        const result = await timetableGeneratorService.getTeacherLoadSummary(Number(semesterId), req.user!.departmentId!);
        res.json(result);
    } catch (error) { next(error); }
});

router.post('/timetable-generator/validate', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sectionIds, semesterId, teacherMaxPerDay } = req.body;
        const result = await timetableGeneratorService.validateBeforeGenerate(
            (sectionIds as number[]).map(Number),
            Number(semesterId),
            teacherMaxPerDay || {}
        );
        res.json(result);
    } catch (error) { next(error); }
});

router.get('/timetable-generator/grid/:sectionId/:semesterId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sectionId, semesterId } = req.params;
        const result = await timetableGeneratorService.getTimetableGrid(Number(sectionId), Number(semesterId));
        res.json(result);
    } catch (error) { next(error); }
});

router.post('/timetable-generator/swap', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { slotId1, slotId2 } = req.body;
        const result = await timetableGeneratorService.swapSlots(Number(slotId1), Number(slotId2));
        res.json(result);
    } catch (error) { next(error); }
});

router.delete('/timetable-generator/clear/:sectionId/:semesterId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { sectionId, semesterId } = req.params;
        const result = await timetableGeneratorService.clearTimetable(Number(sectionId), Number(semesterId));
        res.json(result);
    } catch (error) { next(error); }
});

export default router;
