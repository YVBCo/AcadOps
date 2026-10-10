import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../__tests__/mocks/prisma.mock.js';
import { createMockCourse } from '../__tests__/factories.js';

vi.mock('../data-access/prisma.js', () => ({ prisma: prismaMock, default: prismaMock }));

const mockCourseAllocationRepository = { upsert: vi.fn() };
const mockCourseRepository = { findById: vi.fn() };
const mockSectionRepository = { findById: vi.fn(), findByDepartmentAndBatch: vi.fn() };
const mockAuditLogRepository = { create: vi.fn() };

vi.mock('../data-access/index.js', () => ({
    auditLogRepository: mockAuditLogRepository,
    sectionRepository: mockSectionRepository,
    courseRepository: mockCourseRepository,
}));
vi.mock('../data-access/course-allocation.repository.js', () => ({
    courseAllocationRepository: mockCourseAllocationRepository,
}));

const { deptAdminService } = await import('./dept-admin.service.js');

describe('Department Admin course allocation', () => {
    beforeEach(() => {
        resetPrismaMock();
        vi.clearAllMocks();
    });

    it('creates the semester subject and synchronizes enrolled students for No-Due', async () => {
        mockCourseRepository.findById.mockResolvedValue(createMockCourse({
            id: 21, tenantId: 8, isLocked: true,
        }));
        mockSectionRepository.findById.mockResolvedValue({ id: 12, name: 'A' });
        mockCourseAllocationRepository.upsert.mockResolvedValue({ id: 31 });
        prismaMock.semester.findFirst.mockResolvedValue({ id: 5 });
        prismaMock.studentProfile.findMany.mockResolvedValue([{ id: 41 }, { id: 42 }]);
        prismaMock.subject.upsert.mockResolvedValue({ id: 51 });
        prismaMock.enrollment.createMany.mockResolvedValue({ count: 2 });
        prismaMock.studentProfile.findMany.mockResolvedValueOnce([{ id: 41 }, { id: 42 }])
            .mockResolvedValueOnce([{ userId: 141 }, { userId: 142 }]);

        await deptAdminService.allocateCourseToSection(21, 12, 1, null, 99);

        expect(prismaMock.semester.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { tenantId: 8, status: 'ACTIVE' },
        }));
        expect(prismaMock.subject.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { courseId_semesterId_section: { courseId: 21, semesterId: 5, section: 'A' } },
        }));
        expect(prismaMock.enrollment.createMany).toHaveBeenCalledWith({
            data: [{ subjectId: 51, studentId: 41 }, { subjectId: 51, studentId: 42 }],
            skipDuplicates: true,
        });
        expect(prismaMock.nodueSubjectEnrollment.createMany).toHaveBeenCalledWith({
            data: [
                { tenantId: 8, studentId: 141, subjectId: 51, teacherId: null },
                { tenantId: 8, studentId: 142, subjectId: 51, teacherId: null },
            ],
            skipDuplicates: true,
        });
    });

    it('materializes No-Due enrollments for every section in a batch allocation', async () => {
        mockCourseRepository.findById.mockResolvedValue(createMockCourse({
            id: 21, tenantId: 8, isLocked: true,
        }));
        mockSectionRepository.findByDepartmentAndBatch.mockResolvedValue([
            { id: 12, name: 'A' }, { id: 13, name: 'B' },
        ]);
        mockCourseAllocationRepository.upsert.mockResolvedValue({ id: 31 });
        prismaMock.semester.findFirst.mockResolvedValue({ id: 5 });
        prismaMock.studentProfile.findMany.mockResolvedValue([{ id: 41 }]);
        prismaMock.subject.upsert.mockResolvedValue({ id: 51 });
        prismaMock.enrollment.createMany.mockResolvedValue({ count: 1 });

        await deptAdminService.allocateCourseToAllSections(21, 4, 1, 3, 99);

        expect(mockCourseAllocationRepository.upsert).toHaveBeenCalledTimes(2);
        expect(prismaMock.subject.upsert).toHaveBeenCalledTimes(2);
        expect(prismaMock.enrollment.createMany).toHaveBeenCalledTimes(2);
        expect(prismaMock.nodueSubjectEnrollment.createMany).toHaveBeenCalledTimes(2);
    });
});
