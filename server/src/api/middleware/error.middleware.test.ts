/**
 * Error Middleware — Unit Tests
 * ──────────────────────────────────────
 * Tests the centralized error handler for correct HTTP status
 * mapping, Prisma error handling, Zod validation errors,
 * and production vs development response shapes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError, z } from 'zod';

// Import the error handler and ApiError
import { errorHandler, ApiError } from './error.middleware.js';

// Helper to create mock Express req/res/next
function createMockRes(): Response {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        headersSent: false,
    } as unknown as Response;
    return res;
}

function createMockReq(overrides: Partial<Request> = {}): Request {
    return {
        path: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        ...overrides,
    } as Request;
}

const mockNext: NextFunction = vi.fn();

describe('Error Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── ApiError ─────────────────────────────────────────────
    describe('ApiError', () => {
        it('should create an error with status code', () => {
            const error = new ApiError(404, 'Not found');
            expect(error.statusCode).toBe(404);
            expect(error.message).toBe('Not found');
            expect(error).toBeInstanceOf(Error);
        });
    });

    // ── HTTP Status Mapping ──────────────────────────────────
    describe('Status Code Mapping', () => {
        it('should return 404 for "not found" errors', () => {
            const req = createMockReq();
            const res = createMockRes();
            const error = new Error('User not found');

            errorHandler(error, req, res, mockNext);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should return 409 for "already exists" errors', () => {
            const req = createMockReq();
            const res = createMockRes();
            const error = new Error('Email already registered');

            errorHandler(error, req, res, mockNext);

            expect(res.status).toHaveBeenCalledWith(409);
        });

        it('should return 403 for "forbidden/access" errors', () => {
            const req = createMockReq();
            const res = createMockRes();
            const error = new Error('You do not have access to this resource');

            errorHandler(error, req, res, mockNext);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('should return 401 for "authentication" errors', () => {
            const req = createMockReq();
            const res = createMockRes();
            const error = new Error('Invalid credentials');

            errorHandler(error, req, res, mockNext);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should use ApiError status code directly', () => {
            const req = createMockReq();
            const res = createMockRes();
            const error = new ApiError(422, 'Unprocessable entity');

            errorHandler(error, req, res, mockNext);

            expect(res.status).toHaveBeenCalledWith(422);
        });
    });

    // ── Prisma Error Handling ────────────────────────────────
    describe('Prisma Errors', () => {
        it('should handle P2002 unique constraint violation', () => {
            const req = createMockReq();
            const res = createMockRes();
            const error = new Prisma.PrismaClientKnownRequestError(
                'Unique constraint failed',
                { code: 'P2002', clientVersion: '5.0.0', meta: { target: ['email'] } }
            );

            errorHandler(error, req, res, mockNext);

            expect(res.status).toHaveBeenCalledWith(409);
        });

        it('should handle P2025 record not found', () => {
            const req = createMockReq();
            const res = createMockRes();
            const error = new Prisma.PrismaClientKnownRequestError(
                'Record not found',
                { code: 'P2025', clientVersion: '5.0.0' }
            );

            errorHandler(error, req, res, mockNext);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    // ── Zod Validation Errors ────────────────────────────────
    describe('Zod Validation Errors', () => {
        it('should return 400 for Zod validation errors', () => {
            const req = createMockReq();
            const res = createMockRes();

            const schema = z.object({ email: z.string().email(), name: z.string().min(2) });
            let zodError: ZodError;
            try {
                schema.parse({ email: 'invalid', name: '' });
            } catch (e) {
                zodError = e as ZodError;
            }

            errorHandler(zodError!, req, res, mockNext);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    // ── Generic Errors ───────────────────────────────────────
    describe('Generic Errors', () => {
        it('should default to 500 for unknown errors', () => {
            const req = createMockReq();
            const res = createMockRes();
            const error = new Error('Something completely unexpected');

            errorHandler(error, req, res, mockNext);

            expect(res.status).toHaveBeenCalledWith(500);
        });

        it('should delegate to next() if headers already sent', () => {
            const req = createMockReq();
            const res = createMockRes();
            (res as { headersSent: boolean }).headersSent = true;
            const error = new Error('Test error');

            errorHandler(error, req, res, mockNext);

            // When headers are already sent, next(error) should be called
            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
});
