import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../__tests__/mocks/prisma.mock.js';

vi.mock('../data-access/prisma.js', () => ({ prisma: prismaMock, default: prismaMock }));

const { nodueService } = await import('./nodue.service.js');

describe('NoDueService tenant-scoped statistics', () => {
    beforeEach(() => resetPrismaMock());

    it('calculates clearance statistics only for the active tenant', async () => {
        prismaMock.nodueClearanceRequest.count
            .mockResolvedValueOnce(8)
            .mockResolvedValueOnce(3)
            .mockResolvedValueOnce(2)
            .mockResolvedValueOnce(1);

        await expect(nodueService.getClearanceStats(14)).resolves.toEqual({ total: 8, cleared: 3, pending: 5, pendingHod: 2, pendingPrincipal: 1 });
        expect(prismaMock.nodueClearanceRequest.count).toHaveBeenNthCalledWith(1, { where: { tenantId: 14 } });
        expect(prismaMock.nodueClearanceRequest.count).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { tenantId: 14, currentStage: expect.any(String) } }));
        expect(prismaMock.nodueClearanceRequest.count).toHaveBeenNthCalledWith(3, expect.objectContaining({ where: { tenantId: 14, currentStage: expect.any(String) } }));
        expect(prismaMock.nodueClearanceRequest.count).toHaveBeenNthCalledWith(4, expect.objectContaining({ where: { tenantId: 14, currentStage: expect.any(String) } }));
    });

    it('treats waived dues as resolved when evaluating clearance stages', async () => {
        prismaMock.nodueClearanceRequest.findFirst.mockResolvedValue({ id: 3, currentStage: 'LIBRARY_REVIEW' });
        prismaMock.nodueLibraryDue.findMany.mockResolvedValue([]);
        prismaMock.nodueStudentDue.findMany.mockResolvedValue([{ id: 8, status: 'PENDING' }]);
        prismaMock.nodueClearanceRequest.update.mockResolvedValue({ id: 3, currentStage: 'DEPARTMENT_REVIEW' });

        await nodueService.evaluateClearanceStage(14, 33);

        expect(prismaMock.nodueLibraryDue.findMany).toHaveBeenCalledWith({
            where: { tenantId: 14, studentId: 33, hasDues: true, status: 'PENDING' },
        });
        expect(prismaMock.nodueClearanceRequest.update).toHaveBeenCalledWith({
            where: { id: 3 },
            data: { currentStage: 'DEPARTMENT_REVIEW' },
        });
    });
});
