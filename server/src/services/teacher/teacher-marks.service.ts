/**
 * Teacher Marks Service
 * ──────────────────────────────────────
 * Handles internal marks recording (single + bulk), submission/finalization,
 * and edit requests for locked marks.
 *
 * Extracted from teacher.service.ts (lines 156-519, 1141-1242)
 */
import { Prisma, MentorApprovalStatus } from '@prisma/client';
import prisma from '../../data-access/prisma.js';
import { validateNotLocked } from '../../utils/semester-lock.js';
import {
    internalAssessmentRepository,
} from '../../data-access/internal-assessment.repository.js';
import { auditLogRepository } from '../../data-access/index.js';
import { internalAssessmentService } from '../internal-assessment.service.js';
import { cacheService, CachePrefix } from '../cache.service.js';
import {
    getTeacherProfile,
    verifyAllocationAccess,
    verifySectionCourseAccess,
} from './shared.js';

export interface RecordMarksData {
    studentUsn: string;
    courseId: number;
    batchId: number;
    sectionId: number;
    internal1?: number | null;
    internal2?: number | null;
    internal3?: number | null;
    assignmentMarks?: number | null;
}

class TeacherMarksService {
    /**
     * Get students for a specific allocation
     */
    async getStudentsForAllocation(userId: number, allocationId: number) {
        const { allocation } = await verifyAllocationAccess(userId, allocationId);

        const students = await prisma.studentProfile.findMany({
            where: { sectionId: allocation.sectionId },
            include: {
                user: {
                    select: { id: true, name: true, email: true }
                }
            },
            orderBy: { rollNumber: 'asc' }
        });

        return students.map(s => ({
            studentProfileId: s.id,
            userId: s.user.id,
            name: s.user.name,
            email: s.user.email,
            usn: s.rollNumber,
            batchId: allocation.section.batchId,
            sectionId: allocation.sectionId
        }));
    }

    /**
     * Get internal marks for section/course
     */
    async getInternalMarks(userId: number, sectionId: number, courseId: number) {
        await verifySectionCourseAccess(userId, sectionId, courseId);

        const marks = await prisma.internalMarksDetail.findMany({
            where: { sectionId, courseId },
            include: {
                course: true,
                section: {
                    include: { batch: true }
                }
            },
            orderBy: { studentUsn: 'asc' }
        });

        return marks;
    }

    /**
     * Record internal marks for a single student
     */
    async recordMarks(userId: number, data: RecordMarksData, semesterNumber: number) {
        const { teacher, allocation } = await verifySectionCourseAccess(
            userId, data.sectionId, data.courseId
        );

        const existingMarks = await prisma.internalMarksDetail.findFirst({
            where: {
                studentUsn: data.studentUsn,
                courseId: data.courseId,
                batchId: data.batchId
            }
        });

        if (existingMarks?.isFinalized) {
            throw new Error('Cannot edit marks that have been submitted. Contact Department Admin for corrections.');
        }

        await validateNotLocked(data.batchId, semesterNumber, 'record marks');

        let config = await internalAssessmentRepository.findConfig(data.courseId, semesterNumber);
        if (!config) {
            config = {
                id: 0, courseId: data.courseId, semesterNumber,
                numInternals: 3, maxMarksPerInternal: 30, internalsToConsider: 2,
                internalWeightage: 30, hasAssignment: true, numAssignments: 1,
                maxAssignmentMarks: 20, assignmentWeightage: 20, hasLab: false,
                numLabExams: 0, maxLabMarks: 0, labWeightage: 0, totalMarks: 50,
                createdAt: new Date(), updatedAt: new Date()
            };
        }

        const calculatedTotal = internalAssessmentService.calculateFinalInternal(
            data.internal1 ?? null, data.internal2 ?? null,
            data.internal3 ?? null, data.assignmentMarks ?? null, config
        );

        const marks = await prisma.internalMarksDetail.upsert({
            where: {
                studentUsn_courseId_batchId: {
                    studentUsn: data.studentUsn, courseId: data.courseId, batchId: data.batchId
                }
            },
            create: {
                studentUsn: data.studentUsn, courseId: data.courseId,
                batchId: data.batchId, sectionId: data.sectionId,
                internal1: data.internal1, internal2: data.internal2,
                internal3: data.internal3, assignmentMarks: data.assignmentMarks,
                calculatedTotal, updatedBy: userId
            },
            update: {
                sectionId: data.sectionId,
                internal1: data.internal1, internal2: data.internal2,
                internal3: data.internal3, assignmentMarks: data.assignmentMarks,
                calculatedTotal, updatedBy: userId
            }
        });

        await auditLogRepository.create({
            actorId: userId,
            action: 'TEACHER_RECORD_MARKS',
            entityType: 'InternalMarksDetail',
            entityId: marks.id,
            newValue: {
                role: 'TEACHER', teacherId: teacher.id,
                departmentId: allocation.section.departmentId,
                batchId: data.batchId, sectionId: data.sectionId,
                courseId: data.courseId, usn: data.studentUsn,
                marks: { internal1: data.internal1, internal2: data.internal2, internal3: data.internal3, assignmentMarks: data.assignmentMarks, calculatedTotal }
            } as unknown as Prisma.JsonValue
        });

        // Invalidate the student's cached internal marks
        const student = await prisma.studentProfile.findFirst({
            where: { rollNumber: data.studentUsn },
            select: { userId: true },
        });
        if (student) {
            await cacheService.delete(`${CachePrefix.MARKS}internal:${student.userId}`);
        }

        return marks;
    }

    /**
     * Bulk record marks for a section/course (transactional)
     */
    async bulkRecordMarks(userId: number, entries: RecordMarksData[], semesterNumber: number) {
        if (entries.length === 0) return { created: 0, updated: 0 };

        const first = entries[0];
        const { teacher, allocation } = await verifySectionCourseAccess(userId, first.sectionId, first.courseId);

        await validateNotLocked(first.batchId, semesterNumber, 'record marks');

        let config = await internalAssessmentRepository.findConfig(first.courseId, semesterNumber);
        if (!config) {
            config = {
                id: 0, courseId: first.courseId, semesterNumber,
                numInternals: 3, maxMarksPerInternal: 30, internalsToConsider: 2,
                internalWeightage: 30, hasAssignment: true, numAssignments: 1,
                maxAssignmentMarks: 20, assignmentWeightage: 20, hasLab: false,
                numLabExams: 0, maxLabMarks: 0, labWeightage: 0, totalMarks: 50,
                createdAt: new Date(), updatedAt: new Date()
            };
        }

        let created = 0;
        let updated = 0;

        const iaConfig = config;
        
        // Pre-fetch all existing marks for this section and course to avoid N+1 finds
        const existingMarksList = await prisma.internalMarksDetail.findMany({
            where: {
                courseId: first.courseId,
                batchId: first.batchId,
                sectionId: first.sectionId,
            }
        });
        
        const existingMap = new Map(existingMarksList.map(m => [m.studentUsn, m]));
        
        const operations: Prisma.PrismaPromise<unknown>[] = [];
        const toCreate: Prisma.InternalMarksDetailCreateManyInput[] = [];

        for (const entry of entries) {
            const existingMarks = existingMap.get(entry.studentUsn);

            if (existingMarks?.isFinalized) continue;

            const calculatedTotal = internalAssessmentService.calculateFinalInternal(
                entry.internal1 ?? null, entry.internal2 ?? null,
                entry.internal3 ?? null, entry.assignmentMarks ?? null, iaConfig
            );

            if (existingMarks) {
                updated++;
                operations.push(prisma.internalMarksDetail.update({
                    where: { id: existingMarks.id },
                    data: {
                        sectionId: entry.sectionId,
                        internal1: entry.internal1, internal2: entry.internal2,
                        internal3: entry.internal3, assignmentMarks: entry.assignmentMarks,
                        calculatedTotal, updatedBy: userId
                    }
                }));
            } else {
                created++;
                toCreate.push({
                    studentUsn: entry.studentUsn, courseId: entry.courseId,
                    batchId: entry.batchId, sectionId: entry.sectionId,
                    internal1: entry.internal1, internal2: entry.internal2,
                    internal3: entry.internal3, assignmentMarks: entry.assignmentMarks,
                    calculatedTotal, updatedBy: userId
                });
            }
        }
        
        if (toCreate.length > 0) {
            operations.push(prisma.internalMarksDetail.createMany({
                data: toCreate,
                skipDuplicates: true
            }));
        }

        if (operations.length > 0) {
            await prisma.$transaction(operations);
        }

        await auditLogRepository.create({
            actorId: userId,
            action: 'TEACHER_BULK_RECORD_MARKS',
            entityType: 'InternalMarksDetail',
            entityId: first.courseId,
            newValue: {
                role: 'TEACHER', teacherId: teacher.id,
                departmentId: allocation.section.departmentId,
                batchId: first.batchId, sectionId: first.sectionId,
                courseId: first.courseId, count: entries.length, created, updated
            } as unknown as Prisma.JsonValue
        });

        // Invalidate marks cache for all affected students in this section
        const affectedStudents = await prisma.studentProfile.findMany({
            where: { rollNumber: { in: entries.map(e => e.studentUsn) } },
            select: { userId: true },
        });
        const invalidations = affectedStudents.map(s =>
            cacheService.delete(`${CachePrefix.MARKS}internal:${s.userId}`)
        );
        await Promise.all(invalidations);

        return { created, updated };
    }

    /**
     * Submit/finalize marks for a section/course (locks editing)
     */
    async submitMarks(userId: number, sectionId: number, courseId: number) {
        const { teacher, allocation } = await verifySectionCourseAccess(userId, sectionId, courseId);

        const result = await prisma.internalMarksDetail.updateMany({
            where: { sectionId, courseId, isFinalized: false },
            data: {
                isFinalized: true,
                mentorApprovalStatus: MentorApprovalStatus.SUBMITTED_BY_TEACHER,
                updatedBy: userId
            }
        });

        await auditLogRepository.create({
            actorId: userId,
            action: 'TEACHER_SUBMIT_MARKS',
            entityType: 'InternalMarksDetail',
            entityId: courseId,
            newValue: {
                role: 'TEACHER', teacherId: teacher.id,
                departmentId: allocation.section.departmentId,
                batchId: allocation.section.batchId,
                sectionId, courseId, submissionStatus: 'SUBMITTED', count: result.count
            } as unknown as Prisma.JsonValue
        });

        // Invalidate marks cache for all students in this section
        const sectionStudents = await prisma.studentProfile.findMany({
            where: { sectionId },
            select: { userId: true },
        });
        const invalidations = sectionStudents.map(s =>
            cacheService.delete(`${CachePrefix.MARKS}internal:${s.userId}`)
        );
        await Promise.all(invalidations);

        return { submitted: result.count };
    }

    /**
     * Create an edit request for locked marks
     */
    async createMarksEditRequest(
        userId: number,
        marksId: number,
        newValues: {
            internal1?: number | null;
            internal2?: number | null;
            internal3?: number | null;
            assignmentMarks?: number | null;
        },
        reason: string
    ) {
        const existingMarks = await prisma.internalMarksDetail.findUnique({
            where: { id: marksId },
            include: { course: true, section: true }
        });

        if (!existingMarks) throw new Error('Marks record not found');
        if (!existingMarks.isFinalized) throw new Error('Marks are not locked - you can edit directly');

        const editRequest = await prisma.editRequest.create({
            data: {
                type: 'MARKS',
                requesterId: userId,
                subjectId: existingMarks.courseId,
                entityType: 'InternalMarksDetail',
                entityId: marksId,
                oldValue: {
                    internal1: existingMarks.internal1,
                    internal2: existingMarks.internal2,
                    internal3: existingMarks.internal3,
                    assignmentMarks: existingMarks.assignmentMarks,
                },
                newValue: newValues,
                reason,
                status: 'PENDING',
            }
        });

        return editRequest;
    }

    /**
     * Get my edit requests
     */
    async getMyEditRequests(userId: number) {
        return prisma.editRequest.findMany({
            where: { requesterId: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                reviewer: { select: { name: true } }
            }
        });
    }
}

export const teacherMarksService = new TeacherMarksService();
