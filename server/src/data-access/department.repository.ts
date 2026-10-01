import { prisma } from './prisma.js';
import { Department, Prisma } from '@prisma/client';

export interface CreateDepartmentData {
    name: string;
    code: string;
    description?: string;
    tenantId: number;
}

export interface UpdateDepartmentData {
    name?: string;
    code?: string;
    description?: string;
}

export const departmentRepository = {
    // Find by ID
    async findById(id: number): Promise<Department | null> {
        return prisma.department.findUnique({
            where: { id },
            include: {
                programs: true,
                courses: true,
                _count: {
                    select: { users: true },
                },
            },
        });
    },

    // Find by code (optionally tenant-scoped)
    async findByCode(code: string, tenantId?: number): Promise<Department | null> {
        return prisma.department.findFirst({
            where: { code, ...(tenantId && { tenantId }) },
        });
    },

    // Find by name (optionally tenant-scoped)
    async findByName(name: string, tenantId?: number): Promise<Department | null> {
        return prisma.department.findFirst({
            where: { name, ...(tenantId && { tenantId }) },
        });
    },

    // Create department
    async create(data: CreateDepartmentData): Promise<Department> {
        return prisma.department.create({
            data,
        });
    },

    // Update department
    async update(id: number, data: UpdateDepartmentData): Promise<Department> {
        return prisma.department.update({
            where: { id },
            data,
        });
    },

    // Delete department
    async delete(id: number): Promise<Department> {
        return prisma.department.delete({
            where: { id },
        });
    },

    // Find all departments (optionally tenant-scoped)
    async findAll(tenantId?: number): Promise<Department[]> {
        return prisma.department.findMany({
            where: tenantId ? { tenantId } : undefined,
            include: {
                programs: true,
                _count: {
                    select: { users: true, courses: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    },
};

export type DepartmentRepository = typeof departmentRepository;
