import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../__tests__/mocks/prisma.mock.js';

vi.mock('./prisma.js', () => ({ prisma: prismaMock }));

const { batchRepository } = await import('./batch.repository.js');

describe('batchRepository tenant isolation', () => {
    beforeEach(() => resetPrismaMock());

    it('counts only students belonging to the requested tenant', async () => {
        prismaMock.batch.findMany.mockResolvedValue([]);

        await batchRepository.findAll(14);

        expect(prismaMock.batch.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { tenantId: 14 },
            include: {
                _count: {
                    select: { students: { where: { user: { tenantId: 14 } } } },
                },
            },
        }));
    });

    it('does not return students from another tenant in a batch', async () => {
        prismaMock.studentProfile.findMany.mockResolvedValue([]);

        await batchRepository.getStudents(22, 14);

        expect(prismaMock.studentProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { batchId: 22, user: { tenantId: 14 } },
        }));
    });
});
