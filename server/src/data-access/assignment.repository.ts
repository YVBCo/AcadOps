import { prisma } from './prisma.js';
import { Assignment, Submission, Prisma } from '@prisma/client';

export interface CreateAssignmentData {
    subjectId: number;
    title: string;
    description?: string;
    dueDate: Date;
    maxScore?: number;
}

export interface UpdateAssignmentData {
    title?: string;
    description?: string;
    dueDate?: Date;
    maxScore?: number;
}

export interface CreateSubmissionData {
    assignmentId: number;
    studentId: number;
    fileUrl?: string;
    content?: string;
}

export const assignmentRepository = {
    // Assignment CRUD
    async createAssignment(data: CreateAssignmentData): Promise<Assignment> {
        return prisma.assignment.create({
            data,
            include: {
                subject: {
                    include: { course: { select: { id: true, name: true, code: true } } },
                },
            },
        });
    },

    async findAssignmentById(id: number): Promise<Assignment | null> {
        return prisma.assignment.findUnique({
            where: { id },
            include: {
                subject: {
                    include: {
                        course: { select: { id: true, name: true, code: true } },
                        semester: { select: { id: true, name: true, status: true } },
                    },
                },
                submissions: {
                    include: {
                        student: {
                            include: { user: { select: { id: true, name: true, email: true } } },
                        },
                    },
                },
                _count: { select: { submissions: true } },
            },
        });
    },

    async findBySubject(subjectId: number): Promise<Assignment[]> {
        return prisma.assignment.findMany({
            where: { subjectId },
            include: {
                _count: { select: { submissions: true } },
            },
            orderBy: { dueDate: 'asc' },
        });
    },

    async updateAssignment(id: number, data: UpdateAssignmentData): Promise<Assignment> {
        return prisma.assignment.update({
            where: { id },
            data,
            include: {
                subject: {
                    include: { course: { select: { id: true, name: true, code: true } } },
                },
            },
        });
    },

    async deleteAssignment(id: number): Promise<void> {
        await prisma.assignment.delete({ where: { id } });
    },

    // Submission CRUD
    async createSubmission(data: CreateSubmissionData, isLate: boolean): Promise<Submission> {
        return prisma.submission.create({
            data: {
                ...data,
                isLate,
            },
            include: {
                assignment: {
                    include: { subject: { include: { course: true } } },
                },
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
        });
    },

    async findSubmissionById(id: number): Promise<Submission | null> {
        return prisma.submission.findUnique({
            where: { id },
            include: {
                assignment: true,
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
        });
    },

    async findSubmissionByAssignmentAndStudent(assignmentId: number, studentId: number): Promise<Submission | null> {
        return prisma.submission.findUnique({
            where: {
                assignmentId_studentId: {
                    assignmentId,
                    studentId,
                },
            },
        });
    },

    async findSubmissionsByAssignment(assignmentId: number): Promise<Submission[]> {
        return prisma.submission.findMany({
            where: { assignmentId },
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
            orderBy: { submittedAt: 'desc' },
        });
    },

    async findSubmissionsByStudent(studentId: number): Promise<Submission[]> {
        return prisma.submission.findMany({
            where: { studentId },
            include: {
                assignment: {
                    include: { subject: { include: { course: true } } },
                },
            },
            orderBy: { submittedAt: 'desc' },
        });
    },

    async updateSubmission(id: number, data: Partial<CreateSubmissionData>): Promise<Submission> {
        return prisma.submission.update({
            where: { id },
            data: {
                ...data,
                submittedAt: new Date(), // Update submission time
            },
        });
    },

    async gradeSubmission(id: number, score: number, feedback?: string): Promise<Submission> {
        return prisma.submission.update({
            where: { id },
            data: { score, feedback },
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
        });
    },

    // Stats
    async getAssignmentStats(assignmentId: number): Promise<{
        totalEnrolled: number;
        submitted: number;
        graded: number;
        lateSubmissions: number;
        avgScore: number | null;
    }> {
        const assignment = await prisma.assignment.findUnique({
            where: { id: assignmentId },
            include: {
                subject: {
                    include: {
                        enrollments: true,
                        _count: { select: { enrollments: true } },
                    },
                },
            },
        });

        if (!assignment) {
            throw new Error('Assignment not found');
        }

        const submissions = await prisma.submission.findMany({
            where: { assignmentId },
        });

        const gradedSubmissions = submissions.filter(s => s.score !== null);
        const lateSubmissions = submissions.filter(s => s.isLate);
        const avgScore = gradedSubmissions.length > 0
            ? gradedSubmissions.reduce((acc, s) => acc + (s.score || 0), 0) / gradedSubmissions.length
            : null;

        return {
            totalEnrolled: assignment.subject._count.enrollments,
            submitted: submissions.length,
            graded: gradedSubmissions.length,
            lateSubmissions: lateSubmissions.length,
            avgScore,
        };
    },
};
