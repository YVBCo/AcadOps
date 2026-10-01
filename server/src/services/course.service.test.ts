/**
 * Course Service — Unit Tests
 * ──────────────────────────────────────
 * Tests: CRUD operations, max-semesters config,
 * duplicate code detection, and course locking.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock, resetPrismaMock } from '../__tests__/mocks/prisma.mock.js';
import { createMockCourse, createMockTenant } from '../__tests__/factories.js';

// ── Mock dependencies ────────────────────────────────────────
vi.mock('../data-access/prisma.js', () => ({
    prisma: prismaMock,
    default: prismaMock,
}));

const mockCourseRepository = {
    findByCode: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    findByDepartment: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    lock: vi.fn(),
};

const mockSectionRepository = {
    findAll: vi.fn(),
};

vi.mock('../data-access/index.js', () => ({
    courseRepository: mockCourseRepository,
    sectionRepository: mockSectionRepository,
    auditLogRepository: { create: vi.fn() },
}));

const { courseService } = await import('./course.service.js');

describe('CourseService', () => {
    beforeEach(() => {
        resetPrismaMock();
        vi.clearAllMocks();
    });

    // ── Max Semesters Config ─────────────────────────────────
    describe('getMaxSemestersConfig', () => {
        it('should return 8 semesters for ENGINEERING tenant', async () => {
            prismaMock.tenant.findUnique.mockResolvedValue(
                createMockTenant({ type: 'ENGINEERING' })
            );

            const config = await courseService.getMaxSemestersConfig(1);

            expect(config.maxSemesters).toBe(8);
            expect(config.tenantType).toBe('ENGINEERING');
        });

        it('should return 6 semesters for DEGREE tenant', async () => {
            prismaMock.tenant.findUnique.mockResolvedValue(
                createMockTenant({ type: 'DEGREE' })
            );

            const config = await courseService.getMaxSemestersConfig(1);

            expect(config.maxSemesters).toBe(6);
            expect(config.tenantType).toBe('DEGREE');
        });

        it('should return 6 semesters for MBA tenant', async () => {
            prismaMock.tenant.findUnique.mockResolvedValue(
                createMockTenant({ type: 'MBA' })
            );

            const config = await courseService.getMaxSemestersConfig(1);

            expect(config.maxSemesters).toBe(6);
        });

        it('should default to 8 semesters for unknown tenant type', async () => {
            prismaMock.tenant.findUnique.mockResolvedValue(null);

            const config = await courseService.getMaxSemestersConfig(999);

            expect(config.maxSemesters).toBe(8);
            expect(config.tenantType).toBeNull();
        });
    });

    // ── Get All Courses ──────────────────────────────────────
    describe('getAll', () => {
        it('should return courses filtered by tenantId', async () => {
            const courses = [
                createMockCourse({ id: 1, name: 'Data Structures' }),
                createMockCourse({ id: 2, name: 'Algorithms' }),
            ];
            mockCourseRepository.findAll.mockResolvedValue(courses);

            const result = await courseService.getAll({ tenantId: 1 });

            expect(result).toHaveLength(2);
            expect(mockCourseRepository.findAll).toHaveBeenCalledOnce();
        });

        it('should filter by departmentId when provided', async () => {
            mockCourseRepository.findAll.mockResolvedValue([]);

            await courseService.getAll({ tenantId: 1, departmentId: 5 });

            expect(mockCourseRepository.findAll).toHaveBeenCalledWith(
                expect.objectContaining({ departmentId: 5 })
            );
        });
    });

    // ── Get By ID ────────────────────────────────────────────
    describe('getById', () => {
        it('should return a course by ID', async () => {
            const course = createMockCourse({ id: 42 });
            mockCourseRepository.findById.mockResolvedValue(course);

            const result = await courseService.getById(42);

            expect(result).toBeDefined();
            expect(result?.id).toBe(42);
        });

        it('should return null for non-existent course', async () => {
            mockCourseRepository.findById.mockResolvedValue(null);

            const result = await courseService.getById(999);

            expect(result).toBeNull();
        });
    });

    // ── Create Course ────────────────────────────────────────
    describe('create', () => {
        it('should create a new course', async () => {
            const newCourse = createMockCourse({ id: 100, code: 'CS500' });
            mockCourseRepository.findByCode.mockResolvedValue(null); // No duplicate
            mockCourseRepository.create.mockResolvedValue(newCourse);
            prismaMock.tenant.findUnique.mockResolvedValue(createMockTenant());

            const result = await courseService.create(
                { name: 'Advanced AI', code: 'CS500', credits: 4, departmentId: 1, tenantId: 1 },
                1 // actorId
            );

            expect(result.code).toBe('CS500');
            expect(mockCourseRepository.create).toHaveBeenCalledOnce();
        });

        it('should reject duplicate course code', async () => {
            const existing = createMockCourse({ code: 'CS301' });
            mockCourseRepository.findByCode.mockResolvedValue(existing);

            await expect(
                courseService.create(
                    { name: 'Duplicate', code: 'CS301', credits: 3, departmentId: 1, tenantId: 1 },
                    1
                )
            ).rejects.toThrow(/already exists|duplicate/i);
        });
    });

    // ── Delete Course ────────────────────────────────────────
    describe('delete', () => {
        it('should delete a course by ID', async () => {
            mockCourseRepository.findById.mockResolvedValue(createMockCourse());
            mockCourseRepository.delete.mockResolvedValue(createMockCourse());

            await courseService.delete(1, 1);

            expect(mockCourseRepository.delete).toHaveBeenCalledWith(1);
        });
    });
});
