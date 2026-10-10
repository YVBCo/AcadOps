import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../data-access/prisma.js', async () => {
    const { prismaMock } = await import('../__tests__/mocks/prisma.mock.js');
    return { prisma: prismaMock };
});

vi.mock('../data-access/index.js', () => ({
    auditLogRepository: { create: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../data-access/internal-assessment.repository.js', () => ({
    internalAssessmentRepository: { findConfig: vi.fn() },
    internalMarksDetailRepository: {},
}));

import { prismaMock } from '../__tests__/mocks/prisma.mock.js';
import { auditLogRepository } from '../data-access/index.js';
import { internalAssessmentRepository } from '../data-access/internal-assessment.repository.js';
import { internalAssessmentService } from './internal-assessment.service.js';

describe('internal assessment recalculation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('recalculates finalized marks within the department and writes an audit record atomically', async () => {
        vi.mocked(prismaMock.course.findFirst).mockResolvedValue({ id: 10 } as never);
        vi.mocked(internalAssessmentRepository.findConfig).mockResolvedValue({
            id: 20,
            courseId: 10,
            semesterNumber: 1,
            numInternals: 3,
            maxMarksPerInternal: 30,
            internalsToConsider: 2,
            internalWeightage: 30,
            hasAssignment: true,
            numAssignments: 1,
            maxAssignmentMarks: 20,
            assignmentWeightage: 20,
            hasLab: false,
            numLabExams: 0,
            maxLabMarks: 0,
            labWeightage: 0,
            totalMarks: 50,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        vi.mocked(prismaMock.section.findMany).mockResolvedValue([{ id: 30 }] as never);
        vi.mocked(prismaMock.internalMarksDetail.findMany).mockResolvedValue([{
            id: 40,
            internal1: 18,
            internal2: 21,
            internal3: 25,
            assignmentMarks: 17,
            calculatedTotal: null,
        }] as never);
        vi.mocked(prismaMock.internalMarksDetail.update).mockResolvedValue({} as never);

        const result = await internalAssessmentService.recalculateAllMarks(10, 1, 50, 60);

        expect(result).toEqual({ updated: 1 });
        expect(prismaMock.internalMarksDetail.update).toHaveBeenCalledWith({
            where: { id: 40 },
            data: { calculatedTotal: 40 },
        });
        expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
        expect(auditLogRepository.create).toHaveBeenCalledWith(expect.objectContaining({
            action: 'RECALCULATE_ALL_MARKS',
            entityId: 20,
            newValue: expect.objectContaining({ recordsUpdated: 1 }),
        }), prismaMock);
    });

    it('returns successfully when the department has no sections', async () => {
        vi.mocked(prismaMock.course.findFirst).mockResolvedValue({ id: 10 } as never);
        vi.mocked(internalAssessmentRepository.findConfig).mockResolvedValue({
            id: 20,
            courseId: 10,
            semesterNumber: 1,
            numInternals: 3,
            maxMarksPerInternal: 30,
            internalsToConsider: 2,
            internalWeightage: 30,
            hasAssignment: true,
            numAssignments: 1,
            maxAssignmentMarks: 20,
            assignmentWeightage: 20,
            hasLab: false,
            numLabExams: 0,
            maxLabMarks: 0,
            labWeightage: 0,
            totalMarks: 50,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        vi.mocked(prismaMock.section.findMany).mockResolvedValue([] as never);

        await expect(internalAssessmentService.recalculateAllMarks(10, 1, 50, 60))
            .resolves.toEqual({ updated: 0 });
        expect(prismaMock.internalMarksDetail.findMany).not.toHaveBeenCalled();
        expect(auditLogRepository.create).not.toHaveBeenCalled();
    });
});
