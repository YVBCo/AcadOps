/**
 * Request ID Middleware — Unit Tests
 * ──────────────────────────────────────
 * Tests: UUID generation, client-provided ID reuse,
 * response header propagation, and req.log creation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

// Mock the logger
vi.mock('../../utils/logger.js', () => ({
    logger: {
        child: vi.fn(() => ({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        })),
    },
}));

const { requestIdMiddleware } = await import('./request-id.middleware.js');

function createMockReq(headers: Record<string, string> = {}): Request {
    return {
        headers,
        method: 'GET',
        path: '/test',
        user: undefined,
    } as unknown as Request;
}

function createMockRes(): Response {
    const res = {
        setHeader: vi.fn(),
    } as unknown as Response;
    return res;
}

describe('Request ID Middleware', () => {
    let mockNext: NextFunction;

    beforeEach(() => {
        mockNext = vi.fn();
    });

    it('should generate a UUID when no X-Request-Id header is provided', () => {
        const req = createMockReq();
        const res = createMockRes();

        requestIdMiddleware(req, res, mockNext);

        expect(req.requestId).toBeDefined();
        expect(typeof req.requestId).toBe('string');
        // UUID v4 format: 8-4-4-4-12 hex chars
        expect(req.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should reuse client-provided X-Request-Id header', () => {
        const clientId = 'client-trace-id-12345';
        const req = createMockReq({ 'x-request-id': clientId });
        const res = createMockRes();

        requestIdMiddleware(req, res, mockNext);

        expect(req.requestId).toBe(clientId);
    });

    it('should set X-Request-Id response header', () => {
        const req = createMockReq();
        const res = createMockRes();

        requestIdMiddleware(req, res, mockNext);

        expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    });

    it('should attach a scoped child logger to req.log', () => {
        const req = createMockReq();
        const res = createMockRes();

        requestIdMiddleware(req, res, mockNext);

        expect(req.log).toBeDefined();
        expect(typeof req.log.info).toBe('function');
        expect(typeof req.log.error).toBe('function');
    });

    it('should always call next()', () => {
        const req = createMockReq();
        const res = createMockRes();

        requestIdMiddleware(req, res, mockNext);

        expect(mockNext).toHaveBeenCalledOnce();
        expect(mockNext).toHaveBeenCalledWith(); // No error argument
    });
});
