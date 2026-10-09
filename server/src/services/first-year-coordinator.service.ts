import firstYearCoordinatorRepository from '../data-access/first-year-coordinator.repository.js';

export class FirstYearCoordinatorService {
    /**
     * Get all first year students with grouping by batch and department
     */
    async getFirstYearStudents(filters: {
        batchId?: number;
        semester?: number;
        departmentId?: number;
    } | undefined, tenantId: number) {
        const students = await firstYearCoordinatorRepository.getFirstYearStudents(filters, tenantId);

        // Group by batch and department
        const grouped = students.reduce((acc, student) => {
            const batchId = student.batch?.id;
            const deptId = student.optedDepartment?.id;

            if (!batchId || !deptId) return acc;

            if (!acc[batchId]) {
                acc[batchId] = {
                    batch: student.batch,
                    departments: {},
                };
            }

            if (!acc[batchId].departments[deptId]) {
                acc[batchId].departments[deptId] = {
                    department: student.optedDepartment,
                    students: [],
                };
            }

            acc[batchId].departments[deptId].students.push({
                id: student.id,
                userId: student.userId,
                name: student.user.name,
                email: student.user.email,
                rollNumber: student.rollNumber,
                currentSemester: student.currentSemester,
                cycleDepartment: student.cycleDepartment,
                permanentUsn: student.permanentUsn,
                temporaryUsn: student.temporaryUsn,
            });

            return acc;
        }, {} as Record<number, { batch: typeof students[0]['batch']; departments: Record<number, { department: typeof students[0]['optedDepartment']; students: unknown[] }> }>);

        return grouped;
    }

    /**
     * Get all active batches
     */
    async getActiveBatches(tenantId: number) {
        return await firstYearCoordinatorRepository.getActiveBatches(tenantId);
    }

    /**
     * Get all departments
     */
    async getAllDepartments(tenantId: number) {
        return await firstYearCoordinatorRepository.getAllDepartments(tenantId);
    }

    /**
     * Get cycle departments (Physics and Chemistry)
     */
    async getCycleDepartments(tenantId: number) {
        return await firstYearCoordinatorRepository.getCycleDepartments(tenantId);
    }

    /**
     * Get all allocations for a batch
     */
    async getBatchAllocations(batchId: number, tenantId: number) {
        const allocations = await firstYearCoordinatorRepository.getBatchAllocations(batchId, tenantId);
        const studentCounts = await firstYearCoordinatorRepository.getStudentCountsByDepartment(batchId, tenantId);

        // Merge allocation data with student counts
        const result = allocations.map((allocation) => {
            const sem1Count = studentCounts.find(
                (sc) => sc.optedDepartmentId === allocation.optedDepartmentId && sc.currentSemester === 1
            )?._count || 0;

            const sem2Count = studentCounts.find(
                (sc) => sc.optedDepartmentId === allocation.optedDepartmentId && sc.currentSemester === 2
            )?._count || 0;

            return {
                ...allocation,
                studentCounts: {
                    semester1: sem1Count,
                    semester2: sem2Count,
                    total: sem1Count + sem2Count,
                },
            };
        });

        return result;
    }

    /**
     * Allocate a department to a cycle for semester 1
     * Students will automatically swap to opposite cycle in semester 2
     */
    async allocateCycle(
        batchId: number,
        optedDepartmentId: number,
        semester1CycleId: number,
        allocatedBy: number,
        tenantId: number
    ) {
        const referencesBelongToTenant = await firstYearCoordinatorRepository.hasTenantAllocationReferences(
            batchId,
            optedDepartmentId,
            semester1CycleId,
            tenantId
        );
        if (!referencesBelongToTenant) {
            throw new Error('Batch and departments must belong to your institution');
        }

        // Check if allocation already exists
        const existingAllocation = await firstYearCoordinatorRepository.getCycleAllocation(
            batchId,
            optedDepartmentId,
            tenantId
        );

        if (existingAllocation && existingAllocation.isLocked) {
            throw new Error('Cycle allocation already exists and is locked for this department and batch');
        }

        // Get opposite cycle department for semester 2
        const semester2Cycle = await firstYearCoordinatorRepository.getOppositeCycleDepartment(semester1CycleId, tenantId);

        if (!semester2Cycle) {
            throw new Error('Could not determine opposite cycle department');
        }

        // Create or update allocation record
        const allocation = await firstYearCoordinatorRepository.createCycleAllocation({
            batchId,
            optedDepartmentId,
            semester1CycleId,
            allocatedBy,
        });

        // Update all semester 1 students to the allocated cycle
        await firstYearCoordinatorRepository.updateStudentsCycleDepartment(
            batchId,
            optedDepartmentId,
            1,
            semester1CycleId,
            tenantId
        );

        // Update all semester 2 students to the opposite cycle
        await firstYearCoordinatorRepository.updateStudentsCycleDepartment(
            batchId,
            optedDepartmentId,
            2,
            semester2Cycle.id,
            tenantId
        );

        return {
            allocation,
            semester1Cycle: allocation.semester1Cycle,
            semester2Cycle,
            message: `Successfully allocated ${allocation.optedDepartment.name} to ${allocation.semester1Cycle.name} for Sem 1 and ${semester2Cycle.name} for Sem 2`,
        };
    }

    /**
     * Get allocation summary for dashboard
     */
    async getAllocationSummary(tenantId: number) {
        const batches = await this.getActiveBatches(tenantId);
        const allDepartments = await this.getAllDepartments(tenantId);

        const summary = await Promise.all(
            batches.map(async (batch) => {
                const allocations = await this.getBatchAllocations(batch.id, tenantId);
                const unallocatedDepts = allDepartments.filter(
                    (dept) => !dept.isCycleDepartment && !allocations.some((a) => a.optedDepartmentId === dept.id)
                );

                return {
                    batch,
                    allocatedCount: allocations.length,
                    unallocatedCount: unallocatedDepts.length,
                    allocations,
                    unallocatedDepartments: unallocatedDepts,
                };
            })
        );

        return summary;
    }
}

export default new FirstYearCoordinatorService();
