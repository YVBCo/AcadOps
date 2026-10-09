import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheResponse, invalidateCache } from './cache.middleware.js';

function request(url: string, tenantId = 501) {
    return { method: 'GET', originalUrl: url, user: { tenantId } } as any;
}

function response() {
    return { statusCode: 200, json: vi.fn(function (this: any) { return this; }) } as any;
}

function read(url: string, tenantId = 501) {
    const req = request(url, tenantId);
    const res = response();
    const json = res.json;
    const next = vi.fn();
    cacheResponse({ ttl: 300 })(req, res, next);
    return { req, res, json, next };
}

describe('response cache invalidation', () => {
    beforeEach(() => {
        invalidateCache('*');
    });

    it('invalidates a cached course list after course creation', () => {
        const firstRead = read('/api/courses');
        expect(firstRead.next).toHaveBeenCalledOnce();
        firstRead.res.json([]);

        invalidateCache('api:501:/api/courses*');

        const secondRead = read('/api/courses');
        expect(secondRead.next).toHaveBeenCalledOnce();
        expect(secondRead.json).not.toHaveBeenCalled();
    });

    it('supports wildcard query routes and keeps other tenants isolated', () => {
        const courseRead = read('/api/courses?departmentId=12');
        courseRead.res.json([]);
        const otherTenantRead = read('/api/courses', 502);
        otherTenantRead.res.json([]);

        invalidateCache('api:501:/api/courses*');

        const refreshedTenantRead = read('/api/courses?departmentId=12');
        const cachedOtherTenantRead = read('/api/courses', 502);
        expect(refreshedTenantRead.next).toHaveBeenCalledOnce();
        expect(cachedOtherTenantRead.next).not.toHaveBeenCalled();
        expect(cachedOtherTenantRead.json).toHaveBeenCalledWith([]);
    });
});
