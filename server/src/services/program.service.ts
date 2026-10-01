import { Prisma } from '@prisma/client';
import { programRepository, CreateProgramData, UpdateProgramData } from '../data-access/program.repository.js';
import { auditLogRepository } from '../data-access/audit-log.repository.js';

export const programService = {
    async getAll(departmentId?: number, tenantId?: number) {
        if (departmentId) {
            return programRepository.findByDepartment(departmentId);
        }
        return programRepository.findAll(tenantId);
    },

    async getById(id: number) {
        const program = await programRepository.findById(id);
        if (!program) {
            throw new Error('Program not found');
        }
        return program;
    },

    async create(data: CreateProgramData, actorId: number) {
        // Check for duplicate code
        const existing = await programRepository.findByCode(data.code);
        if (existing) {
            throw new Error('Program code already exists');
        }

        const program = await programRepository.create(data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'PROGRAM_CREATED',
            entityType: 'Program',
            entityId: program.id,
            newValue: {
                name: program.name,
                code: program.code,
                departmentIds: data.departmentIds
            } as unknown as Prisma.JsonValue,
        });

        return program;
    },

    async update(id: number, data: UpdateProgramData, actorId: number) {
        const existing = await programRepository.findById(id);
        if (!existing) {
            throw new Error('Program not found');
        }

        // Check for duplicate code if changing
        if (data.code && data.code !== existing.code) {
            const duplicate = await programRepository.findByCode(data.code);
            if (duplicate) {
                throw new Error('Program code already exists');
            }
        }

        const program = await programRepository.update(id, data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'PROGRAM_UPDATED',
            entityType: 'Program',
            entityId: id,
            oldValue: {
                name: existing.name,
                code: existing.code
            } as unknown as Prisma.JsonValue,
            newValue: {
                name: program.name,
                code: program.code
            } as unknown as Prisma.JsonValue,
        });

        return program;
    },

    async delete(id: number, actorId: number) {
        const existing = await programRepository.findById(id);
        if (!existing) {
            throw new Error('Program not found');
        }

        await programRepository.delete(id);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'PROGRAM_DELETED',
            entityType: 'Program',
            entityId: id,
            oldValue: {
                name: existing.name,
                code: existing.code
            } as unknown as Prisma.JsonValue,
        });
    },
};
