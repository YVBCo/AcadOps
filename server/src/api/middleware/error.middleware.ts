import { Request, Response, NextFunction } from 'express';
import { systemErrorService } from '../../services/system-error.service.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';
import { ERROR_CODES, type ErrorCode } from '../../config/error-codes.js';

const log = logger.child({ module: 'error-handler' });

// Custom error class for API errors
export class ApiError extends Error {
    public errorCode?: ErrorCode;

    constructor(
        public statusCode: number,
        message: string,
        public details?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
    }

    /**
     * Create an ApiError from a typed error code.
     * Preferred over `new ApiError(status, msg)` — eliminates string-matching in the error handler.
     */
    static fromCode(code: ErrorCode, overrides?: { message?: string; details?: unknown }): ApiError {
        const def = ERROR_CODES[code];
        const err = new ApiError(def.status, overrides?.message ?? def.message, overrides?.details);
        err.errorCode = code;
        return err;
    }
}

// Error handler middleware — logs all errors to SystemError table
export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // If headers are already sent (e.g., streaming response), delegate to Express default handler
    if (res.headersSent) {
        next(err);
        return;
    }

    log.error({
        error: err.message,
        stack: err.stack,
        path: req.originalUrl,
        method: req.method,
    }, 'Request error');

    // Log error to system_errors table (async, non-blocking)
    const tenantId = req.user?.tenantId;
    const userId = req.user?.userId;
    systemErrorService.log({
        tenantId,
        errorCode: err.name === 'PrismaClientKnownRequestError'
            ? `PRISMA_${(err as unknown as { code?: string }).code || 'UNKNOWN'}`
            : err.name || 'UNKNOWN',
        message: err.message || 'Unknown error',
        stack: err.stack,
        endpoint: req.originalUrl,
        method: req.method,
        userId,
        severity: err instanceof ApiError && err.statusCode < 500 ? 'WARNING' : 'ERROR',
    }).catch(() => { }); // Never let error logging fail the response

    if (err instanceof ApiError) {
        res.status(err.statusCode).json({
            error: err.message,
            ...(err.errorCode ? { code: err.errorCode } : {}),
            details: err.details,
        });
        return;
    }

    // Handle Prisma known request errors
    if (err.name === 'PrismaClientKnownRequestError') {
        const prismaError = err as unknown as { code: string; meta?: { target?: string[] } };

        if (prismaError.code === 'P2002') {
            const target = prismaError.meta?.target as string[] | undefined;
            const field = target?.[0];
            // Per-tenant email uniqueness — give a clear message
            const message = (field === 'email' || target?.includes('tenantId_email'))
                ? 'This email is already registered in this institution'
                : 'Resource already exists';
            res.status(409).json({
                error: message,
                field,
            });
            return;
        }

        if (prismaError.code === 'P2025') {
            res.status(404).json({
                error: 'Resource not found',
            });
            return;
        }

        // P2003: Foreign key constraint violation
        if (prismaError.code === 'P2003') {
            res.status(400).json({
                error: 'Referenced record does not exist. Please verify the data and try again.',
            });
            return;
        }
    }

    // Handle Prisma validation errors (bad query shapes, missing fields)
    if (err.name === 'PrismaClientValidationError') {
        log.error({ error: err.message }, 'Prisma validation error — likely a code bug');
        res.status(400).json({
            error: 'Invalid data format',
            message: config.server.isDev ? err.message : undefined,
        });
        return;
    }

    // Handle Prisma initialization / connection errors
    if (err.name === 'PrismaClientInitializationError' || err.name === 'PrismaClientRustPanicError') {
        log.error({ error: err.message }, 'Database connection error');
        res.status(503).json({
            error: 'Database temporarily unavailable. Please try again shortly.',
        });
        return;
    }

    // Handle Zod validation errors
    if (err.name === 'ZodError') {
        res.status(400).json({
            error: 'Validation failed',
            details: err,
        });
        return;
    }

    // Handle common TypeError from null dereference (e.g. reading property of undefined)
    if (err instanceof TypeError && err.message.includes('Cannot read properties of')) {
        log.error({ error: err.message, stack: err.stack }, 'Null dereference in service layer');
        res.status(400).json({
            error: 'Missing or incomplete data. Please ensure all required fields are provided.',
            message: config.server.isDev ? err.message : undefined,
        });
        return;
    }

    // Map well-known service-layer error messages to proper HTTP status codes
    const msg = err.message?.toLowerCase() || '';

    // 401 — Authentication failures
    if (
        msg.includes('invalid credentials') ||
        msg.includes('invalid email or password') ||
        msg.includes('invalid token') ||
        msg.includes('token revoked') ||
        msg.includes('token expired') ||
        msg.includes('refresh token expired') ||
        msg.includes('invalid refresh token') ||
        msg.includes('account is not yet activated') ||
        msg.includes('account has been deactivated') ||
        msg.includes('temporarily locked')
    ) {
        res.status(401).json({ error: err.message });
        return;
    }

    // 404 — Not found
    if (
        msg.includes('not found') ||
        msg.includes('does not exist')
    ) {
        res.status(404).json({ error: err.message });
        return;
    }

    // 403 — Forbidden
    if (
        msg.includes('do not have access') ||
        msg.includes('does not belong to your tenant') ||
        msg.includes('unauthorized') ||
        msg.includes('insufficient permissions')
    ) {
        res.status(403).json({ error: err.message });
        return;
    }

    // 409 — Conflict
    if (
        msg.includes('already exists') ||
        msg.includes('already registered') ||
        msg.includes('already locked') ||
        msg.includes('already submitted') ||
        msg.includes('already graduated') ||
        msg.includes('already closed') ||
        msg.includes('already open') ||
        msg.includes('already been used')
    ) {
        res.status(409).json({ error: err.message });
        return;
    }

    // 400 — Bad request / validation
    if (
        msg.includes('cannot edit') ||
        msg.includes('cannot delete') ||
        msg.includes('cannot remove') ||
        msg.includes('is required') ||
        msg.includes('is missing') ||
        msg.includes('is locked') ||
        msg.includes('only teachers') ||
        msg.includes('profile not found') ||
        msg.includes('must equal') ||
        msg.includes('can only') ||
        msg.includes('password too weak') ||
        msg.includes('current password is incorrect') ||
        msg.includes('must be different') ||
        msg.includes('invalid or expired reset')
    ) {
        res.status(400).json({ error: err.message });
        return;
    }

    // Default error response — genuine 500
    res.status(500).json({
        error: 'Internal server error',
        message: config.server.isDev ? err.message : undefined,
    });
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json({
        error: 'Route not found',
        path: req.path,
    });
};
