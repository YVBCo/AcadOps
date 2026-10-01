/**
 * Sanitize Middleware — Unit Tests
 * ──────────────────────────────────────
 * Tests: XSS stripping from body, query, nested objects, arrays,
 * and preservation of non-string values.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { sanitizeRequest } from './sanitize.middleware.js';

function createMockReq(body: Record<string, unknown> = {}, query: Record<string, unknown> = {}): Request {
    return { body, query } as unknown as Request;
}

describe('Sanitize Middleware', () => {
    let mockRes: Response;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockRes = {} as Response;
        mockNext = vi.fn();
    });

    it('should strip script tags from body strings', () => {
        const req = createMockReq({
            name: '<script>alert("xss")</script>John',
        });

        sanitizeRequest(req, mockRes, mockNext);

        expect(req.body.name).toBe('John');
        expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should strip img/onerror XSS vectors', () => {
        const req = createMockReq({
            bio: '<img src=x onerror=alert(1)>Hello',
        });

        sanitizeRequest(req, mockRes, mockNext);

        expect(req.body.bio).not.toContain('onerror');
        expect(req.body.bio).toContain('Hello');
    });

    it('should strip SVG-based XSS', () => {
        const req = createMockReq({
            input: '<svg/onload=alert(1)>test',
        });

        sanitizeRequest(req, mockRes, mockNext);

        expect(req.body.input).not.toContain('onload');
    });

    it('should sanitize nested objects', () => {
        const req = createMockReq({
            profile: {
                name: '<b>Bold</b>',
                address: {
                    city: '<script>hack</script>NYC',
                },
            },
        });

        sanitizeRequest(req, mockRes, mockNext);

        const profile = req.body.profile as Record<string, unknown>;
        expect(profile.name).toBe('Bold');
        expect((profile.address as Record<string, unknown>).city).toBe('NYC');
    });

    it('should sanitize arrays of strings', () => {
        const req = createMockReq({
            tags: ['<b>safe</b>', '<script>evil</script>tag'],
        });

        sanitizeRequest(req, mockRes, mockNext);

        const tags = req.body.tags as string[];
        expect(tags[0]).toBe('safe');
        expect(tags[1]).toBe('tag');
    });

    it('should preserve numbers and booleans', () => {
        const req = createMockReq({
            age: 25,
            isActive: true,
            score: 98.5,
        });

        sanitizeRequest(req, mockRes, mockNext);

        expect(req.body.age).toBe(25);
        expect(req.body.isActive).toBe(true);
        expect(req.body.score).toBe(98.5);
    });

    it('should sanitize query parameters', () => {
        const req = createMockReq({}, {
            search: '<script>alert(1)</script>John',
            page: '1',
        });

        sanitizeRequest(req, mockRes, mockNext);

        expect(req.query.search).toBe('John');
        expect(req.query.page).toBe('1'); // Numbers as strings stay clean
    });

    it('should handle empty body gracefully', () => {
        const req = createMockReq();

        sanitizeRequest(req, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should handle null body gracefully', () => {
        const req = { body: null, query: {} } as unknown as Request;

        sanitizeRequest(req, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalledOnce();
    });
});
