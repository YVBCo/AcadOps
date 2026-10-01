import { Request, Response, NextFunction } from 'express';
import cacheService, { CacheTTL } from '../../services/cache.service.js';
import { tenantService } from '../../services/tenant.service.js';

export function isModuleEnabled(enabledModules: Record<string, any>, path: string): boolean {
    if (!enabledModules || Object.keys(enabledModules).length === 0) {
        return true;
    }

    const parts = path.split('.');
    let current = enabledModules;

    for (const part of parts) {
        if (current && typeof current === 'object' && current._enabled === false) {
            return false;
        }

        if (current && typeof current === 'object' && part in current) {
            current = current[part];
        } else {
            return true;
        }
    }

    if (typeof current === 'boolean') {
        return current;
    }
    
    if (current && typeof current === 'object' && current._enabled === false) {
        return false;
    }

    return true;
}

export const checkModuleAccess = (modulePath: string) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const tenantId = req.tenantId;
        if (!tenantId) {
            res.status(403).json({ error: 'Tenant context required' });
            return;
        }

        try {
            const cacheKey = `tenant:modules:${tenantId}`;
            let enabledModules = await cacheService.get<Record<string, any>>(cacheKey);

            if (!enabledModules) {
                enabledModules = await tenantService.getModules(tenantId);
                await cacheService.set(cacheKey, enabledModules || {}, CacheTTL.SHORT);
            }

            if (!isModuleEnabled(enabledModules || {}, modulePath)) {
                res.status(403).json({ error: 'This feature is not enabled for your institution', module: modulePath });
                return;
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};
