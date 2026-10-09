import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger.js';

const log = logger.child({ module: 'cache-middleware' });

/**
 * Standardized cache TTL durations (in seconds).
 * Used by route handlers: cacheResponse({ ttl: CacheDurations.REFERENCE_DATA })
 */
export const CacheDurations = {
    /** Rarely changes: departments, programs, batches, courses (5 min) */
    REFERENCE_DATA: 300,
    /** Changes occasionally: sections, subjects, allocations (2 min) */
    SEMI_STATIC: 120,
    /** Changes frequently: attendance, marks, stats (30 sec) */
    DYNAMIC: 30,
    /** Per-user data: profile, enrolled courses, timetable (1 min) */
    USER_DATA: 60,
} as const;

interface CacheEntry {
    data: any;
    timestamp: number;
    ttl: number;
}

const memoryCache = new Map<string, CacheEntry>();

// Clean expired entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryCache) {
        if (now - entry.timestamp > entry.ttl) {
            memoryCache.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * In-memory response cache middleware.
 * Caches GET responses for the specified TTL (in seconds).
 * Cache keys use the same `api:<tenantId>:<URL>` format accepted by
 * invalidateCache so successful mutations invalidate their tenant's reads.
 *
 * Accepts either a plain number or { ttl: number } for convenience:
 *   cacheResponse(60)  OR  cacheResponse({ ttl: 60 })
 */
export function cacheResponse(options: number | { ttl: number } = 60) {
    const ttlSeconds = typeof options === 'number' ? options : options.ttl;
    return (req: Request, res: Response, next: NextFunction) => {
        if (req.method !== 'GET') {
            next();
            return;
        }

        const tenantId = (req as any).user?.tenantId || 'anon';
        const cacheKey = `api:${tenantId}:${req.originalUrl}`;
        const cached = memoryCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            res.json(cached.data);
            return;
        }

        // Intercept res.json to cache the response
        const originalJson = res.json.bind(res);
        res.json = (body: any) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                memoryCache.set(cacheKey, {
                    data: body,
                    timestamp: Date.now(),
                    ttl: ttlSeconds * 1000,
                });
            }
            return originalJson(body);
        };

        next();
    };
}

/**
 * Invalidate cache entries matching a prefix pattern.
 * Call after mutations (POST/PUT/DELETE) to clear stale data.
 */
export function invalidateCache(pattern: string) {
    const matcher = new RegExp(`^${pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    for (const key of memoryCache.keys()) {
        if (matcher.test(key)) {
            memoryCache.delete(key);
        }
    }
}
