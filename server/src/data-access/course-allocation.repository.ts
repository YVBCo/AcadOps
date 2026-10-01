import { CourseAllocation, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export interface CreateCourseAllocationData {
    courseId: number;
    sectionId: number;
    semesterNumber: number;
    teacherId?: number | null;
}

export interface UpdateCourseAllocationData {
    teacherId?: number | null;
}

export const courseAllocationRepository = {
    // Create or update course allocation
    async upsert(data: CreateCourseAllocationData): Promise<CourseAllocation> {
        return prisma.courseAllocation.upsert({
            where: {
                courseId_sectionId_semesterNumber: {
                    courseId: data.courseId,
                    sectionId: data.sectionId,
                    semesterNumber: data.semesterNumber,
                },
            },
            create: data,
            update: {
                teacherId: data.teacherId,
            },
        });
    },

    // Get allocations by section
    async findBySection(sectionId: number): Promise<CourseAllocation[]> {
        return prisma.courseAllocation.findMany({
            where: { sectionId },
            include: {
                course: {
                    include: {
                        department: true,
                    },
                },
                section: {
                    include: {
                        batch: true,
                    },
                },
                teacher: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
            },
            orderBy: { semesterNumber: 'asc' },
        });
    },

    // Get allocations by section and semester
    async findBySectionAndSemester(
        sectionId: number,
        semesterNumber: number
    ): Promise<CourseAllocation[]> {
        return prisma.courseAllocation.findMany({
            where: { sectionId, semesterNumber },
            include: {
                course: true,
                section: {
                    include: {
                        batch: true,
                    },
                },
                teacher: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
            },
        });
    },

    // Get allocations by teacher
    async findByTeacher(teacherId: number): Promise<CourseAllocation[]> {
        return prisma.courseAllocation.findMany({
            where: { teacherId },
            include: {
                course: true,
                section: {
                    include: {
                        department: true,
                        batch: true,
                    },
                },
            },
        });
    },

    // Get allocation by course and section
    async findByCourseAndSection(
        courseId: number,
        sectionId: number,
        semesterNumber: number
    ): Promise<CourseAllocation | null> {
        return prisma.courseAllocation.findUnique({
            where: {
                courseId_sectionId_semesterNumber: {
                    courseId,
                    sectionId,
                    semesterNumber,
                },
            },
            include: {
                course: true,
                section: true,
                teacher: true,
            },
        });
    },

    // Update teacher assignment
    async assignTeacher(
        id: number,
        teacherId: number | null
    ): Promise<CourseAllocation> {
        return prisma.courseAllocation.update({
            where: { id },
            data: { teacherId },
        });
    },

    // Delete allocation
    async delete(id: number): Promise<void> {
        await prisma.courseAllocation.delete({
            where: { id },
        });
    },

    // Find by id
    async findById(id: number): Promise<CourseAllocation | null> {
        return prisma.courseAllocation.findUnique({
            where: { id },
            include: {
                course: true,
                section: true,
                teacher: true,
            },
        });
    },

    // Get courses allocated to a department's sections
    async findByDepartmentAndSemester(
        departmentId: number,
        semesterNumber: number
    ): Promise<CourseAllocation[]> {
        return prisma.courseAllocation.findMany({
            where: {
                semesterNumber,
                section: {
                    departmentId,
                },
            },
            include: {
                course: true,
                section: {
                    include: {
                        department: true,
                        batch: true,
                    },
                },
                teacher: {
                    include: {
                        user: {
                            select: { id: true, name: true },
                        },
                    },
                },
            },
        });
    },
};
