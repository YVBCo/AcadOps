import { Batch, Prisma } from '@prisma/client';
import { prisma } from '../data-access/prisma.js';
import { batchRepository, CreateBatchData, UpdateBatchData } from '../data-access/batch.repository.js';
import { auditLogRepository } from '../data-access/audit-log.repository.js';
import { departmentRepository } from '../data-access/department.repository.js';
import { studentMigrationService } from './student-migration.service.js';

// Max semesters by tenant type
const REDUCED_SEMESTER_TENANT_TYPES = ['DEGREE', 'MBA', 'MCA', 'LAW'];
const DEFAULT_MAX_SEMESTERS = 8;
const REDUCED_MAX_SEMESTERS = 6;

class BatchService {
    // Create batch (Super Admin only)
    async create(data: CreateBatchData, actorId: number): Promise<Batch> {
        // Check if batch name already exists within the same tenant
        const existing = await batchRepository.findByName(data.name, data.tenantId);
        if (existing) {
            throw new Error(`Batch "${data.name}" already exists in this institution`);
        }

        const batch = await batchRepository.create(data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'CREATE_BATCH',
            entityType: 'Batch',
            entityId: batch.id,
            newValue: data as unknown as Prisma.JsonValue,
        });

        return batch;
    }

    // Update batch
    async update(id: number, data: UpdateBatchData, actorId: number): Promise<Batch> {
        const existing = await batchRepository.findById(id);
        if (!existing) {
            throw new Error('Batch not found');
        }

        // If updating name, check for duplicates within same tenant
        if (data.name && data.name !== existing.name) {
            const nameExists = await batchRepository.findByName(data.name, existing.tenantId);
            if (nameExists) {
                throw new Error(`Batch "${data.name}" already exists in this institution`);
            }
        }

        const batch = await batchRepository.update(id, data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'UPDATE_BATCH',
            entityType: 'Batch',
            entityId: id,
            oldValue: { name: existing.name, startYear: existing.startYear } as Prisma.JsonValue,
            newValue: data as unknown as Prisma.JsonValue,
        });

        return batch;
    }

    // Delete batch
    async delete(id: number, actorId: number): Promise<void> {
        const existing = await batchRepository.findById(id);
        if (!existing) {
            throw new Error('Batch not found');
        }

        // Check if batch has students
        const batchWithCount = existing as Batch & { _count?: { students: number } };
        if (batchWithCount._count && batchWithCount._count.students > 0) {
            throw new Error('Cannot delete batch with existing students');
        }

        await batchRepository.delete(id);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'DELETE_BATCH',
            entityType: 'Batch',
            entityId: id,
            oldValue: { name: existing.name, startYear: existing.startYear } as Prisma.JsonValue,
        });
    }

    // Get batch by ID
    async getById(id: number): Promise<Batch | null> {
        return batchRepository.findById(id);
    }

    // Get all batches
    async getAll(tenantId?: number): Promise<Batch[]> {
        return batchRepository.findAll(tenantId);
    }

    // Get students in a batch
    async getStudents(batchId: number) {
        const batch = await batchRepository.findById(batchId);
        if (!batch) {
            throw new Error('Batch not found');
        }
        return batchRepository.getStudents(batchId);
    }

    // Assign all students in a batch to a department
    async assignToDepartment(batchId: number, departmentId: number, actorId: number): Promise<number> {
        const batch = await batchRepository.findById(batchId);
        if (!batch) {
            throw new Error('Batch not found');
        }

        const department = await departmentRepository.findById(departmentId);
        if (!department) {
            throw new Error('Department not found');
        }

        const count = await batchRepository.assignStudentsToDepartment(batchId, departmentId);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'ASSIGN_BATCH_TO_DEPARTMENT',
            entityType: 'Batch',
            entityId: batchId,
            newValue: { batchId, departmentId, studentsUpdated: count } as Prisma.JsonValue,
        });

        return count;
    }

    // Assign batch to First Year Cycle (Physics/Chemistry)
    async assignToCycle(batchId: number, cycleType: 'PHYSICS' | 'CHEMISTRY', actorId: number): Promise<number> {
        return studentMigrationService.assignFirstYearCycles(batchId, cycleType, actorId);
    }

    // Rotate First Year Cycles (Physics <-> Chemistry)
    async rotateCycles(batchId: number, actorId: number) {
        return studentMigrationService.rotateFirstYearCycles(batchId, actorId);
    }

    // Restore students to their home branch departments
    async restoreToBranches(batchId: number, actorId: number) {
        return studentMigrationService.restoreToBranch(batchId, actorId);
    }

    // Migrate students to their branch departments based on USN
    async migrateStudentsToBranches(batchId: number, actorId: number): Promise<{ migrated: number; failed: string[] }> {
        const batch = await batchRepository.findById(batchId);
        if (!batch) {
            throw new Error('Batch not found');
        }

        const result = await batchRepository.migrateStudentsToBranches(batchId);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'MIGRATE_BATCH_TO_BRANCHES',
            entityType: 'Batch',
            entityId: batchId,
            newValue: { migrated: result.migrated, failedCount: result.failed.length } as Prisma.JsonValue,
        });

        return result;
    }

    // Progress Batch Semester (1 -> 2 -> ... -> maxSem -> Graduate)
    // maxSem is tenant-aware: 6 for DEGREE/MBA/MCA/LAW, 8 for ENGINEERING
    async progressSemester(batchId: number, actorId: number): Promise<{ previousSemester: number; currentSemester: number; message: string; isGraduated?: boolean }> {
        const batch = await batchRepository.findById(batchId);
        if (!batch) {
            throw new Error('Batch not found');
        }

        // Cast to any to avoid stale type errors during development migration
        const currentBatch = batch as Batch & { isGraduated?: boolean; graduatedAt?: Date };

        if (currentBatch.isGraduated) {
            throw new Error('Batch has already graduated');
        }

        // Determine max semesters from tenant type
        const tenant = await prisma.tenant.findUnique({
            where: { id: currentBatch.tenantId },
            select: { type: true },
        });
        const maxSemesters = tenant && REDUCED_SEMESTER_TENANT_TYPES.includes(tenant.type)
            ? REDUCED_MAX_SEMESTERS
            : DEFAULT_MAX_SEMESTERS;

        const previousSemester = currentBatch.currentSemester;

        // Handle graduation when ending the final semester
        if (previousSemester === maxSemesters) {
            // Graduate the batch
            await batchRepository.update(batchId, {
                isGraduated: true,
                graduatedAt: new Date()
            });

            // Audit Log
            await auditLogRepository.create({
                actorId,
                action: 'GRADUATE_BATCH',
                entityType: 'Batch',
                entityId: batchId,
                oldValue: { currentSemester: previousSemester, isGraduated: false } as Prisma.JsonValue,
                newValue: { isGraduated: true } as Prisma.JsonValue,
            });

            return {
                previousSemester,
                currentSemester: maxSemesters,
                message: `🎓 Congratulations! Batch ${currentBatch.name} has graduated!`,
                isGraduated: true
            };
        }

        const currentSemester = previousSemester + 1;
        let message = `Batch promoted to Semester ${currentSemester}`;

        // Wrap all progression steps in a transaction for atomicity
        await prisma.$transaction(async (tx) => {
            // 1. Update Batch Semester
            await tx.batch.update({
                where: { id: batchId },
                data: { currentSemester }
            });

            // 2. Update All Students' Semester
            await tx.studentProfile.updateMany({
                where: { batchId },
                data: { currentSemester: currentSemester }
            });
        }, { timeout: 30000 });

        // 3. Handle Transitions (outside core transaction — these are complex sub-operations
        // with their own retry logic that shouldn't block the core promotion)
        try {
            if (previousSemester === 1) {
                // Sem 1 -> Sem 2: Cycle Swap (Physics <-> Chemistry)
                await this.rotateCycles(batchId, actorId);
                message += '. First Year Cycles rotated (Physics ↔ Chemistry).';
            } else if (previousSemester === 2) {
                // Sem 2 -> Sem 3: Restore to Branches
                await this.restoreToBranches(batchId, actorId);
                message += '. Students migrated to their permanent Branch Departments.';
            }
        } catch (transitionErr) {
            // Log but don't fail the entire progression — batch and students are already promoted
            message += ' (Warning: post-promotion transition encountered an issue. Please verify student assignments.)';
        }

        // Audit Log
        await auditLogRepository.create({
            actorId,
            action: 'PROGRESS_BATCH_SEMESTER',
            entityType: 'Batch',
            entityId: batchId,
            oldValue: { currentSemester: previousSemester } as Prisma.JsonValue,
            newValue: { currentSemester } as Prisma.JsonValue,
        });

        return { previousSemester, currentSemester, message };
    }
}

export const batchService = new BatchService();
