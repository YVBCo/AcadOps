import { Request, Response, NextFunction } from 'express';
import xss from 'xss';

/**
 * XSS Sanitization Middleware
 * Uses the battle-tested `xss` library instead of custom regex patterns.
 * Strips dangerous HTML/script content from all string values in request body and query.
 * Runs after body parsing, before route handlers.
 *
 * Why not custom regex? Custom regex sanitizers are trivially bypassable via:
 *   - <svg/onload=alert(1)>
 *   - <img src=x onerror=alert(1)>
 *   - Mutation XSS via <math><mtext><table><mglyph><style>...
 * The `xss` library handles all known attack vectors including edge cases.
 */

// Configure xss filter options
const xssOptions = {
    whiteList: {},           // Strip ALL HTML tags by default
    stripIgnoreTag: true,    // Strip tags not in whitelist
    stripIgnoreTagBody: ['script', 'style', 'noscript'], // Remove content of these tags entirely
};

function sanitizeString(value: string): string {
    return xss(value, xssOptions);
}

function sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
        return sanitizeString(value);
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value !== null && typeof value === 'object') {
        return sanitizeObject(value as Record<string, unknown>);
    }
    return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeValue(value);
    }
    return sanitized;
}

export const sanitizeRequest = (req: Request, _res: Response, next: NextFunction): void => {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        for (const key of Object.keys(req.query)) {
            const val = req.query[key];
            if (typeof val === 'string') {
                (req.query as Record<string, unknown>)[key] = sanitizeString(val);
            }
        }
    }
    next();
};
