import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../data-access/prisma.js', async () => {
    const { prismaMock } = await import('../__tests__/mocks/prisma.mock.js');
    return { prisma: prismaMock, default: prismaMock };
});

import { prismaMock } from '../__tests__/mocks/prisma.mock.js';
import { resultsService } from './results.service.js';

describe('results generation', () => {
    beforeEach(() => vi.clearAllMocks());

    it('combines submitted internal marks with COE-posted marks from a Clerk upload', async () => {
        vi.mocked(prismaMock.internalMarksSubmission.findMany).mockResolvedValue([{
            studentUsn: 'QA001',
            marks: 40,
        }] as never);
        vi.mocked(prismaMock.semesterMarkUpload.findMany).mockResolvedValue([{
            marks: [{ studentUsn: 'QA001', externalMarks: 40 }],
        }] as never);
        vi.mocked(prismaMock.result.upsert).mockResolvedValue({} as never);

        const result = await resultsService.generate(2, 20, 10);

        expect(result).toEqual({ generated: 1, skipped: 0, missingInternal: undefined, missingSemester: undefined });
        expect(prismaMock.semesterMarkUpload.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { departmentId: 2, batchId: 20, courseId: 10, status: 'POSTED' },
        }));
        expect(prismaMock.result.upsert).toHaveBeenCalledWith(expect.objectContaining({
            create: expect.objectContaining({
                studentUsn: 'QA001',
                internalMarks: 40,
                semesterMarks: 40,
                totalMarks: 80,
                status: 'PASS',
            }),
        }));
    });
});
