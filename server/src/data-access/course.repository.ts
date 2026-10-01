import { prisma } from './prisma.js';
import { Course, Prisma } from '@prisma/client';

export interface CreateCourseData {
    name: string;
    code: string;
    credits: number;
    departmentId: number;
    tenantId: number;
    programId?: number;
    semesterNumber?: number;
    targetBatchId?: number;
    internalMarks?: number;
    externalMarks?: number;
    description?: string;
}

export interface UpdateCourseData {
    name?: string;
    code?: string;
    credits?: number;
    semesterNumber?: number;
    internalMarks?: number;
    externalMarks?: number;
    description?: string;
}

export const courseRepository = {
    async create(data: CreateCourseData): Promise<Course> {
        return prisma.course.create({
            data,
            include: { department: true, program: true },
        });
    },

    async findById(id: number): Promise<Course | null> {
        return prisma.course.findUnique({
            where: { id },
            include: {
                department: true,
                program: true,
                targetBatch: true,
                subjects: {
                    include: { semester: true },
                },
                _count: { select: { subjects: true } },
            },
        });
    },

    async findByCode(code: string, tenantId?: number): Promise<Course | null> {
        return prisma.course.findFirst({
            where: { code, ...(tenantId && { tenantId }) },
        });
    },

    async findByDepartment(departmentId: number): Promise<Course[]> {
        return prisma.course.findMany({
            where: { departmentId },
            include: {
                program: true,
                _count: { select: { subjects: true } },
            },
            orderBy: { code: 'asc' },
        });
    },

    async findByProgram(programId: number): Promise<Course[]> {
        return prisma.course.findMany({
            where: { programId },
            include: {
                _count: { select: { subjects: true } },
            },
            orderBy: { code: 'asc' },
        });
    },

    async findAll(options?: { departmentId?: number; programId?: number; tenantId?: number }): Promise<Course[]> {
        const where: Prisma.CourseWhereInput = {};
        if (options?.departmentId) where.departmentId = options.departmentId;
        if (options?.programId) where.programId = options.programId;
        if (options?.tenantId) where.tenantId = options.tenantId;

        return prisma.course.findMany({
            where,
            include: {
                department: true,
                program: true,
                targetBatch: true,
                _count: { select: { subjects: true } },
            },
            orderBy: [{ department: { name: 'asc' } }, { code: 'asc' }],
        });
    },

    async update(id: number, data: UpdateCourseData): Promise<Course> {
        return prisma.course.update({
            where: { id },
            data,
            include: { department: true, program: true },
        });
    },

    async lock(id: number): Promise<Course> {
        return prisma.course.update({
            where: { id },
            data: {
                isLocked: true,
                lockedAt: new Date(),
            },
            include: { department: true, program: true },
        });
    },

    async delete(id: number): Promise<void> {
        await prisma.course.delete({ where: { id } });
    },
};

export type CourseRepository = typeof courseRepository;

