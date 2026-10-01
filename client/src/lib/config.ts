/**
 * Runtime API URL resolution.
 * 
 * Next.js inlines process.env.NEXT_PUBLIC_* at BUILD TIME. If the env var
 * wasn't available during build, it becomes `undefined` and can't be fixed
 * at runtime. This module provides a deterministic fallback.
 * 
 * Strategy:
 * 1. If NEXT_PUBLIC_API_URL was baked in at build time, use it.
 * 2. Default to localhost for local dev.
 * 
 * SECURITY: No runtime overrides (e.g. localStorage) are permitted.
 * Allowing user-controllable API URLs would enable token theft via XSS.
 */

// This value is inlined by Next.js at build time
const BUILD_TIME_URL: string | undefined = process.env.NEXT_PUBLIC_API_URL;

function resolveApiUrl(): string {
    // Build-time URL available → use it
    if (BUILD_TIME_URL) {
        return BUILD_TIME_URL;
    }

    // Default fallback for local development
    return 'http://localhost:4001/api';
}

export const API_URL = resolveApiUrl();

/**
 * Get the server base URL (without /api suffix).
 * Used for image/upload URLs.
 */
export function getServerBaseUrl(): string {
    return API_URL.replace(/\/api$/, '');
}
