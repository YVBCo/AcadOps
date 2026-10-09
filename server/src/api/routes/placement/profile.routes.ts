import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { placementService } from '../../../services/placement.service.js';
import { storageService } from '../../../services/storage.service.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';

const router = Router();
router.use(authenticate);

const cvUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        if (file.mimetype === 'application/pdf' && file.originalname.toLowerCase().endsWith('.pdf')) callback(null, true);
        else callback(new Error('Only PDF CV files are allowed'));
    },
});

const profileSchema = z.object({
    cgpa: z.number().min(0).max(10).optional(),
    tenthPct: z.number().min(0).max(100).optional(),
    twelfthPct: z.number().min(0).max(100).optional(),
    backlogs: z.number().int().min(0).optional(),
    activeBacklogs: z.number().int().min(0).optional(),
    skills: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
    linkedinUrl: z.string().url().max(1000).optional().or(z.literal('')),
    githubUrl: z.string().url().max(1000).optional().or(z.literal('')),
    portfolioUrl: z.string().url().max(1000).optional().or(z.literal('')),
    isOptedOut: z.boolean().optional(),
});

router.get('/', requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await placementService.getProfile(req.tenantId!, req.user!.userId));
    } catch (error) { next(error); }
});

router.patch('/', requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.json(await placementService.updateProfile(req.tenantId!, req.user!.userId, profileSchema.parse(req.body)));
    } catch (error) { next(error); }
});

router.post('/cv', requireRole('STUDENT'), cvUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Choose a PDF file to upload' });
            return;
        }
        const uploaded = await storageService.uploadFile(req.file, `placement/${req.tenantId}/${req.user!.userId}/cvs`);
        res.status(201).json(await placementService.uploadCv(req.tenantId!, req.user!.userId, {
            fileName: req.file.originalname,
            fileUrl: uploaded.url,
        }));
    } catch (error) { next(error); }
});

router.post('/declaration', requireRole('STUDENT'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = z.object({
            declarationType: z.string().trim().min(1).max(80).optional(),
            reason: z.string().max(2000).optional(),
            companyName: z.string().trim().max(160).optional(),
            ctc: z.string().trim().max(80).optional(),
        }).parse(req.body);
        res.json(await placementService.submitDeclaration(req.tenantId!, req.user!.userId, data));
    } catch (error) { next(error); }
});

router.get('/:userId', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const profile = await placementService.findProfile(req.tenantId!, Number(req.params.userId));
        if (!profile) {
            res.status(404).json({ error: 'Placement profile not found' });
            return;
        }
        res.json(profile);
    } catch (error) { next(error); }
});

export default router;
