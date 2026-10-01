import { Request, Response, NextFunction } from 'express';
import { authService, userService, JwtPayload } from '../../services/index.js';
import { cacheService } from '../../services/cache.service.js';
import { UserRole } from '@prisma/client';
import { hasPermission, getPermissionScope, ResourceType, PermissionAction } from '../../config/index.js';

// Extend Express Request to include user info, request ID, and developer payload
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
            requestId: string;
            log: import('pino').Logger;
            developer?: { developerId: number; email: string; isDeveloper: true };
        }
    }
}

// Authentication middleware - verifies JWT token and validates tokenVersion
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        const token = authHeader.split(' ')[1];
        const payload = authService.verifyToken(token);

        // ─── Token Version Check (revocation) ─────────────────────────
        // Check if the token's version matches the stored version
        // This invalidates tokens after password change, deactivation, etc.
        const cacheKey = `user:tokenver:${payload.userId}`;
        let storedVersion = await cacheService.get<number>(cacheKey);

        if (storedVersion === null) {
            // Cache miss — fetch from DB via service
            const user = await userService.getById(payload.userId);
            if (!user || !user.isActive) {
                res.status(401).json({ error: 'Account deactivated or not found' });
                return;
            }
            storedVersion = user.tokenVersion;
            await cacheService.set(cacheKey, storedVersion, 60); // Cache for 60s
        }

        if (payload.tokenVersion !== undefined && payload.tokenVersion !== storedVersion) {
            res.status(401).json({ error: 'Token revoked. Please login again.' });
            return;
        }

        req.user = payload;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// Role check middleware factory
export const requireRole = (...allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }

        next();
    };
};

// Permission check middleware factory
export const requirePermission = (resource: ResourceType, action: PermissionAction) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }

        if (!hasPermission(req.user.role, resource, action)) {
            res.status(403).json({
                error: 'Insufficient permissions',
                required: { resource, action },
            });
            return;
        }

        next();
    };
};

// Get permission scope for current user and resource
export const getScope = (req: Request, resource: ResourceType) => {
    if (!req.user) return null;
    return getPermissionScope(req.user.role, resource);
};

// Super Admin only middleware
export const superAdminOnly = requireRole('SUPER_ADMIN');

// COE only middleware
export const coeOnly = requireRole('COE');

// Admin only middleware (Dept Admin, Super Admin, or Admissions Admin)
export const adminOnly = requireRole('DEPARTMENT_ADMIN', 'SUPER_ADMIN', 'ADMISSIONS_ADMIN');

// Teacher or above middleware
export const teacherOrAbove = requireRole('TEACHER', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN');

// Admissions Admin only middleware
export const admissionsAdminOnly = requireRole('ADMISSIONS_ADMIN', 'SUPER_ADMIN');

// Admissions staff (Admin + Clerk)
export const admissionsStaff = requireRole('ADMISSIONS_ADMIN', 'ADMIN_CLERK');

// Super Admin or Admissions Admin (for batch management etc.)
export const superOrAdmissionsAdmin = requireRole('SUPER_ADMIN', 'ADMISSIONS_ADMIN');

// Roles that can directly edit student info (with reason for SUPER_ADMIN)
export const studentEditAllowed = requireRole('SUPER_ADMIN', 'ADMISSIONS_ADMIN');

// Roles that can submit edit requests (Clerk + Dept Admin)
export const editRequestors = requireRole('ADMIN_CLERK', 'DEPARTMENT_ADMIN');