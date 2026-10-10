import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../data-access/prisma.js', async () => {
    const { prismaMock } = await import('../../__tests__/mocks/prisma.mock.js');
    return { prisma: prismaMock, default: prismaMock };
});

vi.mock('../../data-access/index.js', () => ({
    auditLogRepository: { create: vi.fn().mockResolvedValue({}) },
}));

vi.mock('../auth.service.js', () => ({
    authService: { hashPassword: vi.fn().mockResolvedValue('unexpected-new-password-hash') },
}));

import { prismaMock } from '../../__tests__/mocks/prisma.mock.js';
import { auditLogRepository } from '../../data-access/index.js';
import { admissionUsnService } from './admission-usn.service.js';

describe('permanent USN assignment', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('updates the login identifier without silently changing the student password', async () => {
        const profile = {
            id: 41,
            userId: 91,
            temporaryUsn: 'QACS001',
            rollNumber: 'QACS001',
            isPermanentUsnLocked: false,
            user: { tenantId: 12 },
        };
        prismaMock.studentProfile.findUnique.mockResolvedValue(profile);
        prismaMock.studentProfile.findFirst.mockResolvedValue(null);
        prismaMock.studentProfile.update.mockResolvedValue({ ...profile, rollNumber: 'QA26CS001' });

        await admissionUsnService.assignPermanentUsn(41, 'QA26CS001', 7, 12);

        expect(prismaMock.studentProfile.update).toHaveBeenCalledWith({
            where: { id: 41 },
            data: {
                permanentUsn: 'QA26CS001',
                isPermanentUsnLocked: true,
                rollNumber: 'QA26CS001',
            },
        });
        expect(prismaMock.user.update).not.toHaveBeenCalled();
        expect(auditLogRepository.create).toHaveBeenCalledOnce();
    });
});
