/**
 * Redis Caching Service (Optional - Gracefully Degrades)
 * Optimized for local development and production
 * Works without Redis - simply bypasses caching if unavailable
 */
import { Redis, type RedisOptions } from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'cache' });

// Track Redis availability
let isRedisAvailable = false;
let redis: Redis | null = null;

// Try to connect to Redis, but don't crash if unavailable
try {
    const isTls = config.redis.url.startsWith('rediss://');
    redis = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        connectTimeout: 5000,
        ...(isTls ? { tls: {} } : {}),
        retryStrategy: (times: number) => {
            if (times > 2) {
                log.warn('Redis unavailable — running without cache');
                return null; // Stop retrying
            }
            return Math.min(times * 200, 2000);
        },
    } as RedisOptions);

    redis.on('connect', () => {
        isRedisAvailable = true;
        log.info('Redis connected — caching enabled');
    });

    redis.on('error', (err: any) => {
        isRedisAvailable = false;
        // Only log once, not on every retry
        if (config.server.isDev && err.code !== 'ECONNREFUSED') {
            log.warn({ code: err.code }, 'Redis error (app will work without caching)');
        }
    });

    redis.on('close', () => {
        isRedisAvailable = false;
    });

    // Attempt connection in background - don't block startup
    redis.connect().catch(() => {
        isRedisAvailable = false;
        log.warn('Redis not available — running without cache');
    });
} catch (error) {
    log.warn('Redis initialization failed — running without cache');
    redis = null;
}

// Cache TTL strategies (in seconds)
export const CacheTTL = {
    SHORT: 60,           // 1 minute
    MEDIUM: 300,         // 5 minutes
    LONG: 1800,          // 30 minutes
    VERY_LONG: 3600,     // 1 hour
    DAY: 86400,          // 24 hours
} as const;

// Cache key prefixes
export const CachePrefix = {
    USER: 'user:',
    STUDENT: 'student:',
    TEACHER: 'teacher:',
    DEPARTMENT: 'dept:',
    BATCH: 'batch:',
    COURSE: 'course:',
    SECTION: 'section:',
    MARKS: 'marks:',
    STATS: 'stats:',
    SESSION: 'session:',
} as const;

/**
 * Cache Service Class (Optional - Safe Fallback)
 */
class CacheService {
    // ── Singleflight Map ─────────────────────────────────────────
    // Prevents cache stampede: when N concurrent requests miss the same
    // key, only the FIRST calls fetchFn. All others await its promise.
    private inflight = new Map<string, Promise<unknown>>();
    /**
     * Check if Redis is available
     */
    isAvailable(): boolean {
        return isRedisAvailable && redis !== null;
    }

    /**
     * Get cached data (returns null if Redis unavailable)
     */
    async get<T>(key: string): Promise<T | null> {
        if (!this.isAvailable()) return null;

        try {
            const data = await redis!.get(key);
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch (error) {
            if (config.server.isDev) {
                log.debug({ key }, 'Cache operation error');
            }
            return null;
        }
    }

    /**
     * Set data in cache with TTL (silent fail if Redis unavailable)
     */
    async set(key: string, value: unknown, ttl: number = CacheTTL.MEDIUM): Promise<void> {
        if (!this.isAvailable()) return;

        try {
            await redis!.setex(key, ttl, JSON.stringify(value));
        } catch (error) {
            if (config.server.isDev) {
                log.debug({ key }, 'Cache operation error');
            }
        }
    }

    /**
     * Delete single key
     */
    async delete(key: string): Promise<void> {
        if (!this.isAvailable()) return;

        try {
            await redis!.del(key);
        } catch (error) {
            if (config.server.isDev) {
                log.debug({ key }, 'Cache operation error');
            }
        }
    }

    /**
     * Delete multiple keys matching a pattern (uses SCAN — safe at scale)
     */
    async deletePattern(pattern: string): Promise<void> {
        if (!this.isAvailable()) return;

        try {
            const stream = redis!.scanStream({ match: pattern, count: 100 });
            const pipeline = redis!.pipeline();
            let keyCount = 0;

            await new Promise<void>((resolve, reject) => {
                stream.on('data', (keys: string[]) => {
                    if (keys.length > 0) {
                        keys.forEach((key: string) => pipeline.del(key));
                        keyCount += keys.length;
                    }
                });
                stream.on('end', async () => {
                    if (keyCount > 0) {
                        await pipeline.exec();
                    }
                    resolve();
                });
                stream.on('error', reject);
            });
        } catch (error) {
            if (config.server.isDev) {
                log.debug({ pattern }, 'Cache delete pattern error');
            }
        }
    }

    /**
     * Check if key exists
     */
    async exists(key: string): Promise<boolean> {
        if (!this.isAvailable()) return false;

        try {
            const result = await redis!.exists(key);
            return result === 1;
        } catch (error) {
            return false;
        }
    }

    /**
     * Increment counter (for rate limiting)
     */
    async increment(key: string, ttl?: number): Promise<number> {
        if (!this.isAvailable()) return 0;

        try {
            const value = await redis!.incr(key);
            if (ttl && value === 1) {
                await redis!.expire(key, ttl);
            }
            return value;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get or set pattern - ALWAYS executes fetchFn if cache unavailable
     */
    async getOrSet<T>(
        key: string,
        fetchFn: () => Promise<T>,
        ttl: number = CacheTTL.MEDIUM
    ): Promise<T> {
        // Try to get from cache first (if available)
        if (this.isAvailable()) {
            const cached = await this.get<T>(key);
            if (cached !== null) {
                return cached;
            }
        }

        // ── Singleflight: deduplicate concurrent cache misses ────
        const existing = this.inflight.get(key);
        if (existing) {
            return existing as Promise<T>; // Piggyback on in-flight request
        }

        const promise = fetchFn()
            .then(async (data) => {
                // Store in cache if available (with jitter to prevent synchronized expiry)
                if (this.isAvailable()) {
                    await this.setWithJitter(key, data, ttl);
                }
                return data;
            })
            .finally(() => {
                this.inflight.delete(key); // Clean up regardless of success/failure
            });

        this.inflight.set(key, promise);
        return promise as Promise<T>;
    }

    /**
     * Clear all cache
     */
    async clearAll(): Promise<void> {
        if (!this.isAvailable()) {
            log.warn('Redis not available — cannot clear cache');
            return;
        }

        try {
            await redis!.flushdb();
            log.info('All cache cleared');
        } catch (error) {
            log.error({ err: error }, 'Cache clear all error');
        }
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<{
        available: boolean;
        keys: number;
        memory: string;
        hitRate: string;
    }> {
        if (!this.isAvailable()) {
            return { available: false, keys: 0, memory: 'N/A', hitRate: '0%' };
        }

        try {
            const info = await redis!.info('stats');
            const keyCount = await redis!.dbsize();

            // Parse hit rate
            const hits = info.match(/keyspace_hits:(\d+)/)?.[1] || '0';
            const misses = info.match(/keyspace_misses:(\d+)/)?.[1] || '0';
            const total = parseInt(hits) + parseInt(misses);
            const hitRate = total > 0 ? ((parseInt(hits) / total) * 100).toFixed(2) : '0';

            return {
                available: true,
                keys: keyCount,
                memory: await redis!.info('memory'),
                hitRate: `${hitRate}%`,
            };
        } catch (error) {
            return { available: false, keys: 0, memory: 'N/A', hitRate: '0%' };
        }
    }

    /**
     * Get the raw Redis client (for rate-limit-redis and other integrations)
     */
    getClient(): typeof redis {
        return this.isAvailable() ? redis : null;
    }

    /**
     * Transactional cache invalidation — delete cache keys after a successful write.
     * Prevents stale data when DB write succeeds but cache delete might fail.
     */
    async invalidateOnWrite(keys: string[]): Promise<void> {
        if (!this.isAvailable()) return;
        await Promise.allSettled(
            keys.map(key => this.delete(key))
        );
    }

    /**
     * Set with TTL jitter to prevent cache stampede (thundering herd).
     * Adds ±10% random variation to TTL.
     */
    async setWithJitter(key: string, value: unknown, baseTtl: number): Promise<void> {
        const jitter = Math.floor(baseTtl * 0.1 * (Math.random() * 2 - 1)); // ±10%
        await this.set(key, value, baseTtl + jitter);
    }

    /**
     * Disconnect Redis
     */
    async disconnect(): Promise<void> {
        if (redis) {
            await redis.quit();
            log.info('Redis disconnected');
        }
    }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export helper functions
export const cache = {
    // User cache
    getUserById: (id: number) => cacheService.get(`${CachePrefix.USER}${id}`),
    setUser: (id: number, data: unknown) => cacheService.set(`${CachePrefix.USER}${id}`, data, CacheTTL.MEDIUM),
    deleteUser: (id: number) => cacheService.delete(`${CachePrefix.USER}${id}`),

    // Student cache
    getStudentByUsn: (usn: string) => cacheService.get(`${CachePrefix.STUDENT}usn:${usn}`),
    setStudent: (usn: string, data: unknown) => cacheService.set(`${CachePrefix.STUDENT}usn:${usn}`, data, CacheTTL.MEDIUM),
    deleteStudent: (usn: string) => cacheService.delete(`${CachePrefix.STUDENT}usn:${usn}`),

    // Batch cache
    getBatch: (id: number) => cacheService.get(`${CachePrefix.BATCH}${id}`),
    setBatch: (id: number, data: unknown) => cacheService.set(`${CachePrefix.BATCH}${id}`, data, CacheTTL.LONG),

    // Department cache
    getDepartment: (id: number) => cacheService.get(`${CachePrefix.DEPARTMENT}${id}`),
    setDepartment: (id: number, data: unknown) => cacheService.set(`${CachePrefix.DEPARTMENT}${id}`, data, CacheTTL.VERY_LONG),

    // Course cache
    getCourse: (id: number) => cacheService.get(`${CachePrefix.COURSE}${id}`),
    setCourse: (id: number, data: unknown) => cacheService.set(`${CachePrefix.COURSE}${id}`, data, CacheTTL.LONG),

    // Clear marks cache
    clearMarksCache: () => cacheService.deletePattern(`${CachePrefix.MARKS}*`),
};

export default cacheService;

