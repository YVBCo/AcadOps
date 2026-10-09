import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../__tests__/mocks/prisma.mock.js';

vi.mock('../data-access/prisma.js', () => ({ prisma: prismaMock, default: prismaMock }));

const { default: firstYearCoordinatorRepository } = await import('../data-access/first-year-coordinator.repository.js');
const { default: firstYearCoordinatorService } = await import('./first-year-coordinator.service.js');

describe('FirstYearCoordinatorService tenant isolation', () => {
    beforeEach(() => resetPrismaMock());

    it('limits first-year students to the authenticated tenant', async () => {
        prismaMock.studentProfile.findMany.mockResolvedValue([]);

        await firstYearCoordinatorRepository.getFirstYearStudents(undefined, 12);

        expect(prismaMock.studentProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ user: { tenantId: 12 } }),
        }));
    });

    it('limits dashboard batches, departments, and cycle departments to the tenant', async () => {
        prismaMock.batch.findMany.mockResolvedValue([]);
        prismaMock.department.findMany.mockResolvedValue([]);

        await firstYearCoordinatorRepository.getActiveBatches(12);
        await firstYearCoordinatorRepository.getAllDepartments(12);
        await firstYearCoordinatorRepository.getCycleDepartments(12);

        expect(prismaMock.batch.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ tenantId: 12 }),
        }));
        expect(prismaMock.department.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: { tenantId: 12 },
        }));
        expect(prismaMock.department.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
            where: expect.objectContaining({ tenantId: 12, isCycleDepartment: true }),
        }));
    });

    it('scopes cycle allocations and student counts to the tenant batch', async () => {
        prismaMock.cycleDepartmentAllocation.findMany.mockResolvedValue([]);
        prismaMock.studentProfile.groupBy.mockResolvedValue([]);

        await firstYearCoordinatorRepository.getBatchAllocations(7, 12);
        await firstYearCoordinatorRepository.getStudentCountsByDepartment(7, 12);

        expect(prismaMock.cycleDepartmentAllocation.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                batchId: 7,
                batch: { tenantId: 12 },
                optedDepartment: { tenantId: 12 },
                semester1Cycle: { tenantId: 12 },
            },
        }));
        expect(prismaMock.studentProfile.groupBy).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ batchId: 7, user: { tenantId: 12 } }),
        }));
    });

    it('refuses a cycle allocation when any referenced record belongs to another tenant', async () => {
        prismaMock.batch.findFirst.mockResolvedValue({ id: 7 } as any);
        prismaMock.department.findFirst
            .mockResolvedValueOnce({ id: 20 } as any)
            .mockResolvedValueOnce(null);

        await expect(firstYearCoordinatorService.allocateCycle(7, 20, 30, 99, 12))
            .rejects.toThrow('Batch and departments must belong to your institution');
        expect(prismaMock.cycleDepartmentAllocation.create).not.toHaveBeenCalled();
        expect(prismaMock.studentProfile.updateMany).not.toHaveBeenCalled();
    });
});
