import { describe, expect, it, vi } from 'vitest';
import { syncNoDueSubjectEnrollments } from './nodue-enrollment.sync.js';

describe('syncNoDueSubjectEnrollments', () => {
    it('creates tenant-scoped faculty review rows for enrolled students', async () => {
        const db = {
            studentProfile: { findMany: vi.fn().mockResolvedValue([{ userId: 701 }, { userId: 702 }]) },
            nodueSubjectEnrollment: {
                createMany: vi.fn().mockResolvedValue({ count: 2 }),
                updateMany: vi.fn().mockResolvedValue({ count: 2 }),
            },
        } as any;

        await expect(syncNoDueSubjectEnrollments(db, {
            tenantId: 14,
            subjectId: 52,
            studentProfileIds: [31, 31, 32],
            teacherUserId: 88,
        })).resolves.toBe(2);

        expect(db.studentProfile.findMany).toHaveBeenCalledWith({
            where: { id: { in: [31, 32] }, user: { tenantId: 14 } },
            select: { userId: true },
        });
        expect(db.nodueSubjectEnrollment.createMany).toHaveBeenCalledWith({
            data: [
                { tenantId: 14, studentId: 701, subjectId: 52, teacherId: 88 },
                { tenantId: 14, studentId: 702, subjectId: 52, teacherId: 88 },
            ],
            skipDuplicates: true,
        });
        expect(db.nodueSubjectEnrollment.updateMany).toHaveBeenCalledWith({
            where: {
                tenantId: 14, subjectId: 52, studentId: { in: [701, 702] },
                status: 'PENDING', isFacultyCleared: false,
            },
            data: { teacherId: 88 },
        });
    });

    it('does not create records for profiles outside the tenant', async () => {
        const db = {
            studentProfile: { findMany: vi.fn().mockResolvedValue([]) },
            nodueSubjectEnrollment: { createMany: vi.fn(), updateMany: vi.fn() },
        } as any;

        await expect(syncNoDueSubjectEnrollments(db, {
            tenantId: 14, subjectId: 52, studentProfileIds: [31],
        })).resolves.toBe(0);
        expect(db.nodueSubjectEnrollment.createMany).not.toHaveBeenCalled();
    });
});
