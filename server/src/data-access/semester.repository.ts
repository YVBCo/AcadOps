import { prisma } from './prisma.js';
import { Semester, SemesterStatus } from '@prisma/client';

export interface CreateSemesterData {
    name: string;
    startDate: Date;
    endDate: Date;
    status?: SemesterStatus;
    tenantId: number;
}

export interface UpdateSemesterData {
    name?: string;
    startDate?: Date;
    endDate?: Date;
    status?: SemesterStatus;
}

export const semesterRepository = {
    // Find by ID
    async findById(id: number): Promise<Semester | null> {
        return prisma.semester.findUnique({
            where: { id },
            include: {
                subjects: {
                    include: {
                        course: true,
                        teachers: {
                            include: {
                                teacher: {
                                    include: { user: true },
                                },
                            },
                        },
                    },
                },
                _count: {
                    select: { subjects: true, students: true },
                },
            },
        });
    },

    // Create semester
    async create(data: CreateSemesterData): Promise<Semester> {
        return prisma.semester.create({
            data,
        });
    },

    // Update semester
    async update(id: number, data: UpdateSemesterData): Promise<Semester> {
        return prisma.semester.update({
            where: { id },
            data,
        });
    },

    // Delete semester (only if no subjects exist)
    async delete(id: number): Promise<Semester> {
        return prisma.semester.delete({
            where: { id },
        });
    },

    // Find all semesters (optionally tenant-scoped)
    async findAll(status?: SemesterStatus, tenantId?: number): Promise<Semester[]> {
        const where: any = {};
        if (status) where.status = status;
        if (tenantId) where.tenantId = tenantId;
        return prisma.semester.findMany({
            where: Object.keys(where).length > 0 ? where : undefined,
            include: {
                _count: {
                    select: { subjects: true, students: true },
                },
            },
            orderBy: { startDate: 'desc' },
        });
    },

    // Find active semester (optionally tenant-scoped)
    async findActive(tenantId?: number): Promise<Semester | null> {
        return prisma.semester.findFirst({
            where: { status: 'ACTIVE', ...(tenantId && { tenantId }) },
            include: {
                subjects: true,
            },
        });
    },

    // Open semester (set status to ACTIVE)
    async open(id: number): Promise<Semester> {
        return prisma.semester.update({
            where: { id },
            data: { status: 'ACTIVE' },
        });
    },

    // Close semester (set status to CLOSED)
    async close(id: number): Promise<Semester> {
        return prisma.semester.update({
            where: { id },
            data: { status: 'CLOSED' },
        });
    },

    // Archive semester
    async archive(id: number): Promise<Semester> {
        return prisma.semester.update({
            where: { id },
            data: { status: 'ARCHIVED' },
        });
    },

    // Check if semester is active
    async isActive(id: number): Promise<boolean> {
        const semester = await prisma.semester.findUnique({
            where: { id },
            select: { status: true },
        });
        return semester?.status === 'ACTIVE';
    },
};

export type SemesterRepository = typeof semesterRepository;
