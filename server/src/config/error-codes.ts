/**
 * Structured Error Codes — for programmatic frontend handling.
 * 
 * Usage: throw ApiError.fromCode('ACCOUNT_LOCKED', { retryAfter: 900 })
 */

export const ERROR_CODES = {
    // ─── Authentication ──────────────────────────────────────
    INVALID_CREDENTIALS: { status: 401, message: 'Invalid email/roll number or password' },
    ACCOUNT_LOCKED: { status: 423, message: 'Account is temporarily locked due to too many failed login attempts' },
    ACCOUNT_DEACTIVATED: { status: 403, message: 'Account has been deactivated. Contact your administrator.' },
    TOKEN_EXPIRED: { status: 401, message: 'Session expired. Please login again.' },
    TOKEN_REVOKED: { status: 401, message: 'Token has been revoked. Please login again.' },
    AUTH_REQUIRED: { status: 401, message: 'Authentication required' },

    // ─── Authorization ───────────────────────────────────────
    FORBIDDEN: { status: 403, message: 'You do not have permission to perform this action' },
    TENANT_INACTIVE: { status: 403, message: 'Your institution is inactive. Contact support.' },
    TENANT_REQUIRED: { status: 403, message: 'Tenant context is required' },
    WRONG_TENANT: { status: 404, message: 'Resource not found' }, // Don't reveal cross-tenant info

    // ─── Validation ──────────────────────────────────────────
    VALIDATION_FAILED: { status: 400, message: 'Validation failed' },
    INVALID_INPUT: { status: 400, message: 'Invalid input data' },
    DUPLICATE_ENTRY: { status: 409, message: 'A record with this data already exists' },

    // ─── Resources ───────────────────────────────────────────
    NOT_FOUND: { status: 404, message: 'Resource not found' },
    CONFLICT: { status: 409, message: 'Resource conflict' },

    // ─── Rate Limiting ───────────────────────────────────────
    RATE_LIMITED: { status: 429, message: 'Too many requests. Please try again later.' },

    // ─── Server ──────────────────────────────────────────────
    INTERNAL_ERROR: { status: 500, message: 'An internal server error occurred' },
    SERVICE_UNAVAILABLE: { status: 503, message: 'Service temporarily unavailable' },

    // ─── Data Integrity ──────────────────────────────────────
    SEMESTER_LOCKED: { status: 403, message: 'This semester is locked and cannot be modified' },
    MARKS_FINALIZED: { status: 403, message: 'Marks have been finalized and cannot be edited' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface StructuredError {
    code: ErrorCode;
    message: string;
    details?: unknown;
    retryAfter?: number;
}

/**
 * Create a structured error response body.
 */
export function createErrorResponse(
    code: ErrorCode,
    overrides?: { message?: string; details?: unknown; retryAfter?: number }
): StructuredError {
    const base = ERROR_CODES[code];
    const result: StructuredError = {
        code,
        message: overrides?.message ?? base.message,
    };
    if (overrides?.details) result.details = overrides.details;
    if (overrides?.retryAfter) result.retryAfter = overrides.retryAfter;
    return result;
}
