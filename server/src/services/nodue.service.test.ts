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
            .mockResolvedValueOnce(5)
            .mockResolvedValueOnce(2)
            .mockResolvedValueOnce(1);

        await expect(nodueService.getClearanceStats(14)).resolves.toEqual({ total: 8, cleared: 3, pending: 5, pendingHod: 2, pendingPrincipal: 1 });
        expect(prismaMock.nodueClearanceRequest.count).toHaveBeenNthCalledWith(1, { where: { tenantId: 14 } });
        expect(prismaMock.nodueClearanceRequest.count).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { tenantId: 14, currentStage: expect.any(String) } }));
        expect(prismaMock.nodueClearanceRequest.count).toHaveBeenNthCalledWith(3, {
            where: { tenantId: 14, status: 'PENDING', currentStage: { notIn: ['CLEARED', 'REJECTED'] } },
        });
        expect(prismaMock.nodueClearanceRequest.count).toHaveBeenNthCalledWith(4, expect.objectContaining({ where: { tenantId: 14, currentStage: expect.any(String) } }));
        expect(prismaMock.nodueClearanceRequest.count).toHaveBeenNthCalledWith(5, expect.objectContaining({ where: { tenantId: 14, currentStage: expect.any(String) } }));
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

    it('does not create a clearance application when the student has no enrolled subjects', async () => {
        prismaMock.nodueSubjectEnrollment.findMany.mockResolvedValue([]);

        await expect(nodueService.applyClearance(14, 33)).rejects.toThrow(
            'You must be enrolled in at least one subject before applying for clearance',
        );
        expect(prismaMock.nodueClearanceRequest.findFirst).not.toHaveBeenCalled();
        expect(prismaMock.nodueClearanceRequest.create).not.toHaveBeenCalled();
    });

    it('does not advance an empty faculty clearance through the approval chain', async () => {
        prismaMock.nodueClearanceRequest.findFirst.mockResolvedValue({ id: 3, currentStage: 'FACULTY_REVIEW' });
        prismaMock.nodueSubjectEnrollment.findMany.mockResolvedValue([]);

        await nodueService.evaluateClearanceStage(14, 33);

        expect(prismaMock.nodueLibraryDue.findMany).not.toHaveBeenCalled();
        expect(prismaMock.nodueStudentDue.findMany).not.toHaveBeenCalled();
        expect(prismaMock.nodueClearanceRequest.update).not.toHaveBeenCalled();
    });

    it('rejects an empty HOD clearance while preserving an audit entry', async () => {
        prismaMock.nodueClearanceRequest.findFirst.mockResolvedValue({ id: 3, studentId: 33, currentStage: 'HOD_REVIEW' });
        prismaMock.nodueSubjectEnrollment.findMany.mockResolvedValue([]);
        prismaMock.nodueClearanceRequest.update.mockResolvedValue({ id: 3, currentStage: 'REJECTED' });
        prismaMock.nodueActivityLog.create.mockResolvedValue({ id: 7 });

        await nodueService.rejectEmptyClearance(14, 3, 91, 'SUPER_ADMIN');

        expect(prismaMock.nodueClearanceRequest.update).toHaveBeenCalledWith({
            where: { id: 3 },
            data: {
                currentStage: 'REJECTED',
                remarks: 'Rejected because the student has no enrolled subjects for clearance.',
            },
        });
        expect(prismaMock.nodueActivityLog.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ tenantId: 14, userId: 91, targetId: 3 }),
        }));
    });

    it('does not reject a HOD clearance that has enrolled subjects', async () => {
        prismaMock.nodueClearanceRequest.findFirst.mockResolvedValue({ id: 3, studentId: 33, currentStage: 'HOD_REVIEW' });
        prismaMock.nodueSubjectEnrollment.findMany.mockResolvedValue([{ id: 44 }]);

        await expect(nodueService.rejectEmptyClearance(14, 3, 91, 'SUPER_ADMIN')).rejects.toThrow(
            'This request has enrolled subjects and cannot use the empty-request rejection action',
        );
        expect(prismaMock.nodueClearanceRequest.update).not.toHaveBeenCalled();
    });

    it('never approves an empty HOD clearance request', async () => {
        prismaMock.nodueClearanceRequest.findFirst.mockResolvedValue({ id: 3, studentId: 33, currentStage: 'HOD_REVIEW' });
        prismaMock.nodueSubjectEnrollment.findMany.mockResolvedValue([]);

        await expect(nodueService.hodApprove(14, 33, 91)).rejects.toThrow(
            'Cannot approve a clearance request without enrolled subjects. Reject it as an invalid empty request.',
        );
        expect(prismaMock.nodueClearanceRequest.update).not.toHaveBeenCalled();
    });
});

describe('NoDueService faculty review access', () => {
    beforeEach(() => resetPrismaMock());

    it('allows tenant administrators to list faculty clearances without a teacher filter', async () => {
        prismaMock.nodueSubjectEnrollment.findMany.mockResolvedValue([]);

        await nodueService.getEnrollmentsForFaculty(14);

        expect(prismaMock.nodueSubjectEnrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { tenantId: 14 },
        }));
    });

    it('keeps teacher review limited to their own assignments', async () => {
        prismaMock.nodueSubjectEnrollment.findMany.mockResolvedValue([]);

        await nodueService.getEnrollmentsForFaculty(14, 72);

        expect(prismaMock.nodueSubjectEnrollment.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { tenantId: 14, teacherId: 72 },
        }));
    });

    it('lets tenant administrators review an enrollment while preserving tenant scoping', async () => {
        prismaMock.nodueSubjectEnrollment.findFirst.mockResolvedValue({ id: 9, studentId: 33, status: 'PENDING' });
        prismaMock.nodueSubjectEnrollment.update.mockResolvedValue({ id: 9, studentId: 33, status: 'COMPLETED' });
        prismaMock.nodueClearanceRequest.findFirst.mockResolvedValue({ id: 10, studentId: 33, currentStage: 'FACULTY_REVIEW' });
        prismaMock.nodueSubjectEnrollment.findMany.mockResolvedValue([]);
        prismaMock.nodueLibraryDue.findMany.mockResolvedValue([]);
        prismaMock.nodueStudentDue.findMany.mockResolvedValue([]);

        await nodueService.clearSubject(14, 9, undefined, { status: 'COMPLETED' });

        expect(prismaMock.nodueSubjectEnrollment.findFirst).toHaveBeenCalledWith({
            where: { id: 9, tenantId: 14 },
        });
        expect(prismaMock.nodueSubjectEnrollment.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 9 } }));
    });
});
