import { Request, Response, NextFunction } from 'express';
import cacheService, { CacheTTL } from '../../services/cache.service.js';
import { tenantService } from '../../services/tenant.service.js';

/**
 * Tenant Isolation Middleware
 * 
 * Runs AFTER authenticate middleware.
 * - Validates tenant exists and is active (cached)
 * - Attaches req.tenantId for use in routes
 * - Prevents cross-tenant data access
 */
export const enforceTenant = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
        res.status(403).json({ error: 'Tenant context required' });
        return;
    }

    // Check tenant is active (cached for performance)
    const cacheKey = `tenant:active:${tenantId}`;
    let isActive = await cacheService.get<boolean>(cacheKey);

    if (isActive === null) {
        // Cache miss — check DB via service
        const tenant = await tenantService.getById(tenantId);

        if (!tenant) {
            res.status(403).json({ error: 'Invalid tenant' });
            return;
        }

        isActive = tenant.isActive;
        await cacheService.set(cacheKey, isActive, CacheTTL.MEDIUM);
    }

    if (!isActive) {
        res.status(403).json({ error: 'Tenant is inactive. Contact support.' });
        return;
    }

    // Attach tenantId for downstream use
    req.tenantId = tenantId;
    next();
};

// Extend Express Request
declare global {
    namespace Express {
        interface Request {
            tenantId?: number;
        }
    }
}
