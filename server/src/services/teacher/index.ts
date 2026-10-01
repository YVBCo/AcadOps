/**
 * Teacher Module — Barrel Export
 * ──────────────────────────────────────
 * Re-exports domain-specific sub-services AND provides a unified
 * backward-compatible `teacherService` facade.
 */

// ── Domain-specific exports ──────────────────────────────────────
export { teacherMarksService } from './teacher-marks.service.js';
export { teacherAttendanceService } from './teacher-attendance.service.js';

// ── Shared utilities ─────────────────────────────────────────────
export {
    getTeacherProfile,
    verifyAllocationAccess,
    verifySectionCourseAccess,
    getOrCreateActiveSemester,
} from './shared.js';

// ── Backward-compatible facade ───────────────────────────────────
import prisma from '../../data-access/prisma.js';
import { teacherMarksService } from './teacher-marks.service.js';
import { teacherAttendanceService } from './teacher-attendance.service.js';
import { getTeacherProfile } from './shared.js';
import { cacheService } from '../cache.service.js';
import { CacheTTL, CachePrefix } from '../cache.service.js';

/**
 * Assessment config methods that don't fit neatly into marks or attendance.
 * Kept here to avoid creating a fourth file for just 2 methods.
 */
async function getAssessmentConfig(courseId: number, semesterNumber: number) {
    let config = await prisma.internalAssessmentConfig.findUnique({
        where: {
            courseId_semesterNumber: { courseId, semesterNumber }
        }
    });

    if (!config) {
        return {
            courseId,
            semesterNumber,
            numInternals: 3,
            maxMarksPerInternal: 30,
            internalsToConsider: 2,
            internalWeightage: 30,
            hasAssignment: true,
            numAssignments: 1,
            maxAssignmentMarks: 20,
            assignmentWeightage: 20,
            hasLab: false,
            numLabExams: 0,
            maxLabMarks: 0,
            labWeightage: 0,
            totalMarks: 50,
        };
    }

    return config;
}

async function upsertAssessmentConfig(
    courseId: number,
    semesterNumber: number,
    data: {
        numInternals?: number;
        maxMarksPerInternal?: number;
        internalsToConsider?: number;
        internalWeightage?: number;
        hasAssignment?: boolean;
        numAssignments?: number;
        maxAssignmentMarks?: number;
        assignmentWeightage?: number;
        hasLab?: boolean;
        numLabExams?: number;
        maxLabMarks?: number;
        labWeightage?: number;
    }
) {
    const internalW = data.internalWeightage ?? 30;
    const assignmentW = data.hasAssignment !== false ? (data.assignmentWeightage ?? 20) : 0;
    const labW = data.hasLab ? (data.labWeightage ?? 0) : 0;

    if (internalW + assignmentW + labW !== 50) {
        throw new Error(`Total weightage must equal 50. Current: ${internalW + assignmentW + labW}`);
    }

    return prisma.internalAssessmentConfig.upsert({
        where: {
            courseId_semesterNumber: { courseId, semesterNumber }
        },
        create: {
            courseId, semesterNumber,
            numInternals: data.numInternals ?? 3,
            maxMarksPerInternal: data.maxMarksPerInternal ?? 30,
            internalsToConsider: data.internalsToConsider ?? 2,
            internalWeightage: internalW,
            hasAssignment: data.hasAssignment ?? true,
            numAssignments: data.numAssignments ?? 1,
            maxAssignmentMarks: data.maxAssignmentMarks ?? 20,
            assignmentWeightage: assignmentW,
            hasLab: data.hasLab ?? false,
            numLabExams: data.numLabExams ?? 0,
            maxLabMarks: data.maxLabMarks ?? 0,
            labWeightage: labW,
            totalMarks: 50,
        },
        update: {
            numInternals: data.numInternals,
            maxMarksPerInternal: data.maxMarksPerInternal,
            internalsToConsider: data.internalsToConsider,
            internalWeightage: internalW,
            hasAssignment: data.hasAssignment,
            numAssignments: data.numAssignments,
            maxAssignmentMarks: data.maxAssignmentMarks,
            assignmentWeightage: assignmentW,
            hasLab: data.hasLab,
            numLabExams: data.numLabExams,
            maxLabMarks: data.maxLabMarks,
            labWeightage: labW,
        }
    });
}

function calculateMarksWithConfig(
    config: {
        numInternals: number;
        maxMarksPerInternal: number;
        internalsToConsider: number;
        internalWeightage: number;
        hasAssignment: boolean;
        maxAssignmentMarks: number;
        assignmentWeightage: number;
        hasLab: boolean;
        maxLabMarks: number;
        labWeightage: number;
    },
    marks: {
        internal1?: number | null;
        internal2?: number | null;
        internal3?: number | null;
        assignmentMarks?: number | null;
        labMarks?: number | null;
    }
): number | null {
    const internals: number[] = [];
    if (marks.internal1 != null) internals.push(marks.internal1);
    if (marks.internal2 != null && config.numInternals >= 2) internals.push(marks.internal2);
    if (marks.internal3 != null && config.numInternals >= 3) internals.push(marks.internal3);

    const requiredInternals = Math.min(config.internalsToConsider, config.numInternals);
    if (internals.length < requiredInternals) return null;

    internals.sort((a, b) => b - a);
    const bestInternals = internals.slice(0, config.internalsToConsider);
    const internalSum = bestInternals.reduce((sum, v) => sum + v, 0);
    const maxInternalSum = config.internalsToConsider * config.maxMarksPerInternal;
    const scaledInternal = (internalSum / maxInternalSum) * config.internalWeightage;

    let scaledAssignment = 0;
    if (config.hasAssignment && marks.assignmentMarks != null) {
        scaledAssignment = (marks.assignmentMarks / config.maxAssignmentMarks) * config.assignmentWeightage;
    }

    let scaledLab = 0;
    if (config.hasLab && marks.labMarks != null) {
        scaledLab = (marks.labMarks / config.maxLabMarks) * config.labWeightage;
    }

    return Math.round((scaledInternal + scaledAssignment + scaledLab) * 100) / 100;
}

async function getAssignedCourses(userId: number) {
    const cacheKey = `${CachePrefix.TEACHER}allocations:${userId}`;
    const cached = await cacheService.get<unknown>(cacheKey);
    if (cached) return cached;

    const teacher = await getTeacherProfile(userId);
    if (!teacher) return [];

    const allocations = await prisma.courseAllocation.findMany({
        where: { teacherId: teacher.id },
        include: {
            course: { include: { department: true } },
            section: {
                include: {
                    department: true,
                    batch: true,
                    _count: { select: { students: true } }
                }
            }
        },
        orderBy: [
            { section: { batch: { name: 'asc' } } },
            { course: { name: 'asc' } }
        ]
    });

    await cacheService.set(cacheKey, allocations, CacheTTL.SHORT);
    return allocations;
}

async function getSectionTimetable(userId: number, sectionId: number) {
    const cacheKey = `${CachePrefix.TEACHER}timetable:${userId}:${sectionId}`;
    const cached = await cacheService.get<unknown>(cacheKey);
    if (cached) return cached;

    const teacher = await getTeacherProfile(userId);
    if (!teacher) {
        throw new Error('Teacher profile not found. Only teachers can perform this action.');
    }

    const allocation = await prisma.courseAllocation.findFirst({
        where: { sectionId, teacherId: teacher.id }
    });

    if (!allocation) {
        throw new Error('You do not have access to this section');
    }

    const timetable = await prisma.sectionTimetable.findFirst({
        where: { sectionId, isActive: true },
        include: {
            section: {
                include: { department: true, batch: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    if (timetable) await cacheService.set(cacheKey, timetable, CacheTTL.LONG);
    return timetable;
}

export const teacherService = {
    // ── Allocation & Timetable ──────────────────────────────────
    getAssignedCourses,
    getSectionTimetable,

    // ── Marks ────────────────────────────────────────────────────
    getStudentsForAllocation: teacherMarksService.getStudentsForAllocation.bind(teacherMarksService),
    getInternalMarks: teacherMarksService.getInternalMarks.bind(teacherMarksService),
    recordMarks: teacherMarksService.recordMarks.bind(teacherMarksService),
    bulkRecordMarks: teacherMarksService.bulkRecordMarks.bind(teacherMarksService),
    submitMarks: teacherMarksService.submitMarks.bind(teacherMarksService),
    createMarksEditRequest: teacherMarksService.createMarksEditRequest.bind(teacherMarksService),
    getMyEditRequests: teacherMarksService.getMyEditRequests.bind(teacherMarksService),

    // ── Attendance ───────────────────────────────────────────────
    getStudentsForAttendance: teacherAttendanceService.getStudentsForAttendance.bind(teacherAttendanceService),
    markAttendance: teacherAttendanceService.markAttendance.bind(teacherAttendanceService),
    submitAttendance: teacherAttendanceService.submitAttendance.bind(teacherAttendanceService),
    getAttendanceRecords: teacherAttendanceService.getAttendanceRecords.bind(teacherAttendanceService),
    createAttendanceEditRequest: teacherAttendanceService.createAttendanceEditRequest.bind(teacherAttendanceService),
    getAttendanceHistory: teacherAttendanceService.getAttendanceHistory.bind(teacherAttendanceService),

    // ── Assessment Config ────────────────────────────────────────
    getAssessmentConfig,
    upsertAssessmentConfig,
    calculateMarksWithConfig,
};
