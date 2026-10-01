import { ApiError } from '../api/middleware/error.middleware.js';

/**
 * Safely parse a string parameter to an integer.
 * Throws a 400 ApiError if the value is not a valid number.
 */
export function parseIntParam(value: string | string[], name: string = 'parameter'): number {
    const str = Array.isArray(value) ? value[0] : value;
    const parsed = parseInt(str, 10);
    if (isNaN(parsed)) {
        throw new ApiError(400, `Invalid ${name}: must be a number`);
    }
    return parsed;
}

/**
 * Safely parse an optional query string param to an integer.
 * Returns undefined if value is undefined/null.
 */
export function parseOptionalInt(value: string | undefined | null, name: string = 'parameter'): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new ApiError(400, `Invalid ${name}: must be a number`);
    }
    return parsed;
}
