import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../__tests__/mocks/prisma.mock.js';

vi.mock('../data-access/prisma.js', () => ({ prisma: prismaMock, default: prismaMock }));

const { placementService } = await import('./placement.service.js');

describe('PlacementService tenant isolation and workflows', () => {
    beforeEach(() => resetPrismaMock());

    it('scopes company listing to the active tenant', async () => {
        prismaMock.placementCompany.findMany.mockResolvedValue([]);

        await placementService.getCompanies(14);

        expect(prismaMock.placementCompany.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 14 } }));
    });

    it('limits a company account to its own jobs', async () => {
        prismaMock.placementJob.findMany.mockResolvedValue([]);

        await placementService.getJobs(14, undefined, { companyUserId: 29 });

        expect(prismaMock.placementJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ tenantId: 14, company: { userId: 29, tenantId: 14 } }),
        }));
    });

    it('only allows applications to approved active jobs and tenant-owned CVs', async () => {
        prismaMock.placementJob.findFirst.mockResolvedValue({ id: 7, tenantId: 14, isApproved: true, isActive: true });
        prismaMock.placementCv.findFirst.mockResolvedValue({ id: 5 });
        prismaMock.placementApplication.create.mockResolvedValue({ id: 1 });

        await placementService.apply(14, 33, 7, 5);

        expect(prismaMock.placementJob.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 7, tenantId: 14, isApproved: true, isActive: true },
        }));
        expect(prismaMock.placementCv.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 5, profile: { tenantId: 14, userId: 33 } },
        }));
        expect(prismaMock.placementApplication.create).toHaveBeenCalledWith(expect.objectContaining({
            data: { tenantId: 14, studentId: 33, jobId: 7, cvId: 5, status: 'APPLIED' },
        }));
    });

    it('marks the student placed when the company selects their application', async () => {
        prismaMock.placementApplication.findFirst.mockResolvedValue({ id: 10, studentId: 33 });
        prismaMock.placementApplication.update.mockResolvedValue({ id: 10, status: 'SELECTED' });
        prismaMock.placementStudentProfile.upsert.mockResolvedValue({ isPlaced: true });

        await placementService.updateApplicationStatus(14, 10, 'SELECTED' as any, undefined, 29);

        expect(prismaMock.placementApplication.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 10, tenantId: 14, job: { company: { userId: 29, tenantId: 14 } } },
        }));
        expect(prismaMock.placementStudentProfile.upsert).toHaveBeenCalledWith({
            where: { tenantId_userId: { tenantId: 14, userId: 33 } },
            update: { isPlaced: true },
            create: { tenantId: 14, userId: 33, cgpa: 0, isPlaced: true },
        });
    });
});
