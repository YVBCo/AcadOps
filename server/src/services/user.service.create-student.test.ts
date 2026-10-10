import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../__tests__/mocks/prisma.mock.js';

const mockBatchRepository = { findByName: vi.fn(), create: vi.fn() };

vi.mock('../data-access/prisma.js', () => ({ prisma: prismaMock, default: prismaMock }));
vi.mock('../data-access/index.js', () => ({
    userRepository: {},
    auditLogRepository: {},
    departmentRepository: {},
    batchRepository: mockBatchRepository,
}));
vi.mock('./auth.service.js', () => ({
    authService: { hashPassword: vi.fn().mockResolvedValue('hashed-password') },
}));
vi.mock('./email.service.js', () => ({ emailService: {} }));
vi.mock('./cache.service.js', () => ({ default: {} }));

const { userService } = await import('./user.service.js');

describe('UserService.createStudentWithProfile', () => {
    beforeEach(() => {
        resetPrismaMock();
        vi.clearAllMocks();
        mockBatchRepository.findByName.mockResolvedValue({ id: 50 });
        prismaMock.studentProfile.findFirst.mockResolvedValue(null);
        prismaMock.user.findFirst.mockResolvedValue(null);
        prismaMock.user.create.mockResolvedValue({ id: 70 });
    });

    it('sets the cycle department for first- and second-semester students', async () => {
        await userService.createStudentWithProfile({
            email: 'student@example.test',
            password: 'test-password',
            name: 'Test Student',
            rollNumber: 'CHEM26ND001',
            admissionYear: 2026,
            departmentId: 12,
            currentSemester: 1,
            tenantId: 4,
        });

        expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                departmentId: 12,
                studentProfile: {
                    create: expect.objectContaining({
                        cycleDepartmentId: 12,
                        optedDepartmentId: 12,
                        currentSemester: 1,
                    }),
                },
            }),
        }));
    });

    it('does not assign a cycle department after semester two', async () => {
        await userService.createStudentWithProfile({
            email: 'student3@example.test',
            password: 'test-password',
            name: 'Test Student 3',
            rollNumber: 'CHEM24ND001',
            admissionYear: 2024,
            departmentId: 12,
            currentSemester: 3,
            tenantId: 4,
        });

        expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                studentProfile: {
                    create: expect.objectContaining({
                        optedDepartmentId: 12,
                        currentSemester: 3,
                    }),
                },
            }),
        }));
        const createArgs = prismaMock.user.create.mock.calls[0][0] as { data: { studentProfile: { create: Record<string, unknown> } } };
        expect(createArgs.data.studentProfile.create.cycleDepartmentId).toBeUndefined();
    });
});
