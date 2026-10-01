import { InternalAssessmentConfig, InternalMarksDetail, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

// ============================================
// Internal Assessment Config Repository
// ============================================

export interface CreateIAConfigData {
    courseId: number;
    semesterNumber: number;
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
    totalMarks?: number;
}

export interface UpdateIAConfigData {
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
    totalMarks?: number;
}

export const internalAssessmentRepository = {
    // Create or update IA config
    async upsertConfig(data: CreateIAConfigData): Promise<InternalAssessmentConfig> {
        return prisma.internalAssessmentConfig.upsert({
            where: {
                courseId_semesterNumber: {
                    courseId: data.courseId,
                    semesterNumber: data.semesterNumber,
                },
            },
            create: data,
            update: {
                numInternals: data.numInternals,
                maxMarksPerInternal: data.maxMarksPerInternal,
                internalsToConsider: data.internalsToConsider,
                internalWeightage: data.internalWeightage,
                hasAssignment: data.hasAssignment,
                numAssignments: data.numAssignments,
                maxAssignmentMarks: data.maxAssignmentMarks,
                assignmentWeightage: data.assignmentWeightage,
                hasLab: data.hasLab,
                numLabExams: data.numLabExams,
                maxLabMarks: data.maxLabMarks,
                labWeightage: data.labWeightage,
                totalMarks: data.totalMarks,
            },
        });
    },

    // Get config by course and semester
    async findConfig(courseId: number, semesterNumber: number): Promise<InternalAssessmentConfig | null> {
        return prisma.internalAssessmentConfig.findUnique({
            where: {
                courseId_semesterNumber: {
                    courseId,
                    semesterNumber,
                },
            },
        });
    },

    // Get all configs for a course
    async findByCourse(courseId: number): Promise<InternalAssessmentConfig[]> {
        return prisma.internalAssessmentConfig.findMany({
            where: { courseId },
            orderBy: { semesterNumber: 'asc' },
        });
    },
};

// ============================================
// Internal Marks Detail Repository
// ============================================

export interface CreateInternalMarksData {
    studentUsn: string;
    courseId: number;
    batchId: number;
    sectionId: number;
    internal1?: number | null;
    internal2?: number | null;
    internal3?: number | null;
    assignmentMarks?: number | null;
    calculatedTotal?: number | null;
}

export interface UpdateInternalMarksData {
    internal1?: number | null;
    internal2?: number | null;
    internal3?: number | null;
    assignmentMarks?: number | null;
    calculatedTotal?: number | null;
    isFinalized?: boolean;
    editReason?: string;
    updatedBy?: number;
}

export const internalMarksDetailRepository = {
    // Create or update internal marks
    async upsert(data: CreateInternalMarksData): Promise<InternalMarksDetail> {
        return prisma.internalMarksDetail.upsert({
            where: {
                studentUsn_courseId_batchId: {
                    studentUsn: data.studentUsn,
                    courseId: data.courseId,
                    batchId: data.batchId,
                },
            },
            create: data,
            update: {
                sectionId: data.sectionId,
                internal1: data.internal1,
                internal2: data.internal2,
                internal3: data.internal3,
                assignmentMarks: data.assignmentMarks,
                calculatedTotal: data.calculatedTotal,
            },
        });
    },

    // Get marks by student, course, batch
    async findByStudentCourseBatch(
        studentUsn: string,
        courseId: number,
        batchId: number
    ): Promise<InternalMarksDetail | null> {
        return prisma.internalMarksDetail.findUnique({
            where: {
                studentUsn_courseId_batchId: {
                    studentUsn,
                    courseId,
                    batchId,
                },
            },
        });
    },

    // Get marks for a section and course
    async findBySectionAndCourse(sectionId: number, courseId: number): Promise<InternalMarksDetail[]> {
        return prisma.internalMarksDetail.findMany({
            where: { sectionId, courseId },
            orderBy: { studentUsn: 'asc' },
        });
    },

    // Get marks for a batch and course
    async findByBatchAndCourse(batchId: number, courseId: number): Promise<InternalMarksDetail[]> {
        return prisma.internalMarksDetail.findMany({
            where: { batchId, courseId },
            include: {
                section: true,
            },
            orderBy: { studentUsn: 'asc' },
        });
    },

    // Update marks with reason
    async updateWithReason(
        id: number,
        data: UpdateInternalMarksData
    ): Promise<InternalMarksDetail> {
        return prisma.internalMarksDetail.update({
            where: { id },
            data,
        });
    },

    // Finalize marks for a section/course
    async finalizeBySectionAndCourse(
        sectionId: number,
        courseId: number
    ): Promise<{ count: number }> {
        return prisma.internalMarksDetail.updateMany({
            where: { sectionId, courseId, isFinalized: false },
            data: { isFinalized: true },
        });
    },

    // Get unfinalized marks count
    async getUnfinalizedCount(sectionId: number, courseId: number): Promise<number> {
        return prisma.internalMarksDetail.count({
            where: { sectionId, courseId, isFinalized: false },
        });
    },

    // Find by id
    async findById(id: number): Promise<InternalMarksDetail | null> {
        return prisma.internalMarksDetail.findUnique({
            where: { id },
            include: {
                course: true,
                batch: true,
                section: true,
            },
        });
    },
};
