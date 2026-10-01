import { UserRole } from '@prisma/client';

// Permission Scopes
export type PermissionScope = 'OWN' | 'ASSIGNED' | 'DEPARTMENT' | 'ALL';

// Action Types
export type PermissionAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'PUBLISH';

// Resource Types (matching our entities)
export type ResourceType =
    | 'USER_PROFILE'
    | 'DEPARTMENT'
    | 'PROGRAM'
    | 'COURSE'
    | 'SEMESTER'
    | 'SUBJECT'
    | 'ENROLLMENT'
    | 'ASSIGNMENT'
    | 'SUBMISSION'
    | 'ATTENDANCE'
    | 'MARKS'
    | 'CERTIFICATE'
    | 'NOTIFICATION'
    | 'AUDIT_LOG';

// Permission definition
interface Permission {
    actions: PermissionAction[];
    scope: PermissionScope;
}

// RBAC Matrix - Strict implementation from the PRD
export const RBAC_MATRIX: Record<UserRole, Partial<Record<ResourceType, Permission>>> = {
    // ============================================
    // STUDENT - Most restricted
    // ============================================
    STUDENT: {
        USER_PROFILE: { actions: ['READ', 'UPDATE'], scope: 'OWN' },
        DEPARTMENT: { actions: ['READ'], scope: 'OWN' },
        PROGRAM: { actions: ['READ'], scope: 'OWN' },
        COURSE: { actions: ['READ'], scope: 'OWN' },
        SUBJECT: { actions: ['READ'], scope: 'OWN' },
        ENROLLMENT: { actions: ['READ'], scope: 'OWN' },
        ASSIGNMENT: { actions: ['READ'], scope: 'OWN' },
        SUBMISSION: { actions: ['CREATE', 'READ', 'UPDATE'], scope: 'OWN' },
        ATTENDANCE: { actions: ['READ'], scope: 'OWN' },
        MARKS: { actions: ['READ'], scope: 'OWN' },
        CERTIFICATE: { actions: ['READ'], scope: 'OWN' },
        NOTIFICATION: { actions: ['READ', 'UPDATE'], scope: 'OWN' },
    },

    // ============================================
    // TEACHER - Scoped to assigned subjects
    // ============================================
    TEACHER: {
        USER_PROFILE: { actions: ['READ', 'UPDATE'], scope: 'OWN' },
        DEPARTMENT: { actions: ['READ'], scope: 'ASSIGNED' },
        PROGRAM: { actions: ['READ'], scope: 'ASSIGNED' },
        COURSE: { actions: ['READ'], scope: 'ASSIGNED' },
        SUBJECT: { actions: ['READ'], scope: 'ASSIGNED' },
        ENROLLMENT: { actions: ['READ'], scope: 'ASSIGNED' },
        ASSIGNMENT: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'ASSIGNED' },
        SUBMISSION: { actions: ['READ', 'UPDATE'], scope: 'ASSIGNED' }, // Grade submissions
        ATTENDANCE: { actions: ['CREATE', 'READ', 'UPDATE'], scope: 'ASSIGNED' },
        MARKS: { actions: ['CREATE', 'READ', 'UPDATE'], scope: 'ASSIGNED' },
        CERTIFICATE: { actions: ['READ'], scope: 'ASSIGNED' },
        NOTIFICATION: { actions: ['CREATE', 'READ'], scope: 'ASSIGNED' },
    },

    // ============================================
    // DEPARTMENT_ADMIN - Scoped to department
    // ============================================
    DEPARTMENT_ADMIN: {
        USER_PROFILE: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'DEPARTMENT' },
        DEPARTMENT: { actions: ['READ'], scope: 'DEPARTMENT' },
        PROGRAM: { actions: ['READ'], scope: 'DEPARTMENT' },
        COURSE: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'DEPARTMENT' },
        SEMESTER: { actions: ['READ'], scope: 'DEPARTMENT' },
        SUBJECT: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'DEPARTMENT' },
        ENROLLMENT: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'DEPARTMENT' },
        ASSIGNMENT: { actions: ['READ'], scope: 'DEPARTMENT' },
        SUBMISSION: { actions: ['READ'], scope: 'DEPARTMENT' },
        ATTENDANCE: { actions: ['READ', 'UPDATE'], scope: 'DEPARTMENT' },
        MARKS: { actions: ['READ', 'PUBLISH'], scope: 'DEPARTMENT' },
        CERTIFICATE: { actions: ['CREATE', 'READ', 'UPDATE'], scope: 'DEPARTMENT' },
        NOTIFICATION: { actions: ['CREATE', 'READ'], scope: 'DEPARTMENT' },
        AUDIT_LOG: { actions: ['READ'], scope: 'DEPARTMENT' },
    },

    // ============================================
    // COE - Controller of Examinations
    // ============================================
    // SPECIAL RESPONSIBILITY: Permanent USN assignment (via /api/coe routes)
    // COE and CLERK are the ONLY roles authorized to assign permanent USNs
    COE: {
        USER_PROFILE: { actions: ['READ', 'UPDATE'], scope: 'OWN' },
        COURSE: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'ALL' },
        PROGRAM: { actions: ['READ'], scope: 'ALL' }, // Needs to seeing programs to map courses
        DEPARTMENT: { actions: ['READ'], scope: 'ALL' },
        SEMESTER: { actions: ['READ'], scope: 'ALL' }, // Needs to align courses to semesters
        MARKS: { actions: ['READ'], scope: 'ALL' }, // Viewing final internal marks
        AUDIT_LOG: { actions: ['READ'], scope: 'ALL' },
    },

    // ============================================
    // CLERK - Data Entry (under COE authority)
    // ============================================
    // SPECIAL RESPONSIBILITY: Permanent USN assignment (via /api/coe routes)
    // Works under COE supervision to assign permanent USNs to students
    CLERK: {
        USER_PROFILE: { actions: ['READ', 'UPDATE'], scope: 'OWN' },
        COURSE: { actions: ['READ'], scope: 'ALL' }, // View courses for marks entry
        DEPARTMENT: { actions: ['READ'], scope: 'ALL' }, // View departments for context
        MARKS: { actions: ['CREATE', 'READ', 'UPDATE'], scope: 'ASSIGNED' }, // Semester-end & revaluation marks
    },

    // ============================================
    // SUPER_ADMIN - Full access (EXCEPT Courses)
    // ============================================
    SUPER_ADMIN: {
        USER_PROFILE: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'ALL' },
        DEPARTMENT: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'ALL' },
        PROGRAM: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'ALL' },
        COURSE: { actions: ['READ'], scope: 'ALL' }, // RESTRICTED: Read only
        SEMESTER: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'ALL' },
        SUBJECT: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'ALL' },
        ENROLLMENT: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'ALL' },
        ASSIGNMENT: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'ALL' },
        SUBMISSION: { actions: ['READ', 'UPDATE'], scope: 'ALL' },
        ATTENDANCE: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'ALL' },
        MARKS: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'PUBLISH'], scope: 'ALL' },
        CERTIFICATE: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'ALL' },
        NOTIFICATION: { actions: ['CREATE', 'READ', 'UPDATE', 'DELETE'], scope: 'ALL' },
        AUDIT_LOG: { actions: ['READ'], scope: 'ALL' },
    },

    // ============================================
    // ADMISSIONS_ADMIN - Student admissions authority
    // ============================================
    // NOTE: Permanent USN assignment is NOT included here.
    // Permanent USN assignment is restricted to COE and CLERK roles via /api/coe routes.
    // Admissions Admin can:
    // - Manage admission entries (create, review, approve/reject)
    // - Close/reopen department admissions (triggers temp USN allocation)
    // - Assign TEMPORARY USNs (automatically via department closure)
    // Admissions Admin CANNOT:
    // - Assign permanent USNs (COE/CLERK only)
    ADMISSIONS_ADMIN: {
        USER_PROFILE: { actions: ['CREATE', 'READ', 'UPDATE'], scope: 'ALL' },
        DEPARTMENT: { actions: ['READ'], scope: 'ALL' },
        PROGRAM: { actions: ['READ'], scope: 'ALL' },
        COURSE: { actions: ['READ'], scope: 'ALL' },
        SEMESTER: { actions: ['READ'], scope: 'ALL' },
        NOTIFICATION: { actions: ['CREATE', 'READ'], scope: 'ALL' },
        AUDIT_LOG: { actions: ['READ'], scope: 'ALL' },
    },

    // ============================================
    // ADMIN_CLERK - Data entry under Admissions Admin
    // ============================================
    ADMIN_CLERK: {
        USER_PROFILE: { actions: ['READ', 'UPDATE'], scope: 'OWN' },
        DEPARTMENT: { actions: ['READ'], scope: 'ALL' },
        PROGRAM: { actions: ['READ'], scope: 'ALL' },
        NOTIFICATION: { actions: ['READ'], scope: 'OWN' },
    },

    // ============================================
    // FIRST_YEAR_COORDINATOR - First year cycle management
    // ============================================
    FIRST_YEAR_COORDINATOR: {
        USER_PROFILE: { actions: ['READ', 'UPDATE'], scope: 'ASSIGNED' }, // First year students only
        DEPARTMENT: { actions: ['READ'], scope: 'ALL' },
        COURSE: { actions: ['READ'], scope: 'ASSIGNED' },
        SEMESTER: { actions: ['READ'], scope: 'ALL' },
        NOTIFICATION: { actions: ['CREATE', 'READ'], scope: 'ASSIGNED' },
        AUDIT_LOG: { actions: ['READ'], scope: 'ASSIGNED' }, // Logs from cycle departments (PHY/CHEM/MATH)
    },

    // ============================================
    // PARENT - Read-only access to linked student data
    // ============================================
    PARENT: {
        USER_PROFILE: { actions: ['READ', 'UPDATE'], scope: 'OWN' },
        ATTENDANCE: { actions: ['READ'], scope: 'OWN' },
        MARKS: { actions: ['READ'], scope: 'OWN' },
        NOTIFICATION: { actions: ['READ'], scope: 'OWN' },
    },

    // ============================================
    // NEW ROLES
    // ============================================
    LIBRARIAN: {
        USER_PROFILE: { actions: ['READ', 'UPDATE'], scope: 'OWN' },
    },
    PRINCIPAL: {
        USER_PROFILE: { actions: ['READ'], scope: 'ALL' },
        DEPARTMENT: { actions: ['READ'], scope: 'ALL' },
    },
    ACCOUNTS_STAFF: {
        USER_PROFILE: { actions: ['READ', 'UPDATE'], scope: 'OWN' },
    },
    PLACEMENT_COMPANY: {
        USER_PROFILE: { actions: ['READ', 'UPDATE'], scope: 'OWN' },
    },
};

// ... (rest of the file)

// Roles that can manage semesters (open/close)
export const SEMESTER_MANAGERS: UserRole[] = ['SUPER_ADMIN', 'COE']; // COE might need this later, but for now SUPER_ADMIN. Let's keep strict.

// Roles that can finalize grades
export const GRADE_PUBLISHERS: UserRole[] = ['DEPARTMENT_ADMIN', 'SUPER_ADMIN', 'COE'];

// Roles that can verify certificates
export const CERTIFICATE_VERIFIERS: UserRole[] = ['DEPARTMENT_ADMIN', 'SUPER_ADMIN', 'COE'];

// Helper functions
export function hasPermission(
    role: UserRole,
    resource: ResourceType,
    action: PermissionAction
): boolean {
    const rolePermissions = RBAC_MATRIX[role];
    if (!rolePermissions) return false;

    const resourcePermissions = rolePermissions[resource];
    if (!resourcePermissions) return false;

    return resourcePermissions.actions.includes(action);
}

export function getPermissionScope(
    role: UserRole,
    resource: ResourceType
): PermissionScope | null {
    const rolePermissions = RBAC_MATRIX[role];
    if (!rolePermissions) return null;

    const resourcePermissions = rolePermissions[resource];
    return resourcePermissions ? resourcePermissions.scope : null;
}

