import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prismaMock, resetPrismaMock } from '../__tests__/mocks/prisma.mock.js';

vi.mock('./prisma.js', () => ({ prisma: prismaMock }));

const { userRepository } = await import('./user.repository.js');

describe('userRepository department filtering for student profiles', () => {
    beforeEach(() => resetPrismaMock());

    it('uses a student user department only when profile department links are missing', async () => {
        prismaMock.user.findMany.mockResolvedValue([]);
        prismaMock.user.count.mockResolvedValue(0);

        await userRepository.findStudentsWithProfiles({
            departmentId: 8,
            batchId: 22,
            tenantId: 14,
        });

        expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                role: 'STUDENT',
                tenantId: 14,
                studentProfile: {
                    OR: [
                        { optedDepartmentId: 8 },
                        { cycleDepartmentId: 8, currentSemester: { lte: 2 } },
                        {
                            optedDepartmentId: null,
                            OR: [
                                { cycleDepartmentId: null },
                                { currentSemester: { gt: 2 } },
                            ],
                            user: { departmentId: 8 },
                        },
                    ],
                    batchId: 22,
                },
            }),
        }));
    });

    it('groups department counts by profile department with user department fallback under tenant scope', async () => {
        prismaMock.$queryRaw.mockResolvedValue([{ department_id: 8, count: 2n }]);

        await expect(userRepository.getStudentCountsByBatch(22, 14)).resolves.toEqual([
            { departmentId: 8, count: 2 },
        ]);

        const [query, batchId, tenantId] = prismaMock.$queryRaw.mock.calls[0];
        expect(query.join('')).toContain('CASE WHEN sp.current_semester <= 2 THEN sp.cycle_department_id END');
        expect(query.join('')).toContain("u.role = 'STUDENT'");
        expect(query.join('')).toContain("LEFT(LOWER(u.email), 8) <> 'deleted_'");
        expect([batchId, tenantId]).toEqual([22, 14]);
    });
});
