import { prisma } from './prisma.js';
import { Program, Prisma } from '@prisma/client';

export interface CreateProgramData {
    name: string;
    code: string;
    departmentIds: number[];
    durationYears: number;
    description?: string;
    tenantId: number;
}

export interface UpdateProgramData {
    name?: string;
    code?: string;
    durationYears?: number;
    description?: string;
    departmentIds?: number[];
}

export const programRepository = {
    async create(data: CreateProgramData): Promise<Program> {
        const { departmentIds, ...rest } = data;
        return prisma.program.create({
            data: {
                ...rest,
                departments: {
                    connect: departmentIds.map((id) => ({ id })),
                },
            },
            include: { departments: true },
        });
    },

    async findById(id: number): Promise<Program | null> {
        return prisma.program.findUnique({
            where: { id },
            include: {
                departments: true,
                courses: true,
                _count: { select: { courses: true, students: true } },
            },
        });
    },

    async findByCode(code: string, tenantId?: number): Promise<Program | null> {
        return prisma.program.findFirst({
            where: { code, ...(tenantId && { tenantId }) },
        });
    },

    async findByDepartment(departmentId: number): Promise<Program[]> {
        return prisma.program.findMany({
            where: {
                departments: {
                    some: { id: departmentId },
                },
            },
            include: {
                departments: true,
                _count: { select: { courses: true, students: true } },
            },
            orderBy: { name: 'asc' },
        });
    },

    async findAll(tenantId?: number): Promise<Program[]> {
        return prisma.program.findMany({
            where: tenantId ? { tenantId } : undefined,
            include: {
                departments: true,
                _count: { select: { courses: true, students: true } },
            },
            orderBy: { name: 'asc' },
        });
    },

    async update(id: number, data: UpdateProgramData): Promise<Program> {
        const { departmentIds, ...rest } = data;
        return prisma.program.update({
            where: { id },
            data: {
                ...rest,
                departments: departmentIds
                    ? { set: departmentIds.map((id) => ({ id })) }
                    : undefined,
            },
            include: { departments: true },
        });
    },

    async delete(id: number): Promise<void> {
        await prisma.program.delete({ where: { id } });
    },
};

export type ProgramRepository = typeof programRepository;
