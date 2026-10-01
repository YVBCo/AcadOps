import { Router, Request, Response, NextFunction } from 'express';
import { auditLogRepository } from '../../data-access/audit-log.repository.js';
import { prisma } from '../../data-access/prisma.js';
import { authenticate, superAdminOnly, requireRole } from '../middleware/auth.middleware.js';
import { parseIntParam } from '../../utils/param-utils.js';

const router = Router();

/**
 * Roles that have audit log access, following the organisational hierarchy:
 *
 *   Super Admin      → ALL logs in the tenant (every role)
 *   COE              → CLERK logs
 *   Admissions Admin → ADMIN_CLERK logs
 *   Department Admin → TEACHER logs (within their department)
 *   FY Coordinator   → logs from users in cycle departments (PHY/CHEM/MATH)
 */
const AUDIT_LOG_ROLES = [
    'SUPER_ADMIN',
    'COE',
    'ADMISSIONS_ADMIN',
    'DEPARTMENT_ADMIN',
    'FIRST_YEAR_COORDINATOR',
] as const;

// GET /api/audit-logs - Get audit logs (hierarchical access per role)
router.get('/', authenticate, requireRole(...AUDIT_LOG_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            page = '1',
            limit = '50',
            actorId,
            entityType,
            action,
            startDate,
            endDate,
        } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = Math.min(parseInt(limit as string), 100); // Max 100 per page
        const skip = (pageNum - 1) * limitNum;

        let result: { logs: unknown[]; total: number };
        const user = req.user!;

        switch (user.role) {
            // ── Super Admin: ALL logs in the tenant ──────────────────────
            case 'SUPER_ADMIN': {
                result = await auditLogRepository.findAll({
                    skip,
                    take: limitNum,
                    actorId: actorId ? parseInt(actorId as string) : undefined,
                    entityType: entityType as string | undefined,
                    action: action as string | undefined,
                    startDate: startDate ? new Date(startDate as string) : undefined,
                    endDate: endDate ? new Date(endDate as string) : undefined,
                    // No actorRole filter → sees ALL roles
                });
                break;
            }

            // ── COE: Only CLERK logs ─────────────────────────────────────
            case 'COE': {
                result = await auditLogRepository.findAll({
                    skip,
                    take: limitNum,
                    actorId: actorId ? parseInt(actorId as string) : undefined,
                    entityType: entityType as string | undefined,
                    action: action as string | undefined,
                    startDate: startDate ? new Date(startDate as string) : undefined,
                    endDate: endDate ? new Date(endDate as string) : undefined,
                    actorRole: 'CLERK', // Hierarchy: COE → Clerk
                });
                break;
            }

            // ── Admissions Admin: Only ADMIN_CLERK logs ──────────────────
            case 'ADMISSIONS_ADMIN': {
                result = await auditLogRepository.findAll({
                    skip,
                    take: limitNum,
                    actorId: actorId ? parseInt(actorId as string) : undefined,
                    entityType: entityType as string | undefined,
                    action: action as string | undefined,
                    startDate: startDate ? new Date(startDate as string) : undefined,
                    endDate: endDate ? new Date(endDate as string) : undefined,
                    actorRole: 'ADMIN_CLERK', // Hierarchy: Admissions Admin → Admin Clerk
                });
                break;
            }

            // ── Department Admin: Only TEACHER logs within their department
            case 'DEPARTMENT_ADMIN': {
                if (!user.departmentId) {
                    res.status(403).json({ error: 'Department Admin has no department assigned' });
                    return;
                }
                result = await auditLogRepository.findByDepartment(user.departmentId, {
                    skip,
                    take: limitNum,
                    actorRole: 'TEACHER', // Hierarchy: Dept Admin → Teacher
                });
                break;
            }

            // ── FY Coordinator: Logs from cycle department users (PHY/CHEM/MATH)
            case 'FIRST_YEAR_COORDINATOR': {
                // Get all cycle (basic science) departments
                const cycleDepts = await prisma.department.findMany({
                    where: { isCycleDepartment: true },
                    select: { id: true },
                });
                const cycleDeptIds = cycleDepts.map(d => d.id);

                if (cycleDeptIds.length === 0) {
                    result = { logs: [], total: 0 };
                    break;
                }

                // Get all users in those cycle departments
                const cycleUsers = await prisma.user.findMany({
                    where: { departmentId: { in: cycleDeptIds } },
                    select: { id: true },
                });
                const cycleUserIds = cycleUsers.map(u => u.id);

                if (cycleUserIds.length === 0) {
                    result = { logs: [], total: 0 };
                    break;
                }

                result = await auditLogRepository.findByActorIds(cycleUserIds, {
                    skip,
                    take: limitNum,
                    action: action as string | undefined,
                    startDate: startDate ? new Date(startDate as string) : undefined,
                    endDate: endDate ? new Date(endDate as string) : undefined,
                });
                break;
            }

            default: {
                res.status(403).json({ error: 'Insufficient permissions for audit logs' });
                return;
            }
        }

        const { logs, total } = result;

        res.json({
            logs,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/audit-logs/entity/:entityType/:entityId - Get logs for a specific entity
router.get('/entity/:entityType/:entityId', authenticate, requireRole(...AUDIT_LOG_ROLES), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const entityType = req.params.entityType as string;
        const entityId = req.params.entityId as string;
        const logs = await auditLogRepository.findByEntity(entityType, parseInt(entityId));
        res.json(logs);
    } catch (error) {
        next(error);
    }
});

// GET /api/audit-logs/actor/:actorId - Get logs by a specific actor
router.get('/actor/:actorId', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const actorId = parseIntParam(req.params.actorId, 'actorId');
        const { page = '1', limit = '50' } = req.query;

        const pageNum = parseInt(page as string);
        const limitNum = Math.min(parseInt(limit as string), 100);

        const logs = await auditLogRepository.findByActor(actorId, {
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
        });
        res.json(logs);
    } catch (error) {
        next(error);
    }
});

// GET /api/audit-logs/department/:departmentId - Get logs for a department
router.get('/department/:departmentId', authenticate, requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'FIRST_YEAR_COORDINATOR'), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = req.user!;
        const departmentId = parseIntParam(req.params.departmentId, 'departmentId');

        // Dept Admin can only view their own department's logs
        if (user.role === 'DEPARTMENT_ADMIN' && user.departmentId !== departmentId) {
            res.status(403).json({ error: 'Cannot view logs from another department' });
            return;
        }

        // FY Coordinator can only view cycle department logs
        if (user.role === 'FIRST_YEAR_COORDINATOR') {
            const dept = await prisma.department.findUnique({
                where: { id: departmentId },
                select: { isCycleDepartment: true },
            });
            if (!dept?.isCycleDepartment) {
                res.status(403).json({ error: 'First Year Coordinator can only view cycle department logs' });
                return;
            }
        }

        const { page = '1', limit = '50' } = req.query;
        const pageNum = parseInt(page as string);
        const limitNum = Math.min(parseInt(limit as string), 100);

        const logs = await auditLogRepository.findByDepartment(departmentId, {
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
        });
        res.json(logs);
    } catch (error) {
        next(error);
    }
});

// GET /api/audit-logs/stats - Get audit log statistics
router.get('/stats', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const stats = await auditLogRepository.getStats();
        res.json(stats);
    } catch (error) {
        next(error);
    }
});

export default router;
