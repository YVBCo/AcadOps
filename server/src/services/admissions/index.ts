/**
 * Admissions Module — Barrel Export
 * ──────────────────────────────────────
 * Re-exports all domain-specific sub-services AND provides a unified
 * backward-compatible `admissionsService` facade so existing routes
 * continue to work without modification.
 *
 * Migration path:
 *   1. New code imports domain-specific services directly
 *   2. Old routes keep using `admissionsService.xxx()`
 *   3. Once all routes are migrated, remove the facade
 */

// ── Domain-specific exports (prefer these for new code) ──────────
export { admissionCoreService } from './admission-core.service.js';
export { admissionUsnService } from './admission-usn.service.js';
export { admissionBulkService } from './admission-bulk.service.js';
export { admissionQueryService } from './admission-query.service.js';

// ── Shared types & utilities ─────────────────────────────────────
export {
    TEMPLATE_HEADERS,
    type ParsedStudentRow,
    type CreateAdmissionInput,
    branchToCode,
    generateAdmissionId,
    generateTemporaryUsn,
    generateLateralTemporaryUsn,
    resolveUniqueEmail,
    generatePassword,
} from './shared.js';

// ── Backward-compatible facade ───────────────────────────────────
// This object delegates every method to the correct sub-service,
// so existing `admissionsService.createAdmission(...)` calls work unchanged.
import { admissionCoreService } from './admission-core.service.js';
import { admissionUsnService } from './admission-usn.service.js';
import { admissionBulkService } from './admission-bulk.service.js';
import { admissionQueryService } from './admission-query.service.js';

export const admissionsService = {
    // ── Core CRUD lifecycle ─────────────────────────────────────
    createAdmission: admissionCoreService.createAdmission.bind(admissionCoreService),
    updateAdmission: admissionCoreService.updateAdmission.bind(admissionCoreService),
    submitAdmission: admissionCoreService.submitAdmission.bind(admissionCoreService),
    reviewAdmission: admissionCoreService.reviewAdmission.bind(admissionCoreService),

    // ── USN allocation & department management ──────────────────
    closeAdmissionsForDepartment: admissionUsnService.closeAdmissionsForDepartment.bind(admissionUsnService),
    reopenAdmissionsForDepartment: admissionUsnService.reopenAdmissionsForDepartment.bind(admissionUsnService),
    getDepartmentAdmissionStatus: admissionUsnService.getDepartmentAdmissionStatus.bind(admissionUsnService),
    assignPermanentUsn: admissionUsnService.assignPermanentUsn.bind(admissionUsnService),

    // ── Queries, dashboard, admin clerks ─────────────────────────
    getApprovedStudents: admissionQueryService.getApprovedStudents.bind(admissionQueryService),
    getAdmissions: admissionQueryService.getAdmissions.bind(admissionQueryService),
    getAdmissionById: admissionQueryService.getAdmissionById.bind(admissionQueryService),
    createAdminClerk: admissionQueryService.createAdminClerk.bind(admissionQueryService),
    getAdminClerks: admissionQueryService.getAdminClerks.bind(admissionQueryService),
    getDashboardStats: admissionQueryService.getDashboardStats.bind(admissionQueryService),

    // ── Student info editing & branch change ─────────────────────
    updateStudentInfo: admissionQueryService.updateStudentInfo.bind(admissionQueryService),
    createEditRequest: admissionQueryService.createEditRequest.bind(admissionQueryService),
    getEditRequests: admissionQueryService.getEditRequests.bind(admissionQueryService),
    approveEditRequest: admissionQueryService.approveEditRequest.bind(admissionQueryService),
    rejectEditRequest: admissionQueryService.rejectEditRequest.bind(admissionQueryService),
    changeBranch: admissionQueryService.changeBranch.bind(admissionQueryService),

    // ── Bulk upload (Excel) ──────────────────────────────────────
    parseStudentExcel: admissionBulkService.parseStudentExcel.bind(admissionBulkService),
    bulkCreateApprovedStudents: admissionBulkService.bulkCreateApprovedStudents.bind(admissionBulkService),
    generateTemplate: admissionBulkService.generateTemplate.bind(admissionBulkService),

    // ── Public form helpers ──────────────────────────────────────
    resolveTenantAndSystemUser: admissionQueryService.resolveTenantAndSystemUser.bind(admissionQueryService),
};
