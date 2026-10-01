/**
 * Database Retry Utility
 * ──────────────────────────────────────
 * Wraps Prisma operations with automatic retry for transient errors.
 * Critical for 50k+ user deployments where connection pool pressure
 * can cause intermittent P1001/P1008/P2034 failures.
 *
 * Retries up to 3 times with exponential backoff (200ms → 400ms → 800ms).
 */
import { logger } from './logger.js';

const log = logger.child({ module: 'db-retry' });

/** Prisma error codes that are safe to retry */
const RETRYABLE_CODES = new Set([
    'P1001', // Can't reach database server
    'P1002', // Database server reached but timed out
    'P1008', // Operations timed out
    'P1017', // Server has closed the connection
    'P2034', // Transaction failed due to write conflict or deadlock
]);

interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Initial delay in ms before first retry (default: 200) */
    initialDelayMs?: number;
    /** Label for logging (default: 'db-operation') */
    label?: string;
}

/**
 * Execute a database operation with automatic retry on transient errors.
 *
 * @example
 * const users = await withRetry(
 *   () => prisma.user.findMany({ where: { tenantId } }),
 *   { label: 'list-users' }
 * );
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const { maxRetries = 3, initialDelayMs = 200, label = 'db-operation' } = options;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            return await operation();
        } catch (error: unknown) {
            lastError = error;

            const prismaCode = (error as { code?: string })?.code;
            const isRetryable = prismaCode && RETRYABLE_CODES.has(prismaCode);

            if (!isRetryable || attempt > maxRetries) {
                throw error; // Non-retryable or exhausted retries
            }

            const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
            log.warn(
                { label, prismaCode, attempt, maxRetries, delayMs },
                `Transient DB error — retrying in ${delayMs}ms`
            );

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    throw lastError; // Should not reach here, but TypeScript needs it
}
