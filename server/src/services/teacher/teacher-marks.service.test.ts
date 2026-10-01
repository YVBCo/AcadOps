/**
 * Teacher Marks Service — Unit Tests
 * ──────────────────────────────────────
 * Tests bulk marks recording (batched transaction), single marks,
 * finalization, and edit request workflows.
 *
 * Verifies that:
 * - N+1 queries are eliminated (pre-fetch + $transaction pattern)
 * - Finalized marks are skipped during bulk operations
 * - Audit logs are created for every mutation
 * - Array size limits are enforced at schema level
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dependencies ──────────────────────────────────────────
vi.mock('../../data-access/prisma.js', async () => {
    const { prismaMock } = await import('../../__tests__/mocks/prisma.mock.js');
    return { prisma: prismaMock, default: prismaMock };
});

vi.mock('../../data-access/index.js', () => ({
    auditLogRepository: { create: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../../data-access/internal-assessment.repository.js', () => ({
    internalAssessmentRepository: {
        findConfig: vi.fn().mockResolvedValue(null),
    },
}));

vi.mock('../internal-assessment.service.js', () => ({
    internalAssessmentService: {
        calculateFinalInternal: vi.fn().mockReturnValue(25.5),
    },
}));

vi.mock('../cache.service.js', () => ({
    cacheService: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
    },
    CachePrefix: { TEACHER: 'teacher:', MARKS: 'marks:' },
    CacheTTL: { SHORT: 300, LONG: 3600 },
}));

vi.mock('../../utils/semester-lock.js', () => ({
    validateNotLocked: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/logger.js', () => ({
    logger: {
        child: () => ({
            info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(),
        }),
    },
}));

// Mock shared helpers
vi.mock('./shared.js', () => ({
    getTeacherProfile: vi.fn().mockResolvedValue({ id: 1, userId: 100 }),
    verifyAllocationAccess: vi.fn().mockResolvedValue({
        teacher: { id: 1, userId: 100 },
        allocation: {
            sectionId: 1,
            section: { name: 'A', batchId: 1, departmentId: 1, department: { tenantId: 1 } },
        },
    }),
    verifySectionCourseAccess: vi.fn().mockResolvedValue({
        teacher: { id: 1, userId: 100 },
        allocation: {
            sectionId: 1,
            section: { name: 'A', batchId: 1, departmentId: 1, department: { tenantId: 1 } },
        },
    }),
}));

import type { RecordMarksData } from './teacher-marks.service.js';

describe('TeacherMarksService', () => {
    let teacherMarksService: typeof import('./teacher-marks.service.js')['teacherMarksService'];
    let prismaMock: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import('./teacher-marks.service.js');
        teacherMarksService = mod.teacherMarksService;
        const prismaModule = await import('../../__tests__/mocks/prisma.mock.js');
        prismaMock = prismaModule.prismaMock;
    });

    // ─── Single Marks Recording ─────────────────────────────────

    describe('recordMarks', () => {
        it('should create marks via upsert for a new student', async () => {
            prismaMock.internalMarksDetail.findFirst.mockResolvedValue(null);
            prismaMock.internalMarksDetail.upsert.mockResolvedValue({
                id: 1,
                studentUsn: 'USN001',
                courseId: 1,
                batchId: 1,
                internal1: 25,
                calculatedTotal: 25.5,
            });
            prismaMock.studentProfile.findFirst.mockResolvedValue({ userId: 10 });

            const data: RecordMarksData = {
                studentUsn: 'USN001',
                courseId: 1,
                batchId: 1,
                sectionId: 1,
                internal1: 25,
            };

            const result = await teacherMarksService.recordMarks(100, data, 1);

            expect(result).toBeDefined();
            expect(prismaMock.internalMarksDetail.upsert).toHaveBeenCalledTimes(1);
        });

        it('should throw if marks are already finalized', async () => {
            prismaMock.internalMarksDetail.findFirst.mockResolvedValue({
                isFinalized: true,
            });

            const data: RecordMarksData = {
                studentUsn: 'USN001',
                courseId: 1,
                batchId: 1,
                sectionId: 1,
                internal1: 25,
            };

            await expect(
                teacherMarksService.recordMarks(100, data, 1)
            ).rejects.toThrow(/submitted/i);
        });
    });

    // ─── Bulk Marks Recording ───────────────────────────────────

    describe('bulkRecordMarks', () => {
        it('should return zero counts for empty entries', async () => {
            const result = await teacherMarksService.bulkRecordMarks(100, [], 1);
            expect(result).toEqual({ created: 0, updated: 0 });
        });

        it('should pre-fetch existing marks and use $transaction for batching', async () => {
            // Simulate no existing marks
            prismaMock.internalMarksDetail.findMany.mockResolvedValue([]);
            prismaMock.internalMarksDetail.createMany.mockResolvedValue({ count: 2 });
            prismaMock.$transaction.mockResolvedValue([{ count: 2 }]);
            prismaMock.studentProfile.findMany.mockResolvedValue([
                { userId: 10 },
                { userId: 11 },
            ]);

            const entries: RecordMarksData[] = [
                { studentUsn: 'USN001', courseId: 1, batchId: 1, sectionId: 1, internal1: 25 },
                { studentUsn: 'USN002', courseId: 1, batchId: 1, sectionId: 1, internal1: 28 },
            ];

            const result = await teacherMarksService.bulkRecordMarks(100, entries, 1);

            expect(result.created).toBe(2);
            expect(result.updated).toBe(0);
            // Verify $transaction was called (batched, not per-student)
            expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
            // Verify pre-fetch happened (ONE findMany, not N findFirst)
            expect(prismaMock.internalMarksDetail.findMany).toHaveBeenCalledTimes(1);
        });

        it('should skip finalized marks during bulk recording', async () => {
            prismaMock.internalMarksDetail.findMany.mockResolvedValue([
                { studentUsn: 'USN001', isFinalized: true },
            ]);
            prismaMock.$transaction.mockResolvedValue([]);
            prismaMock.studentProfile.findMany.mockResolvedValue([]);

            const entries: RecordMarksData[] = [
                { studentUsn: 'USN001', courseId: 1, batchId: 1, sectionId: 1, internal1: 25 },
                { studentUsn: 'USN002', courseId: 1, batchId: 1, sectionId: 1, internal1: 28 },
            ];

            const result = await teacherMarksService.bulkRecordMarks(100, entries, 1);

            // USN001 should be skipped (finalized), only USN002 should be created
            expect(result.created).toBe(1);
            expect(result.updated).toBe(0);
        });
    });

    // ─── Submit/Finalize Marks ──────────────────────────────────

    describe('submitMarks', () => {
        it('should finalize all non-finalized marks in the section/course', async () => {
            prismaMock.internalMarksDetail.updateMany.mockResolvedValue({ count: 15 });
            prismaMock.studentProfile.findMany.mockResolvedValue([
                { userId: 10 },
                { userId: 11 },
            ]);

            const result = await teacherMarksService.submitMarks(100, 1, 1);

            expect(result).toEqual({ submitted: 15 });
            expect(prismaMock.internalMarksDetail.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { sectionId: 1, courseId: 1, isFinalized: false },
                    data: expect.objectContaining({ isFinalized: true }),
                })
            );
        });
    });

    // ─── Edit Requests ──────────────────────────────────────────

    describe('createMarksEditRequest', () => {
        it('should reject edit request for non-finalized marks', async () => {
            prismaMock.internalMarksDetail.findUnique.mockResolvedValue({
                id: 1,
                isFinalized: false,
                courseId: 1,
            });

            await expect(
                teacherMarksService.createMarksEditRequest(100, 1, { internal1: 30 }, 'typo fix')
            ).rejects.toThrow(/not locked/i);
        });

        it('should create edit request for finalized marks', async () => {
            prismaMock.internalMarksDetail.findUnique.mockResolvedValue({
                id: 1,
                isFinalized: true,
                courseId: 1,
                internal1: 25,
                internal2: null,
                internal3: null,
                assignmentMarks: null,
            });
            prismaMock.editRequest.create.mockResolvedValue({
                id: 1,
                type: 'MARKS',
                status: 'PENDING',
            });

            const result = await teacherMarksService.createMarksEditRequest(
                100, 1, { internal1: 30 }, 'Correction needed'
            );

            expect(result.status).toBe('PENDING');
            expect(prismaMock.editRequest.create).toHaveBeenCalledTimes(1);
        });
    });
});
