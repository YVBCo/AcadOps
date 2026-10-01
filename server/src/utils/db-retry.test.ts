/**
 * Database Retry Utility — Unit Tests
 * ──────────────────────────────────────
 * Tests exponential backoff retry logic for transient Prisma errors.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('./logger.js', () => ({
    logger: {
        child: () => ({
            info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(),
        }),
    },
}));

import { withRetry } from './db-retry.js';

describe('withRetry', () => {
    it('should return result on first success', async () => {
        const fn = vi.fn().mockResolvedValue('success');
        const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 10 });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on P1001 (connection refused) and succeed', async () => {
        const error = new Error('Connection refused');
        (error as any).code = 'P1001';

        const fn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockRejectedValueOnce(error)
            .mockResolvedValue('recovered');

        const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 10 });

        expect(result).toBe('recovered');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should retry on P2034 (transaction conflict) and succeed', async () => {
        const error = new Error('Transaction conflict');
        (error as any).code = 'P2034';

        const fn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockResolvedValue('ok');

        const result = await withRetry(fn, { maxRetries: 3, initialDelayMs: 10 });

        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry non-transient errors', async () => {
        const error = new Error('Unique constraint violation');
        (error as any).code = 'P2002';

        const fn = vi.fn().mockRejectedValue(error);

        await expect(withRetry(fn, { maxRetries: 3, initialDelayMs: 10 })).rejects.toThrow(
            'Unique constraint violation'
        );
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should throw after exhausting all retries', async () => {
        const error = new Error('Connection lost');
        (error as any).code = 'P1001';

        const fn = vi.fn().mockRejectedValue(error);

        await expect(withRetry(fn, { maxRetries: 2, initialDelayMs: 10 })).rejects.toThrow(
            'Connection lost'
        );
        // 1 initial + 2 retries = 3 total
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should handle non-Error thrown values', async () => {
        const fn = vi.fn().mockRejectedValue('string error');

        await expect(withRetry(fn, { maxRetries: 2, initialDelayMs: 10 })).rejects.toBe(
            'string error'
        );
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
