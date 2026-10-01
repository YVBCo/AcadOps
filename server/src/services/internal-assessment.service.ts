import { InternalAssessmentConfig, InternalMarksDetail, Prisma } from '@prisma/client';
import {
    internalAssessmentRepository,
    internalMarksDetailRepository,
    CreateIAConfigData,
    CreateInternalMarksData,
    UpdateInternalMarksData
} from '../data-access/internal-assessment.repository.js';
import { auditLogRepository } from '../data-access/index.js';
import { prisma } from '../data-access/prisma.js';

class InternalAssessmentService {
    /**
     * Configure internal assessment structure for a course
     * Validates that total weightage equals 50 (as per requirements)
     */
    async configureAssessment(
        courseId: number,
        semesterNumber: number,
        config: {
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
        },
        actorId: number
    ): Promise<InternalAssessmentConfig> {
        const numInternals = config.numInternals ?? 3;
        const maxMarksPerInternal = config.maxMarksPerInternal ?? 30;
        const internalsToConsider = config.internalsToConsider ?? 2;
        const internalWeightage = config.internalWeightage ?? 30;

        const hasAssignment = config.hasAssignment ?? true;
        const numAssignments = config.numAssignments ?? 1;
        const maxAssignmentMarks = config.maxAssignmentMarks ?? 20;
        const assignmentWeightage = hasAssignment ? (config.assignmentWeightage ?? 20) : 0;

        const hasLab = config.hasLab ?? false;
        const numLabExams = config.numLabExams ?? 0;
        const maxLabMarks = config.maxLabMarks ?? 0;
        const labWeightage = hasLab ? (config.labWeightage ?? 0) : 0;

        // Validate total weightage = 50
        const totalWeightage = internalWeightage + assignmentWeightage + labWeightage;
        if (totalWeightage !== 50) {
            throw new Error(`Total weightage must equal 50. Current: ${totalWeightage}`);
        }

        const iaConfig = await internalAssessmentRepository.upsertConfig({
            courseId,
            semesterNumber,
            numInternals,
            maxMarksPerInternal,
            internalsToConsider,
            internalWeightage,
            hasAssignment,
            numAssignments,
            maxAssignmentMarks,
            assignmentWeightage,
            hasLab,
            numLabExams,
            maxLabMarks,
            labWeightage,
            totalMarks: 50,
        });

        await auditLogRepository.create({
            actorId,
            action: 'CONFIGURE_INTERNAL_ASSESSMENT',
            entityType: 'InternalAssessmentConfig',
            entityId: iaConfig.id,
            newValue: { courseId, semesterNumber, numInternals, maxMarksPerInternal, internalsToConsider, internalWeightage, hasAssignment, assignmentWeightage, hasLab, labWeightage } as Prisma.JsonValue,
        });

        return iaConfig;
    }

    /**
     * Get IA configuration for a course.
     * Auto-heals configs where total weightage != 50 (legacy data).
     */
    async getConfig(courseId: number, semesterNumber: number): Promise<InternalAssessmentConfig | null> {
        const config = await internalAssessmentRepository.findConfig(courseId, semesterNumber);
        if (!config) return null;

        // Auto-heal: if weightages don't sum to 50, reset to standard defaults
        const totalWeightage = config.internalWeightage + config.assignmentWeightage + config.labWeightage;
        if (totalWeightage !== 50) {
            const corrected = await prisma.internalAssessmentConfig.update({
                where: { id: config.id },
                data: {
                    internalWeightage: 30,
                    assignmentWeightage: config.hasAssignment ? 20 : 0,
                    labWeightage: config.hasLab ? (config.hasAssignment ? 0 : 20) : 0,
                    totalMarks: 50,
                },
            });
            return corrected;
        }

        return config;
    }

    /**
     * Calculate final internal marks using dynamic config
     * Uses best-of-N internals and configurable weightages
     */
    calculateFinalInternal(
        internal1: number | null,
        internal2: number | null,
        internal3: number | null,
        assignmentMarks: number | null,
        config: InternalAssessmentConfig,
        labMarks?: number | null
    ): number | null {
        // Collect available internals based on config
        const internals: number[] = [];
        if (internal1 !== null) internals.push(internal1);
        if (internal2 !== null && config.numInternals >= 2) internals.push(internal2);
        if (internal3 !== null && config.numInternals >= 3) internals.push(internal3);

        // Need at least internalsToConsider marks
        const requiredInternals = Math.min(config.internalsToConsider, config.numInternals);
        if (internals.length < requiredInternals) {
            return null; // Not enough internal data
        }

        // Check if assignment is required but missing
        if (config.hasAssignment && assignmentMarks === null && config.assignmentWeightage > 0) {
            return null;
        }

        // Check if lab is required but missing
        if (config.hasLab && labMarks === null && config.labWeightage > 0) {
            return null;
        }

        // Take best N internals
        internals.sort((a, b) => b - a);
        const bestInternals = internals.slice(0, config.internalsToConsider);
        const internalSum = bestInternals.reduce((sum, v) => sum + v, 0);
        const maxInternalSum = config.internalsToConsider * config.maxMarksPerInternal;
        const scaledInternal = (internalSum / maxInternalSum) * config.internalWeightage;

        // Scale assignment marks
        let scaledAssignment = 0;
        if (config.hasAssignment && assignmentMarks !== null) {
            scaledAssignment = (assignmentMarks / config.maxAssignmentMarks) * config.assignmentWeightage;
        }

        // Scale lab marks
        let scaledLab = 0;
        if (config.hasLab && labMarks !== null && labMarks !== undefined && config.maxLabMarks > 0) {
            scaledLab = (labMarks / config.maxLabMarks) * config.labWeightage;
        }

        return Math.round((scaledInternal + scaledAssignment + scaledLab) * 100) / 100;
    }

    /**
     * Record internal marks for a student
     */
    async recordMarks(
        data: CreateInternalMarksData,
        config: InternalAssessmentConfig,
        actorId: number
    ): Promise<InternalMarksDetail> {
        // Calculate total if all required marks are present
        const calculatedTotal = this.calculateFinalInternal(
            data.internal1 ?? null,
            data.internal2 ?? null,
            data.internal3 ?? null,
            data.assignmentMarks ?? null,
            config
        );

        const marks = await internalMarksDetailRepository.upsert({
            ...data,
            calculatedTotal,
        });

        await auditLogRepository.create({
            actorId,
            action: 'RECORD_INTERNAL_MARKS',
            entityType: 'InternalMarksDetail',
            entityId: marks.id,
            newValue: {
                studentUsn: data.studentUsn,
                courseId: data.courseId,
                internal1: data.internal1,
                internal2: data.internal2,
                internal3: data.internal3,
                assignmentMarks: data.assignmentMarks,
                calculatedTotal,
            } as Prisma.JsonValue,
        });

        return marks;
    }

    /**
     * Bulk record marks for a section
     */
    async bulkRecordMarks(
        entries: Array<CreateInternalMarksData>,
        config: InternalAssessmentConfig,
        actorId: number
    ): Promise<{ created: number; updated: number }> {
        let created = 0;
        let updated = 0;

        for (const entry of entries) {
            const existing = await internalMarksDetailRepository.findByStudentCourseBatch(
                entry.studentUsn,
                entry.courseId,
                entry.batchId
            );

            const calculatedTotal = this.calculateFinalInternal(
                entry.internal1 ?? null,
                entry.internal2 ?? null,
                entry.internal3 ?? null,
                entry.assignmentMarks ?? null,
                config
            );

            await internalMarksDetailRepository.upsert({
                ...entry,
                calculatedTotal,
            });

            if (existing) {
                updated++;
            } else {
                created++;
            }
        }

        await auditLogRepository.create({
            actorId,
            action: 'BULK_RECORD_INTERNAL_MARKS',
            entityType: 'InternalMarksDetail',
            entityId: config.courseId,
            newValue: { count: entries.length, courseId: config.courseId } as Prisma.JsonValue,
        });

        return { created, updated };
    }

    /**
     * Get marks for a section and course
     */
    async getMarksForSection(sectionId: number, courseId: number): Promise<InternalMarksDetail[]> {
        return internalMarksDetailRepository.findBySectionAndCourse(sectionId, courseId);
    }

    /**
     * Edit marks with reason (Department Admin only)
     */
    async editMarks(
        id: number,
        data: UpdateInternalMarksData,
        reason: string,
        actorId: number
    ): Promise<InternalMarksDetail> {
        const existing = await internalMarksDetailRepository.findById(id);
        if (!existing) {
            throw new Error('Internal marks record not found');
        }

        if (existing.isFinalized) {
            throw new Error('Cannot edit finalized marks');
        }

        if (!reason || reason.trim().length === 0) {
            throw new Error('Edit reason is required');
        }

        // Get config to recalculate
        const config = await internalAssessmentRepository.findConfig(
            existing.courseId,
            // Default to semester 1 if not available
            1
        );

        let calculatedTotal = existing.calculatedTotal;
        if (config) {
            calculatedTotal = this.calculateFinalInternal(
                data.internal1 ?? existing.internal1,
                data.internal2 ?? existing.internal2,
                data.internal3 ?? existing.internal3,
                data.assignmentMarks ?? existing.assignmentMarks,
                config
            );
        }

        const updatedMarks = await internalMarksDetailRepository.updateWithReason(id, {
            ...data,
            calculatedTotal,
            editReason: reason,
            updatedBy: actorId,
        });

        await auditLogRepository.create({
            actorId,
            action: 'EDIT_INTERNAL_MARKS',
            entityType: 'InternalMarksDetail',
            entityId: id,
            oldValue: {
                internal1: existing.internal1,
                internal2: existing.internal2,
                internal3: existing.internal3,
                assignmentMarks: existing.assignmentMarks,
            } as Prisma.JsonValue,
            newValue: {
                ...data,
                reason,
            } as unknown as Prisma.JsonValue,
        });

        return updatedMarks;
    }

    /**
     * Finalize marks for a section/course (no more edits allowed)
     */
    async finalizeMarks(
        sectionId: number,
        courseId: number,
        actorId: number
    ): Promise<{ count: number }> {
        const result = await internalMarksDetailRepository.finalizeBySectionAndCourse(sectionId, courseId);

        await auditLogRepository.create({
            actorId,
            action: 'FINALIZE_INTERNAL_MARKS',
            entityType: 'InternalMarksDetail',
            entityId: sectionId,
            newValue: { sectionId, courseId, count: result.count } as Prisma.JsonValue,
        });

        return result;
    }

    /**
     * Submit finalized internal marks to COE
     * Creates InternalMarksSubmission records
     */
    async submitToCOE(
        departmentId: number,
        batchId: number,
        courseId: number,
        actorId: number
    ): Promise<{ submitted: number }> {
        // Get all finalized marks for this batch/course
        const marks = await internalMarksDetailRepository.findByBatchAndCourse(batchId, courseId);
        const finalizedMarks = marks.filter(m => m.isFinalized && m.calculatedTotal !== null);

        if (finalizedMarks.length === 0) {
            const totalMarks = marks.length;
            const withTotal = marks.filter(m => m.calculatedTotal !== null).length;
            throw new Error(`No finalized marks with calculated totals to submit. Total records: ${totalMarks}, With calculated total: ${withTotal}. Please ensure marks are entered and finalized.`);
        }

        const operations: any[] = [];
        // Create InternalMarksSubmission records
        for (const mark of finalizedMarks) {
            operations.push(prisma.internalMarksSubmission.upsert({
                where: {
                    departmentId_batchId_courseId_studentUsn: {
                        departmentId,
                        batchId,
                        courseId,
                        studentUsn: mark.studentUsn,
                    },
                },
                create: {
                    departmentId,
                    batchId,
                    courseId,
                    studentUsn: mark.studentUsn,
                    marks: Math.round(mark.calculatedTotal!),
                    submittedBy: actorId,
                },
                update: {
                    marks: Math.round(mark.calculatedTotal!),
                    submittedBy: actorId,
                    submittedAt: new Date(),
                },
            }));
        }

        if (operations.length > 0) {
            await prisma.$transaction(operations);
        }

        await auditLogRepository.create({
            actorId,
            action: 'SUBMIT_INTERNAL_MARKS_TO_COE',
            entityType: 'InternalMarksSubmission',
            entityId: courseId,
            newValue: { departmentId, batchId, courseId, count: finalizedMarks.length } as Prisma.JsonValue,
        });

        return { submitted: finalizedMarks.length };
    }

    /**
     * Recalculate all marks for a course using the current IA config.
     * Fixes stale calculatedTotal values caused by past config mismatches.
     */
    async recalculateAllMarks(
        courseId: number,
        semesterNumber: number,
        actorId: number
    ): Promise<{ updated: number }> {
        const config = await this.getConfig(courseId, semesterNumber);
        if (!config) {
            throw new Error('No IA configuration found for this course/semester');
        }

        // Get all marks records for this course
        const allMarks = await prisma.internalMarksDetail.findMany({
            where: { courseId },
        });

        let updated = 0;
        const operations: any[] = [];

        for (const mark of allMarks) {
            const newTotal = this.calculateFinalInternal(
                mark.internal1,
                mark.internal2,
                mark.internal3,
                mark.assignmentMarks,
                config
            );

            // Only update if the total actually changed
            if (newTotal !== mark.calculatedTotal) {
                operations.push(prisma.internalMarksDetail.update({
                    where: { id: mark.id },
                    data: { calculatedTotal: newTotal },
                }));
                updated++;
            }
        }

        if (operations.length > 0) {
            await prisma.$transaction(operations);
        }

        await auditLogRepository.create({
            actorId,
            action: 'RECALCULATE_ALL_MARKS',
            entityType: 'InternalAssessmentConfig',
            entityId: config.id,
            newValue: { courseId, semesterNumber, recordsUpdated: updated } as Prisma.JsonValue,
        });

        return { updated };
    }
}

export const internalAssessmentService = new InternalAssessmentService();
