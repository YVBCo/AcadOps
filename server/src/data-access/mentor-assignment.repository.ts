import { MentorAssignment, Prisma, MentorApprovalStatus } from '@prisma/client';
import { prisma } from './prisma.js';

// ============================================
// Mentor Assignment Repository
// ============================================

export interface CreateMentorAssignmentData {
    teacherProfileId: number;
    studentProfileId: number;
    departmentId: number;
    batchId: number;
    sectionId: number;
    academicYear: string;
    semester: number;
    assignedBy: number;
}

export const mentorAssignmentRepository = {
    // Create new mentor assignment
    async create(data: CreateMentorAssignmentData): Promise<MentorAssignment> {
        return prisma.mentorAssignment.create({
            data,
        });
    },

    // Create multiple mentor assignments in a transaction
    async createMany(assignments: CreateMentorAssignmentData[]): Promise<{ count: number }> {
        return prisma.mentorAssignment.createMany({
            data: assignments,
            skipDuplicates: true,
        });
    },

    // Find by teacher profile ID (get all students assigned to a mentor)
    async findByTeacher(teacherProfileId: number, isActive: boolean = true) {
        return prisma.mentorAssignment.findMany({
            where: { teacherProfileId, isActive },
            include: {
                studentProfile: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                        section: { select: { id: true, name: true } },
                        batch: { select: { id: true, name: true } },
                    },
                },
                section: true,
                batch: true,
            },
            orderBy: [
                { section: { name: 'asc' } },
                { studentProfile: { rollNumber: 'asc' } },
            ],
        });
    },

    // Find by student profile ID (get current mentor for a student)
    async findByStudent(
        studentProfileId: number,
        academicYear?: string,
        semester?: number
    ) {
        const where: Prisma.MentorAssignmentWhereInput = {
            studentProfileId,
            isActive: true,
        };
        if (academicYear) where.academicYear = academicYear;
        if (semester) where.semester = semester;

        return prisma.mentorAssignment.findFirst({
            where,
            include: {
                teacherProfile: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                section: true,
                batch: true,
            },
            orderBy: { assignedAt: 'desc' },
        });
    },

    // Find by department (all mentor assignments in a department)
    async findByDepartment(
        departmentId: number,
        batchId?: number,
        sectionId?: number,
        isActive?: boolean
    ) {
        const where: Prisma.MentorAssignmentWhereInput = { departmentId };
        if (batchId) where.batchId = batchId;
        if (sectionId) where.sectionId = sectionId;
        if (isActive !== undefined) where.isActive = isActive;

        return prisma.mentorAssignment.findMany({
            where,
            include: {
                teacherProfile: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                studentProfile: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                section: true,
                batch: true,
            },
            orderBy: [
                { batch: { name: 'asc' } },
                { section: { name: 'asc' } },
                { teacherProfile: { employeeId: 'asc' } },
            ],
        });
    },

    // Get mentor assignment by ID
    async findById(id: number) {
        return prisma.mentorAssignment.findUnique({
            where: { id },
            include: {
                teacherProfile: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                studentProfile: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                section: true,
                batch: true,
            },
        });
    },

    // Expire mentor assignment
    async expire(id: number): Promise<MentorAssignment> {
        return prisma.mentorAssignment.update({
            where: { id },
            data: {
                isActive: false,
                expiredAt: new Date(),
            },
        });
    },

    // Expire all assignments for a semester (end-of-semester cleanup)
    async expireForSemester(
        departmentId: number,
        academicYear: string,
        semester: number
    ): Promise<{ count: number }> {
        return prisma.mentorAssignment.updateMany({
            where: {
                departmentId,
                academicYear,
                semester,
                isActive: true,
            },
            data: {
                isActive: false,
                expiredAt: new Date(),
            },
        });
    },

    // Get mentor assignment history
    async getHistory(departmentId: number, batchId?: number) {
        const where: Prisma.MentorAssignmentWhereInput = { departmentId };
        if (batchId) where.batchId = batchId;

        return prisma.mentorAssignment.findMany({
            where,
            include: {
                teacherProfile: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                studentProfile: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
                section: true,
                batch: true,
            },
            orderBy: { assignedAt: 'desc' },
        });
    },

    // Count students assigned to a mentor
    async countByTeacher(teacherProfileId: number, isActive: boolean = true): Promise<number> {
        return prisma.mentorAssignment.count({
            where: { teacherProfileId, isActive },
        });
    },

    // Check if teacher can access a specific student (by rollNumber/USN)
    async canAccessStudent(teacherProfileId: number, studentUsn: string): Promise<boolean> {
        const count = await prisma.mentorAssignment.count({
            where: {
                teacherProfileId,
                isActive: true,
                studentProfile: {
                    OR: [
                        { rollNumber: studentUsn },
                        { permanentUsn: studentUsn },
                        { temporaryUsn: studentUsn },
                    ],
                },
            },
        });
        return count > 0;
    },

    // Get students with pending mentor approvals
    async getStudentsWithPendingApprovals(teacherProfileId: number): Promise<string[]> {
        const assignments = await prisma.mentorAssignment.findMany({
            where: {
                teacherProfileId,
                isActive: true,
            },
            select: {
                studentProfile: {
                    select: { rollNumber: true },
                },
            },
        });

        // Get USNs from internal marks that are pending approval
        const studentUsns = assignments.map(a => a.studentProfile.rollNumber);

        const pendingMarks = await prisma.internalMarksDetail.findMany({
            where: {
                mentorApprovalStatus: MentorApprovalStatus.SUBMITTED_BY_TEACHER,
                studentUsn: {
                    in: studentUsns,
                },
            },
            select: { studentUsn: true },
            distinct: ['studentUsn'],
        });

        return pendingMarks.map(m => m.studentUsn);
    },
};
