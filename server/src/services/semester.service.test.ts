import { beforeEach, describe, expect, it, vi } from 'vitest';

const { semesterRepository, auditLogRepository } = vi.hoisted(() => ({
    semesterRepository: {
        findActive: vi.fn(),
        create: vi.fn(),
    },
    auditLogRepository: {
        create: vi.fn(),
    },
}));

vi.mock('../data-access/index.js', () => ({ semesterRepository, auditLogRepository }));
vi.mock('./batch.service.js', () => ({ batchService: {} }));

import { semesterService } from './semester.service.js';

describe('SemesterService.create', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('prevents a second active academic semester in the same tenant', async () => {
        semesterRepository.findActive.mockResolvedValue({ id: 7, name: 'Odd Semester 2026-27' });

        await expect(semesterService.create({
            name: 'Even Semester 2026-27',
            startDate: new Date('2027-01-01'),
            endDate: new Date('2027-05-31'),
            tenantId: 3,
        }, 12)).rejects.toThrow('Close the active semester "Odd Semester 2026-27" before creating a new one');

        expect(semesterRepository.create).not.toHaveBeenCalled();
        expect(auditLogRepository.create).not.toHaveBeenCalled();
    });
});
