import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export class FirstYearCoordinatorRepository {
    /**
     * Get all first year (semester 1-2) students grouped by batch and department
     */
    async getFirstYearStudents(filters: {
        batchId?: number;
        semester?: number;
        departmentId?: number;
    } | undefined, tenantId: number) {
        const where: Prisma.StudentProfileWhereInput = {
            currentSemester: filters?.semester || { in: [1, 2] },
            user: { tenantId },
            ...(filters?.batchId && { batchId: filters.batchId }),
            ...(filters?.departmentId && { optedDepartmentId: filters.departmentId }),
        };

        return await prisma.studentProfile.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                batch: {
                    select: {
                        id: true,
                        name: true,
                        currentSemester: true,
                    },
                },
                optedDepartment: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
                cycleDepartment: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
            },
            orderBy: [
                { batchId: 'desc' },
                { optedDepartmentId: 'asc' },
                { user: { name: 'asc' } },
            ],
        });
    }

    /**
     * Get all active batches with first year students
     */
    async getActiveBatches(tenantId: number) {
        return await prisma.batch.findMany({
            where: {
                tenantId,
                isGraduated: false,
                currentSemester: { in: [1, 2, 3, 4] }, // Include batches in early years
            },
            include: {
                _count: {
                    select: {
                        students: {
                            where: {
                                currentSemester: { in: [1, 2] },
                            },
                        },
                    },
                },
            },
            orderBy: { startYear: 'desc' },
        });
    }

    /**
     * Get all departments
     */
    async getAllDepartments(tenantId: number) {
        return await prisma.department.findMany({
            where: { tenantId },
            select: {
                id: true,
                name: true,
                code: true,
                isCycleDepartment: true,
            },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Get cycle departments (Physics and Chemistry)
     */
    async getCycleDepartments(tenantId: number) {
        return await prisma.department.findMany({
            where: {
                tenantId,
                isCycleDepartment: true,
            },
            select: {
                id: true,
                name: true,
                code: true,
            },
        });
    }

    /**
     * Check if a department already has a cycle allocation for a batch
     */
    async getCycleAllocation(batchId: number, optedDepartmentId: number, tenantId: number) {
        return await prisma.cycleDepartmentAllocation.findFirst({
            where: {
                batchId,
                optedDepartmentId,
                batch: { tenantId },
                optedDepartment: { tenantId },
                semester1Cycle: { tenantId },
            },
            include: {
                batch: true,
                optedDepartment: true,
                semester1Cycle: true,
                allocatedByUser: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
    }

    /**
     * Get all cycle allocations for a batch
     */
    async getBatchAllocations(batchId: number, tenantId: number) {
        return await prisma.cycleDepartmentAllocation.findMany({
            where: {
                batchId,
                batch: { tenantId },
                optedDepartment: { tenantId },
                semester1Cycle: { tenantId },
            },
            include: {
                optedDepartment: true,
                semester1Cycle: true,
                allocatedByUser: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
    }

    /**
     * Create a new cycle allocation
     */
    async createCycleAllocation(data: {
        batchId: number;
        optedDepartmentId: number;
        semester1CycleId: number;
        allocatedBy: number;
    }) {
        return await prisma.cycleDepartmentAllocation.create({
            data,
            include: {
                batch: true,
                optedDepartment: true,
                semester1Cycle: true,
            },
        });
    }

    /**
     * Update students' cycle department based on allocation
     */
    async updateStudentsCycleDepartment(
        batchId: number,
        optedDepartmentId: number,
        semester: number,
        cycleDepartmentId: number,
        tenantId: number
    ) {
        return await prisma.studentProfile.updateMany({
            where: {
                batchId,
                optedDepartmentId,
                currentSemester: semester,
                user: { tenantId },
            },
            data: {
                cycleDepartmentId,
            },
        });
    }

    /**
     * Get student count by department and batch
     */
    async getStudentCountsByDepartment(batchId: number, tenantId: number) {
        const students = await prisma.studentProfile.groupBy({
            by: ['optedDepartmentId', 'currentSemester'],
            where: {
                batchId,
                currentSemester: { in: [1, 2] },
                optedDepartmentId: { not: null },
                user: { tenantId },
            },
            _count: true,
        });

        return students;
    }

    /**
     * Get opposite cycle department (Physics <-> Chemistry)
     */
    async getOppositeCycleDepartment(cycleDepartmentId: number, tenantId: number) {
        const cycleDepts = await this.getCycleDepartments(tenantId);
        return cycleDepts.find((dept) => dept.id !== cycleDepartmentId) || null;
    }

    /** Validate every referenced record before changing a batch's cycle allocation. */
    async hasTenantAllocationReferences(
        batchId: number,
        optedDepartmentId: number,
        cycleDepartmentId: number,
        tenantId: number
    ) {
        const [batch, optedDepartment, cycleDepartment] = await Promise.all([
            prisma.batch.findFirst({ where: { id: batchId, tenantId }, select: { id: true } }),
            prisma.department.findFirst({ where: { id: optedDepartmentId, tenantId, isCycleDepartment: false }, select: { id: true } }),
            prisma.department.findFirst({ where: { id: cycleDepartmentId, tenantId, isCycleDepartment: true }, select: { id: true } }),
        ]);

        return Boolean(batch && optedDepartment && cycleDepartment);
    }
}

export default new FirstYearCoordinatorRepository();
