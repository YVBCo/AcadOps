/**
 * Mentor Module — Barrel Export
 * ──────────────────────────────────────
 * Re-exports domain-specific sub-services AND provides a unified
 * backward-compatible `mentorService` facade.
 */

// ── Domain-specific exports ──────────────────────────────────────
export { mentorAssignmentService } from './mentor-assignment.service.js';
export { mentorDashboardService } from './mentor-dashboard.service.js';

// ── Shared utilities ─────────────────────────────────────────────
export { studentUsnWhere, getMentorTeacherProfile, verifyMentorStudentAccess } from './shared.js';

// ── Backward-compatible facade ───────────────────────────────────
import { mentorAssignmentService } from './mentor-assignment.service.js';
import { mentorDashboardService } from './mentor-dashboard.service.js';

export const mentorService = {
    // ── Assignment admin (Dept Admin) ────────────────────────────
    assignMentor: mentorAssignmentService.assignMentor.bind(mentorAssignmentService),
    getMentorAssignments: mentorAssignmentService.getMentorAssignments.bind(mentorAssignmentService),
    getMentorAssignmentHistory: mentorAssignmentService.getMentorAssignmentHistory.bind(mentorAssignmentService),
    expireMentorAssignment: mentorAssignmentService.expireMentorAssignment.bind(mentorAssignmentService),
    expireForSemester: mentorAssignmentService.expireForSemester.bind(mentorAssignmentService),

    // ── Marks approval ───────────────────────────────────────────
    getPendingApprovals: mentorAssignmentService.getPendingApprovals.bind(mentorAssignmentService),
    approveMarks: mentorAssignmentService.approveMarks.bind(mentorAssignmentService),
    rejectMarks: mentorAssignmentService.rejectMarks.bind(mentorAssignmentService),
    updateMarksAsMentor: mentorAssignmentService.updateMarksAsMentor.bind(mentorAssignmentService),
    getMentorTrackingSummary: mentorAssignmentService.getMentorTrackingSummary.bind(mentorAssignmentService),

    // ── Mentor dashboard (Teacher as Mentor) ─────────────────────
    isMentor: mentorDashboardService.isMentor.bind(mentorDashboardService),
    getMentorProfile: mentorDashboardService.getMentorProfile.bind(mentorDashboardService),
    getAssignedStudents: mentorDashboardService.getAssignedStudents.bind(mentorDashboardService),
    getStudentProfile: mentorDashboardService.getStudentProfile.bind(mentorDashboardService),
    getStudentAcademicPerformance: mentorDashboardService.getStudentAcademicPerformance.bind(mentorDashboardService),
    getStudentAttendance: mentorDashboardService.getStudentAttendance.bind(mentorDashboardService),

    // ── Observations & Interactions ──────────────────────────────
    recordObservation: mentorDashboardService.recordObservation.bind(mentorDashboardService),
    getObservations: mentorDashboardService.getObservations.bind(mentorDashboardService),
    logStudentInteraction: mentorDashboardService.logStudentInteraction.bind(mentorDashboardService),
    logParentInteraction: mentorDashboardService.logParentInteraction.bind(mentorDashboardService),
    getInteractions: mentorDashboardService.getInteractions.bind(mentorDashboardService),
    
    // ── Parent Password ──────────────────────────────────────────
    changeParentPassword: mentorDashboardService.changeParentPassword.bind(mentorDashboardService),
};
