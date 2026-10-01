import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { developerService } from '../../services/developer.service.js';
import { tenantService } from '../../services/tenant.service.js';
import { systemErrorService } from '../../services/system-error.service.js';
import { emailService } from '../../services/email.service.js';
import { storageService } from '../../services/storage.service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parseIntParam } from '../../utils/param-utils.js';
import os from 'os';

// ─── Zod Schemas ──────────────────────────────────────────────
const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

// Helper: empty string → undefined (for optional fields that may arrive as "")
const optionalString = z.string().optional().transform(v => v === '' ? undefined : v);
const optionalEmail = z.string().optional().transform(v => v === '' ? undefined : v).pipe(z.string().email().optional());

const createTenantSchema = z.object({
    name: z.string().min(1).max(200),
    slug: z.string().min(1).max(100),
    type: z.enum(['ENGINEERING', 'MEDICAL', 'DEGREE', 'MBA', 'MCA', 'LAW', 'PHARMACY', 'AYURVEDIC', 'PARAMEDICAL', 'OTHER']),
    maxUsers: z.number().int().positive().optional(),
    contactEmail: optionalEmail,
    contactPhone: optionalString,
    address: optionalString,
    adminName: optionalString,
    adminEmail: optionalEmail,
});

const updateTenantSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    maxUsers: z.number().int().positive().optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    address: z.string().optional(),
}).passthrough();

const resolveManySchema = z.object({
    ids: z.array(z.number().int().positive()).min(1),
});



// Multer config for login background images (memory storage — storageService handles persistence)
const uploadLoginBg = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    },
});

const router = Router();

// ============================================
// Developer Auth Middleware
// ============================================
const requireDeveloper = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Developer authentication required' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const payload = developerService.verifyToken(token);
        if (!payload.isDeveloper) {
            res.status(403).json({ error: 'Developer access only' });
            return;
        }
        req.developer = payload;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired developer token' });
    }
};

// ============================================
// Auth Routes
// ============================================

// POST /api/dev/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = loginSchema.parse(req.body);
        const result = await developerService.login(data);
        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// ============================================
// Tenant Management Routes (Protected)
// ============================================

// GET /api/dev/tenants
router.get('/tenants', requireDeveloper, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const tenants = await tenantService.list();
        res.json(tenants);
    } catch (error) {
        next(error);
    }
});

// GET /api/dev/tenants/active (for login dropdown, public)
router.get('/tenants/active', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const tenants = await tenantService.listActive();
        res.json(tenants);
    } catch (error) {
        next(error);
    }
});

// GET /api/dev/tenants/branding/:slug (public — for login page)
router.get('/tenants/branding/:slug', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenant = await tenantService.getBySlug(req.params.slug as string);
        if (!tenant || !tenant.isActive) {
            res.status(404).json({ error: 'Institution not found' });
            return;
        }
        res.json({
            name: tenant.name,
            slug: tenant.slug,
            type: tenant.type,
            logo: tenant.logoData || tenant.logoUrl || null,
            loginBgImage: tenant.loginBgData || tenant.loginBgImage || null,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/dev/tenants
router.post('/tenants', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = createTenantSchema.parse(req.body);
        // Sanitize slug
        const cleanSlug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
        const result = await tenantService.create({
            name: data.name, slug: cleanSlug, type: data.type, maxUsers: data.maxUsers,
            contactEmail: data.contactEmail, contactPhone: data.contactPhone,
            address: data.address, adminName: data.adminName, adminEmail: data.adminEmail,
        });
        res.status(201).json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// POST /api/dev/tenants/:id/login-bg — upload login background image
router.post('/tenants/:id/login-bg', requireDeveloper, uploadLoginBg.single('image'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = parseIntParam(req.params.id, 'id');
        if (!req.file) {
            res.status(400).json({ error: 'No image file provided. Accepted: jpg, png, webp (max 5MB)' });
            return;
        }
        const { bufferToBgDataUri } = await import('../../utils/image-utils.js');
        const buffer = req.file.buffer || fs.readFileSync(req.file.path);
        const dataUri = await bufferToBgDataUri(buffer);
        await tenantService.updateLoginBgData(tenantId, dataUri);
        res.json({ stored: true, sizeKB: Math.round(dataUri.length / 1024) });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/dev/tenants/:id/login-bg — remove login background image
router.delete('/tenants/:id/login-bg', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = parseIntParam(req.params.id, 'id');
        await tenantService.removeLoginBgData(tenantId);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// GET /api/dev/tenants/:id
router.get('/tenants/:id', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenant = await tenantService.getById(parseIntParam(req.params.id, 'id'));
        res.json(tenant);
    } catch (error) {
        next(error);
    }
});

// PATCH /api/dev/tenants/:id
router.patch('/tenants/:id', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = updateTenantSchema.parse(req.body);
        const tenant = await tenantService.update(parseIntParam(req.params.id, 'id'), data);
        res.json(tenant);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// GET /api/dev/tenants/:id/modules
router.get('/tenants/:id/modules', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = parseIntParam(req.params.id, 'id');
        const modules = await tenantService.getModules(tenantId);
        res.json({ modules, defaultModules: tenantService.getDefaultModules() });
    } catch (error) {
        next(error);
    }
});

// PATCH /api/dev/tenants/:id/modules
router.patch('/tenants/:id/modules', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenantId = parseIntParam(req.params.id, 'id');
        const modulesData = z.record(z.string(), z.any()).parse(req.body);
        const result = await tenantService.updateModules(tenantId, modulesData);
        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// POST /api/dev/tenants/:id/deactivate
router.post('/tenants/:id/deactivate', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenant = await tenantService.deactivate(parseIntParam(req.params.id, 'id'));
        res.json(tenant);
    } catch (error) {
        next(error);
    }
});

// POST /api/dev/tenants/:id/activate
router.post('/tenants/:id/activate', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const tenant = await tenantService.activate(parseIntParam(req.params.id, 'id'));
        res.json(tenant);
    } catch (error) {
        next(error);
    }
});

// ============================================
// System Health Routes
// ============================================

// GET /api/dev/health
router.get('/health', requireDeveloper, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const [globalStats, errorStats] = await Promise.all([
            tenantService.getGlobalStats(),
            systemErrorService.getStats(),
        ]);

        // Email stats may fail if email_logs table doesn't exist yet
        let emailStats = { total: 0, sent: 0, failed: 0, last24h: 0, failedLast24h: 0, deliveryRate: 100 };
        try {
            emailStats = await emailService.getStats();
        } catch { /* table may not exist yet */ }

        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            server: {
                uptime: Math.floor(uptime),
                uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
                nodeVersion: process.version,
                platform: os.platform(),
                hostname: os.hostname(),
                memory: {
                    rss: Math.round(memoryUsage.rss / 1024 / 1024),
                    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                    external: Math.round(memoryUsage.external / 1024 / 1024),
                },
                cpuLoad: os.loadavg(),
            },
            tenants: globalStats,
            errors: errorStats,
            emails: emailStats,
            storage: { backend: storageService.backend },
        });
    } catch (error) {
        next(error);
    }
});

// ============================================
// Error Tracking Routes
// ============================================

// GET /api/dev/errors
router.get('/errors', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await systemErrorService.list({
            tenantId: req.query.tenantId ? parseIntParam(req.query.tenantId as string, 'tenantId') : undefined,
            severity: req.query.severity as string,
            resolved: req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined,
            limit: parseIntParam(req.query.limit as string || '50', 'limit'),
            offset: parseIntParam(req.query.offset as string || '0', 'offset'),
        });
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// PATCH /api/dev/errors/:id/resolve
router.patch('/errors/:id/resolve', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const error = await systemErrorService.resolve(parseIntParam(req.params.id, 'id'));
        res.json(error);
    } catch (err) {
        next(err);
    }
});

// POST /api/dev/errors/resolve-many
router.post('/errors/resolve-many', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = resolveManySchema.parse(req.body);
        const result = await systemErrorService.resolveMany(data.ids);
        res.json(result);
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: error.issues });
        }
        next(error);
    }
});

// GET /api/dev/stats
router.get('/stats', requireDeveloper, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const [globalStats, errorStats] = await Promise.all([
            tenantService.getGlobalStats(),
            systemErrorService.getStats(),
        ]);
        let emailStats = { total: 0, sent: 0, failed: 0, last24h: 0, failedLast24h: 0, deliveryRate: 100 };
        try { emailStats = await emailService.getStats(); } catch { /* table may not exist */ }
        res.json({ ...globalStats, errors: errorStats, emails: emailStats });
    } catch (error) {
        next(error);
    }
});

// ============================================
// Email Tracking Routes
// ============================================

// GET /api/dev/emails — List email logs with filtering
router.get('/emails', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await emailService.listLogs({
            tenantId: req.query.tenantId ? parseIntParam(req.query.tenantId as string, 'tenantId') : undefined,
            status: req.query.status as string,
            emailType: req.query.emailType as string,
            to: req.query.to as string,
            limit: parseIntParam(req.query.limit as string || '50', 'limit'),
            offset: parseIntParam(req.query.offset as string || '0', 'offset'),
        });
        res.json(result);
    } catch {
        // email_logs table may not exist yet — return empty
        res.json({ emails: [], total: 0 });
    }
});

// GET /api/dev/emails/stats — Email delivery statistics
router.get('/emails/stats', requireDeveloper, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const stats = await emailService.getStats();
        res.json(stats);
    } catch {
        // email_logs table may not exist yet — return defaults
        res.json({ total: 0, sent: 0, failed: 0, last24h: 0, failedLast24h: 0, deliveryRate: 100 });
    }
});

// POST /api/dev/emails/:id/retry — Retry a failed email
router.post('/emails/:id/retry', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await emailService.retryFailed(parseIntParam(req.params.id, 'id'));
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/dev/emails/cleanup — Cleanup old email logs
router.delete('/emails/cleanup', requireDeveloper, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const days = req.query.days ? parseIntParam(req.query.days as string, 'days') : 90;
        const deleted = await emailService.cleanup(days);
        res.json({ deleted, message: `Cleaned up email logs older than ${days} days` });
    } catch (error) {
        next(error);
    }
});

export default router;
