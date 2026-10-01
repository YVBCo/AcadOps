/**
 * Authenticated Rate Limiters
 * ──────────────────────────────────────
 * Per-user rate limits for authenticated endpoints to prevent
 * abuse via compromised tokens or runaway automation.
 *
 * These complement the global rate limiter (which is per-IP).
 * Uses userId for keying (not req.ip) to avoid IPv6 issues on Render.
 */
import rateLimit from 'express-rate-limit';

/**
 * Standard authenticated endpoint limiter.
 * 100 requests/minute per user — generous for normal usage,
 * blocks automated scraping.
 */
export const authenticatedLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    keyGenerator: (req) => `auth:${req.user?.userId || 'anon'}`,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded. Please slow down.' },
    skip: (req) => req.method === 'OPTIONS',
});

/**
 * Bulk operation limiter — stricter limits for heavy operations.
 * 10 requests/minute per user for bulk marks, attendance, user creation.
 * These endpoints hit the DB hard and must be throttled.
 */
export const bulkOperationLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    keyGenerator: (req) => `bulk:${req.user?.userId || 'anon'}`,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many bulk operations. Please wait before trying again.' },
    skip: (req) => req.method === 'OPTIONS',
});

/**
 * Data export limiter — prevent mass data exfiltration.
 * 5 requests/minute per user for export/download endpoints.
 */
export const exportLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    keyGenerator: (req) => `export:${req.user?.userId || 'anon'}`,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Export rate limit exceeded. Please wait.' },
    skip: (req) => req.method === 'OPTIONS',
});
