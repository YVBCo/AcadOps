import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../data-access/prisma.js', async () => {
    const { prismaMock } = await import('../__tests__/mocks/prisma.mock.js');
    return { prisma: prismaMock, default: prismaMock };
});

vi.mock('../data-access/index.js', () => ({
    auditLogRepository: { create: vi.fn().mockResolvedValue({}) },
}));

import { prismaMock } from '../__tests__/mocks/prisma.mock.js';
import { auditLogRepository } from '../data-access/index.js';
import { clerkMarksService } from './clerk-marks.service.js';

describe('Clerk manual semester marks', () => {
    beforeEach(() => vi.clearAllMocks());

    it('creates the COE pending-review upload and keeps manual marks in sync', async () => {
        vi.mocked(prismaMock.course.findFirst).mockResolvedValue({
            id: 10,
            tenantId: 1,
            semesterNumber: 1,
            code: 'QA101',
        } as never);
        vi.mocked(prismaMock.internalMarksSubmission.findMany).mockResolvedValue([
            { studentUsn: 'QA001', marks: 40 },
        ] as never);
        vi.mocked(prismaMock.user.findMany).mockResolvedValue([{
            id: 100,
            studentProfile: {
                batchId: 20,
                rollNumber: 'QA001',
                temporaryUsn: null,
                permanentUsn: null,
            },
        }] as never);
        vi.mocked(prismaMock.semesterEndMarks.upsert).mockResolvedValue({} as never);
        vi.mocked(prismaMock.semesterMarkUpload.create).mockResolvedValue({ id: 30 } as never);

        const result = await clerkMarksService.submitSemesterMarks(
            2,
            20,
            10,
            [{ studentUsn: 'QA001', marks: 40, examType: 'REGULAR' }],
            200,
        );

        expect(result).toEqual({ count: 1 });
        expect(prismaMock.semesterEndMarks.upsert).toHaveBeenCalledTimes(1);
        expect(prismaMock.semesterMarkUpload.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                status: 'PENDING',
                uploadedBy: 200,
                marks: {
                    create: [{
                        studentUsn: 'QA001',
                        studentId: 100,
                        courseId: 10,
                        externalMarksRaw: 80,
                        externalMarks: 40,
                    }],
                },
            }),
        }));
        expect(auditLogRepository.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects manual marks when no matching internal marks have been submitted', async () => {
        vi.mocked(prismaMock.course.findFirst).mockResolvedValue({
            id: 10,
            tenantId: 1,
            semesterNumber: 1,
            code: 'QA101',
        } as never);
        vi.mocked(prismaMock.internalMarksSubmission.findMany).mockResolvedValue([] as never);

        await expect(clerkMarksService.submitSemesterMarks(
            2,
            20,
            10,
            [{ studentUsn: 'QA001', marks: 40, examType: 'REGULAR' }],
            200,
        )).rejects.toThrow('Internal marks not submitted for some students');
        expect(prismaMock.user.findMany).not.toHaveBeenCalled();
        expect(prismaMock.semesterMarkUpload.create).not.toHaveBeenCalled();
    });
});
