import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export class FirstYearCoordinatorRepository {
    /**
     * Get all first year (semester 1-2) students grouped by batch and department
     */
    async getFirstYearStudents(filters?: {
        batchId?: number;
        semester?: number;
        departmentId?: number;
    }) {
        const where: Prisma.StudentProfileWhereInput = {
            currentSemester: filters?.semester || { in: [1, 2] },
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
    async getActiveBatches() {
        return await prisma.batch.findMany({
            where: {
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
    async getAllDepartments() {
        return await prisma.department.findMany({
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
    async getCycleDepartments() {
        return await prisma.department.findMany({
            where: {
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
    async getCycleAllocation(batchId: number, optedDepartmentId: number) {
        return await prisma.cycleDepartmentAllocation.findUnique({
            where: {
                batchId_optedDepartmentId: {
                    batchId,
                    optedDepartmentId,
                },
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
    async getBatchAllocations(batchId: number) {
        return await prisma.cycleDepartmentAllocation.findMany({
            where: { batchId },
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
        cycleDepartmentId: number
    ) {
        return await prisma.studentProfile.updateMany({
            where: {
                batchId,
                optedDepartmentId,
                currentSemester: semester,
            },
            data: {
                cycleDepartmentId,
            },
        });
    }

    /**
     * Get student count by department and batch
     */
    async getStudentCountsByDepartment(batchId: number) {
        const students = await prisma.studentProfile.groupBy({
            by: ['optedDepartmentId', 'currentSemester'],
            where: {
                batchId,
                currentSemester: { in: [1, 2] },
                optedDepartmentId: { not: null },
            },
            _count: true,
        });

        return students;
    }

    /**
     * Get opposite cycle department (Physics <-> Chemistry)
     */
    async getOppositeCycleDepartment(cycleDepartmentId: number) {
        const cycleDepts = await this.getCycleDepartments();
        return cycleDepts.find((dept) => dept.id !== cycleDepartmentId) || null;
    }
}

export default new FirstYearCoordinatorRepository();
