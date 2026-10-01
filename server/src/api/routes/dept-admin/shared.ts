/**
 * Dept Admin — Shared Utilities
 * ──────────────────────────────────────
 * Common helper functions used across all dept-admin sub-routers.
 */
import { Request } from 'express';

/**
 * Extract department ID from the authenticated user.
 * Throws if the user is not assigned to a department.
 */
export function getDepartmentId(req: Request): number {
    const user = req.user!;
    if (!user.departmentId) {
        throw new Error('Department Admin must be assigned to a department');
    }
    return user.departmentId;
}
