/**
 * Request ID Middleware
 * ──────────────────────────────────────
 * Generates a unique UUID for every incoming request and attaches it to:
 *   1. req.requestId — available in all route handlers
 *   2. X-Request-Id response header — returned to clients for support tickets
 *   3. req.log — scoped child logger with request context
 *
 * If the client sends an X-Request-Id header, we reuse it (for distributed tracing).
 *
 * NOTE: Request type extensions are declared in auth.middleware.ts (single source).
 */
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger.js';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Use client-provided ID or generate a new one
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();

    // Attach to request object
    req.requestId = requestId;

    // Set response header for client correlation
    res.setHeader('X-Request-Id', requestId);

    // Create a child logger scoped to this request
    req.log = logger.child({
        requestId,
        method: req.method,
        path: req.path,
    });

    next();
}
