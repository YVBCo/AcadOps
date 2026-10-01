import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { semesterMarksService } from '../../services/semester-marks.service.js';
import { authenticate } from '../middleware/index.js';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only Excel files
        const allowedMimes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'));
        }
    },
});

// Middleware: CLERK, ADMISSIONS_ADMIN, ADMIN_CLERK, and COE can upload
function uploaderOnly(req: Request, res: Response, next: NextFunction) {
    const role = req.user?.role;
    if (role !== 'CLERK' && role !== 'ADMISSIONS_ADMIN' && role !== 'ADMIN_CLERK' && role !== 'COE') {
        res.status(403).json({ error: 'Access denied. Only Clerks, Admissions Admins, and COE can upload marks.' });
        return;
    }
    next();
}

// ==============================================
// MARKS UPLOAD (CLERK / ADMISSIONS_ADMIN)
// ==============================================

// POST /api/semester-marks/upload - Upload Excel file with marks
router.post('/upload', authenticate, uploaderOnly, upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const schema = z.object({
            batchId: z.coerce.number().int().positive(),
            departmentId: z.coerce.number().int().positive(),
            semesterNumber: z.coerce.number().int().min(1).max(8),
            courseId: z.coerce.number().int().positive(),
        });

        const context = schema.parse(req.body);
        const userId = req.user!.userId;

        const result = await semesterMarksService.uploadMarks(
            req.file.buffer,
            req.file.originalname,
            context,
            userId
        );

        res.json({
            message: 'Marks uploaded successfully',
            upload: result.upload,
            validCount: result.validCount,
            invalidCount: result.invalidCount,
            errors: result.errors,
            columnMapping: result.columnMapping,
            sampleRows: result.sampleRows,
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/semester-marks/my-uploads - Get uploads by current user
router.get('/my-uploads', authenticate, uploaderOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const uploads = await semesterMarksService.getUploadsForReview();
        res.json(uploads);
    } catch (error) {
        next(error);
    }
});

// ==============================================
// COE REVIEW & APPROVAL
// ==============================================

// Middleware: Only COE can review/approve
function coeOnly(req: Request, res: Response, next: NextFunction) {
    const role = req.user?.role;
    if (role !== 'COE') {
        res.status(403).json({ error: 'Access denied. Only COE can perform this action.' });
        return;
    }
    next();
}

// GET /api/semester-marks/pending-review - Get uploads pending COE review
// IMPORTANT: This must be defined BEFORE /:id to avoid matching 'pending-review' as an ID
router.get('/pending-review', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const uploads = await semesterMarksService.getUploadsForReview('PENDING');
        res.json(uploads);
    } catch (error) {
        next(error);
    }
});

// GET /api/semester-marks/:id - Get upload details
// IMPORTANT: This must be defined AFTER all named routes
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const upload = await semesterMarksService.getUploadById(id);

        if (!upload) {
            res.status(404).json({ error: 'Upload not found' });
            return;
        }

        res.json(upload);
    } catch (error) {
        next(error);
    }
});

// POST /api/semester-marks/:id/approve - Approve marks upload
router.post('/:id/approve', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const { reviewNotes } = req.body;
        const userId = req.user!.userId;

        const upload = await semesterMarksService.approveUpload(id, userId, reviewNotes);

        res.json({
            message: 'Marks approved successfully',
            upload,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/semester-marks/:id/reject - Reject marks upload
router.post('/:id/reject', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const { reviewNotes } = req.body;

        if (!reviewNotes) {
            res.status(400).json({ error: 'Review notes required for rejection' });
            return;
        }

        const userId = req.user!.userId;
        const upload = await semesterMarksService.rejectUpload(id, userId, reviewNotes);

        res.json({
            message: 'Marks rejected',
            upload,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/semester-marks/:id/post - Post results (make visible to students)
router.post('/:id/post', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const id = parseIntParam(req.params.id, 'id');
        const userId = req.user!.userId;

        const upload = await semesterMarksService.postResults(id, userId);

        res.json({
            message: 'Results posted successfully',
            upload,
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/semester-marks/entry/:entryId - Edit marks for a specific entry
router.put('/entry/:entryId', authenticate, coeOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const entryId = parseIntParam(req.params.entryId, 'entryId');
        const { marks } = req.body;

        if (typeof marks !== 'number' || marks < 0 || marks > 100) {
            res.status(400).json({ error: 'Invalid marks value (must be 0-100)' });
            return;
        }

        const entry = await semesterMarksService.editMarks(entryId, marks);

        res.json({
            message: 'Marks updated successfully',
            entry,
        });
    } catch (error) {
        next(error);
    }
});

export default router;
