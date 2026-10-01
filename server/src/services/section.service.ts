import { Section, Prisma } from '@prisma/client';
import { sectionRepository } from '../data-access/section.repository.js';
import { auditLogRepository } from '../data-access/index.js';
import { deptAdminService } from './dept-admin.service.js';

interface CreateSectionInput {
    name: string;
    departmentId: number;
    batchId: number;
    tenantId: number;
}

class SectionService {
    // Create a new section
    async create(data: CreateSectionInput, actorId: number): Promise<Section> {
        const section = await sectionRepository.create(data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'CREATE_SECTION',
            entityType: 'Section',
            entityId: section.id,
            newValue: { name: section.name, departmentId: section.departmentId, batchId: section.batchId } as Prisma.JsonValue,
        });

        return section;
    }

    // Get section by ID
    async getById(id: number): Promise<Section | null> {
        return sectionRepository.findById(id);
    }

    // Get sections by department and batch
    async getByDepartmentAndBatch(departmentId: number, batchId: number): Promise<Section[]> {
        return sectionRepository.findByDepartmentAndBatch(departmentId, batchId);
    }

    // Get sections by department
    async getByDepartment(departmentId: number): Promise<Section[]> {
        return sectionRepository.findByDepartment(departmentId);
    }

    // Get all sections
    async getAll(tenantId?: number): Promise<Section[]> {
        return sectionRepository.findAll(tenantId);
    }

    // Delete section
    async delete(id: number, actorId: number): Promise<void> {
        const existing = await sectionRepository.findById(id);
        if (!existing) {
            throw new Error('Section not found');
        }

        if (existing.isLocked) {
            throw new Error('Cannot delete a locked section');
        }

        await sectionRepository.delete(id);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'DELETE_SECTION',
            entityType: 'Section',
            entityId: id,
            oldValue: { name: existing.name, departmentId: existing.departmentId, batchId: existing.batchId } as Prisma.JsonValue,
        });
    }

    // Lock/unlock section
    async toggleLock(id: number, actorId: number): Promise<Section> {
        const existing = await sectionRepository.findById(id);
        if (!existing) {
            throw new Error('Section not found');
        }

        const updated = await sectionRepository.update(id, { isLocked: !existing.isLocked });

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: existing.isLocked ? 'UNLOCK_SECTION' : 'LOCK_SECTION',
            entityType: 'Section',
            entityId: id,
            newValue: { isLocked: updated.isLocked } as Prisma.JsonValue,
        });

        return updated;
    }

    // Assign students to section (delegates to deptAdminService for auto-enrollment)
    async assignStudents(
        sectionId: number,
        studentProfileIds: number[],
        actorId: number
    ): Promise<{ assigned: number; skipped: number }> {
        const section = await sectionRepository.findById(sectionId);
        if (!section) {
            throw new Error('Section not found');
        }

        if (section.isLocked) {
            throw new Error('Cannot modify a locked section');
        }

        // Delegate to deptAdminService which wraps assignment + auto-enrollment
        // in a single transaction
        const result = await deptAdminService.assignStudentsToSection(
            sectionId,
            studentProfileIds,
            actorId
        );

        return {
            assigned: result.updated,
            skipped: 0,
        };
    }

    // Remove students from section
    async removeStudentsFromSection(
        studentProfileIds: number[],
        actorId: number
    ): Promise<{ updated: number }> {
        const updated = await sectionRepository.removeStudentsFromSection(studentProfileIds);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'REMOVE_STUDENTS_FROM_SECTION',
            entityType: 'Section',
            entityId: undefined,
            newValue: { studentProfileIds } as Prisma.JsonValue,
        });

        return { updated };
    }

    // Get students in section
    async getStudents(sectionId: number) {
        return sectionRepository.getStudents(sectionId);
    }
}

export const sectionService = new SectionService();
