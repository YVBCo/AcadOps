/**
 * Teacher Attendance Service — Unit Tests
 * ──────────────────────────────────────
 * Tests attendance marking (batched transaction), lock/submit,
 * history retrieval, and edit request workflows.
 *
 * Verifies that:
 * - N+1 queries are eliminated (pre-fetch profiles + $transaction)
 * - Locked attendance cannot be overwritten
 * - Attendance history groups correctly by date
 * - Edit requests enforce lock state
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

vi.mock('../../api/middleware/error.middleware.js', () => ({
    ApiError: class ApiError extends Error {
        statusCode: number;
        constructor(statusCode: number, message: string) {
            super(message);
            this.statusCode = statusCode;
            this.name = 'ApiError';
        }
    },
}));

vi.mock('../../utils/logger.js', () => ({
    logger: {
        child: () => ({
            info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(),
        }),
    },
}));

vi.mock('./shared.js', () => ({
    getTeacherProfile: vi.fn().mockResolvedValue({ id: 1, userId: 100 }),
    verifyAllocationAccess: vi.fn().mockResolvedValue({
        teacher: { id: 1 },
        allocation: { sectionId: 1, section: { name: 'A', batchId: 1, departmentId: 1, department: { tenantId: 1 } } },
    }),
    verifySectionCourseAccess: vi.fn().mockResolvedValue({
        teacher: { id: 1, userId: 100 },
        allocation: {
            sectionId: 1,
            section: { name: 'A', batchId: 1, departmentId: 1, department: { tenantId: 1 } },
        },
    }),
    getOrCreateActiveSemester: vi.fn().mockResolvedValue({ id: 1, name: 'Semester 1', status: 'ACTIVE' }),
}));

import type { MarkAttendanceEntry } from './teacher-attendance.service.js';

describe('TeacherAttendanceService', () => {
    let teacherAttendanceService: typeof import('./teacher-attendance.service.js')['teacherAttendanceService'];
    let prismaMock: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import('./teacher-attendance.service.js');
        teacherAttendanceService = mod.teacherAttendanceService;
        const prismaModule = await import('../../__tests__/mocks/prisma.mock.js');
        prismaMock = prismaModule.prismaMock;
    });

    // ─── Mark Attendance ────────────────────────────────────────

    describe('markAttendance', () => {
        const setupMarkAttendanceMocks = () => {
            // Subject lookup/creation
            prismaMock.subject.findFirst.mockResolvedValue({ id: 10, courseId: 1 });
            // No locked attendance
            prismaMock.attendance.findFirst.mockResolvedValue(null);
            // Pre-fetch student profiles (single batch query)
            prismaMock.studentProfile.findMany.mockResolvedValue([
                { id: 1, rollNumber: 'USN001' },
                { id: 2, rollNumber: 'USN002' },
            ]);
            // Pre-fetch existing attendance (single batch query)
            prismaMock.attendance.findMany.mockResolvedValue([]);
            // Transaction mock — simulate the interactive transaction callback
            prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
                const tx = {
                    attendance: {
                        upsert: vi.fn().mockResolvedValue({ id: 1 }),
                        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
                    },
                };
                return fn(tx);
            });
        };

        it('should return zero counts for empty entries', async () => {
            // Subject + no locked records mocks
            prismaMock.subject.findFirst.mockResolvedValue({ id: 10 });
            prismaMock.attendance.findFirst.mockResolvedValue(null);

            const result = await teacherAttendanceService.markAttendance(
                100, 1, 1, new Date('2026-05-08'), [], 1
            );

            expect(result).toEqual({ created: 0, updated: 0, message: 'No entries to process' });
        });

        it('should pre-fetch student profiles in ONE query (N+1 elimination)', async () => {
            setupMarkAttendanceMocks();

            const entries: MarkAttendanceEntry[] = [
                { studentUsn: 'USN001', status: 'PRESENT' },
                { studentUsn: 'USN002', status: 'ABSENT', remarks: 'Sick' },
            ];

            const result = await teacherAttendanceService.markAttendance(
                100, 1, 1, new Date('2026-05-08'), entries, 1
            );

            // Should be exactly 1 studentProfile.findMany call (not N findFirst)
            expect(prismaMock.studentProfile.findMany).toHaveBeenCalledTimes(1);
            expect(prismaMock.studentProfile.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { rollNumber: { in: ['USN001', 'USN002'] } },
                })
            );

            // Should use $transaction for batching
            expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);

            expect(result.created).toBe(2);
            expect(result.updated).toBe(0);
        });

        it('should throw if attendance is already locked for the date', async () => {
            prismaMock.subject.findFirst.mockResolvedValue({ id: 10 });
            prismaMock.attendance.findFirst.mockResolvedValue({
                id: 1,
                isLocked: true,
            });

            const entries: MarkAttendanceEntry[] = [
                { studentUsn: 'USN001', status: 'PRESENT' },
            ];

            await expect(
                teacherAttendanceService.markAttendance(100, 1, 1, new Date('2026-05-08'), entries, 1)
            ).rejects.toThrow(/already submitted/i);
        });

        it('should throw when no active semester exists', async () => {
            const { getOrCreateActiveSemester } = await import('./shared.js');
            vi.mocked(getOrCreateActiveSemester).mockResolvedValueOnce(null as any);
            prismaMock.semester.findFirst.mockResolvedValue(null);

            const entries: MarkAttendanceEntry[] = [
                { studentUsn: 'USN001', status: 'PRESENT' },
            ];

            await expect(
                teacherAttendanceService.markAttendance(100, 1, 1, new Date('2026-05-08'), entries)
            ).rejects.toThrow(/active semester/i);
        });
    });

    // ─── Submit Attendance ──────────────────────────────────────

    describe('submitAttendance', () => {
        it('should lock all unlocked attendance for the date', async () => {
            prismaMock.subject.findFirst.mockResolvedValue({ id: 10 });
            prismaMock.attendance.updateMany.mockResolvedValue({ count: 30 });

            const result = await teacherAttendanceService.submitAttendance(
                100, 1, 1, new Date('2026-05-08'), 1
            );

            expect(result).toEqual({ submitted: 30 });
            expect(prismaMock.attendance.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ isLocked: false }),
                    data: { isLocked: true },
                })
            );
        });

        it('should throw if no subject found (no attendance marked yet)', async () => {
            prismaMock.subject.findFirst.mockResolvedValue(null);

            await expect(
                teacherAttendanceService.submitAttendance(100, 1, 1, new Date('2026-05-08'), 1)
            ).rejects.toThrow(/no attendance records/i);
        });
    });

    // ─── Attendance History ─────────────────────────────────────

    describe('getAttendanceHistory', () => {
        it('should group attendance records by date', async () => {
            const mockRecords = [
                { date: new Date('2026-05-08'), status: 'PRESENT', student: { rollNumber: 'USN001', user: { name: 'Student 1' } }, subject: { course: { name: 'DS', code: 'CS301' } } },
                { date: new Date('2026-05-08'), status: 'ABSENT', student: { rollNumber: 'USN002', user: { name: 'Student 2' } }, subject: { course: { name: 'DS', code: 'CS301' } } },
                { date: new Date('2026-05-07'), status: 'PRESENT', student: { rollNumber: 'USN001', user: { name: 'Student 1' } }, subject: { course: { name: 'DS', code: 'CS301' } } },
            ];

            prismaMock.attendance.findMany.mockResolvedValue(mockRecords);

            const result = await teacherAttendanceService.getAttendanceHistory(1, 1);

            expect(result.dates).toHaveLength(2);
            // Dates should be sorted descending
            expect(result.dates[0]).toBe('2026-05-08');
            expect(result.dates[1]).toBe('2026-05-07');
            // Two records on 2026-05-08
            expect(result.attendance['2026-05-08']).toHaveLength(2);
            // One record on 2026-05-07
            expect(result.attendance['2026-05-07']).toHaveLength(1);
        });
    });

    // ─── Edit Requests ──────────────────────────────────────────

    describe('createAttendanceEditRequest', () => {
        it('should reject edit request for unlocked attendance', async () => {
            prismaMock.attendance.findUnique.mockResolvedValue({
                id: 1,
                isLocked: false,
                status: 'PRESENT',
            });

            await expect(
                teacherAttendanceService.createAttendanceEditRequest(100, 1, 'ABSENT', 'wrong status')
            ).rejects.toThrow(/not locked/i);
        });

        it('should create edit request for locked attendance', async () => {
            prismaMock.attendance.findUnique.mockResolvedValue({
                id: 1,
                isLocked: true,
                status: 'PRESENT',
                subjectId: 10,
            });
            prismaMock.editRequest.create.mockResolvedValue({
                id: 1,
                type: 'ATTENDANCE',
                status: 'PENDING',
            });

            const result = await teacherAttendanceService.createAttendanceEditRequest(
                100, 1, 'ABSENT', 'Student was actually absent'
            );

            expect(result.status).toBe('PENDING');
            expect(prismaMock.editRequest.create).toHaveBeenCalledTimes(1);
        });
    });
});
