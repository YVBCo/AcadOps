import { prisma } from './prisma.js';
import { Section, Prisma } from '@prisma/client';

export interface CreateSectionData {
    name: string;
    departmentId: number;
    batchId: number;
    tenantId: number;
}

export const sectionRepository = {
    // Create new section
    async create(data: CreateSectionData): Promise<Section> {
        return prisma.section.create({
            data: {
                name: data.name,
                departmentId: data.departmentId,
                batchId: data.batchId,
                tenantId: data.tenantId,
            },
            include: {
                department: true,
                batch: true,
            },
        });
    },

    // Find section by ID
    async findById(id: number): Promise<Section | null> {
        return prisma.section.findUnique({
            where: { id },
            include: {
                department: true,
                batch: true,
                students: {
                    include: {
                        user: true,
                    },
                },
            },
        });
    },

    // Find sections by department and batch
    async findByDepartmentAndBatch(departmentId: number, batchId: number): Promise<Section[]> {
        return prisma.section.findMany({
            where: { departmentId, batchId },
            include: {
                department: true,
                batch: true,
                _count: {
                    select: { students: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    },

    // Find sections by department
    async findByDepartment(departmentId: number): Promise<Section[]> {
        return prisma.section.findMany({
            where: { departmentId },
            include: {
                department: true,
                batch: true,
                _count: {
                    select: { students: true },
                },
            },
            orderBy: [{ batch: { startYear: 'desc' } }, { name: 'asc' }],
        });
    },

    // Find all sections (optionally tenant-scoped)
    async findAll(tenantId?: number): Promise<Section[]> {
        return prisma.section.findMany({
            where: tenantId ? { tenantId } : undefined,
            include: {
                department: true,
                batch: true,
                _count: {
                    select: { students: true },
                },
            },
            orderBy: [
                { department: { name: 'asc' } },
                { batch: { startYear: 'desc' } },
                { name: 'asc' },
            ],
        });
    },

    // Delete section
    async delete(id: number): Promise<Section> {
        // First unassign all students
        await prisma.studentProfile.updateMany({
            where: { sectionId: id },
            data: { sectionId: null },
        });
        return prisma.section.delete({
            where: { id },
        });
    },

    // Update section
    async update(id: number, data: { name?: string; isLocked?: boolean }): Promise<Section> {
        return prisma.section.update({
            where: { id },
            data,
            include: {
                department: true,
                batch: true,
            },
        });
    },

    // Assign students to section (only if they don't already have one)
    async assignStudents(sectionId: number, studentProfileIds: number[]): Promise<{ assigned: number; alreadyAssigned: number }> {
        // First, check how many of these students already have a section
        const alreadyAssignedCount = await prisma.studentProfile.count({
            where: {
                id: { in: studentProfileIds },
                sectionId: { not: null },
            },
        });

        // Only update students who don't have a section yet
        const result = await prisma.studentProfile.updateMany({
            where: {
                id: { in: studentProfileIds },
                sectionId: null,  // Only update if no section assigned
            },
            data: {
                sectionId,
            },
        });

        return {
            assigned: result.count,
            alreadyAssigned: alreadyAssignedCount,
        };
    },

    // Remove students from section
    async removeStudentsFromSection(studentProfileIds: number[]): Promise<number> {
        const result = await prisma.studentProfile.updateMany({
            where: {
                id: { in: studentProfileIds },
            },
            data: {
                sectionId: null,
            },
        });
        return result.count;
    },

    // Get students in section
    async getStudents(sectionId: number) {
        return prisma.studentProfile.findMany({
            where: { sectionId },
            include: {
                user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { rollNumber: 'asc' },
        });
    },
};

export type SectionRepository = typeof sectionRepository;
