import { Semester, SemesterStatus, Prisma } from '@prisma/client';
import { semesterRepository, auditLogRepository, CreateSemesterData, UpdateSemesterData } from '../data-access/index.js';
import { batchService } from './batch.service.js';
import { SEMESTER_MANAGERS } from '../config/index.js';
import { UserRole } from '@prisma/client';

class SemesterService {
    // Create semester (Super Admin only)
    async create(data: CreateSemesterData, actorId: number): Promise<Semester> {
        // Validate dates
        if (data.startDate >= data.endDate) {
            throw new Error('Start date must be before end date');
        }

        const semester = await semesterRepository.create(data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'CREATE_SEMESTER',
            entityType: 'Semester',
            entityId: semester.id,
            newValue: {
                name: data.name,
                startDate: data.startDate.toISOString(),
                endDate: data.endDate.toISOString(),
            } as Prisma.JsonValue,
        });

        return semester;
    }

    // Update semester (only if not CLOSED)
    async update(id: number, data: UpdateSemesterData, actorId: number): Promise<Semester> {
        const existing = await semesterRepository.findById(id);
        if (!existing) {
            throw new Error('Semester not found');
        }

        // CRITICAL: Cannot modify CLOSED semester
        if (existing.status === 'CLOSED') {
            throw new Error('Cannot modify a closed semester');
        }

        // Validate dates if provided
        const startDate = data.startDate || existing.startDate;
        const endDate = data.endDate || existing.endDate;
        if (startDate >= endDate) {
            throw new Error('Start date must be before end date');
        }

        const semester = await semesterRepository.update(id, data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'UPDATE_SEMESTER',
            entityType: 'Semester',
            entityId: id,
            oldValue: {
                name: existing.name,
                startDate: existing.startDate.toISOString(),
                endDate: existing.endDate.toISOString(),
                status: existing.status,
            } as Prisma.JsonValue,
            newValue: {
                name: data.name,
                startDate: data.startDate?.toISOString(),
                endDate: data.endDate?.toISOString(),
            } as Prisma.JsonValue,
        });

        return semester;
    }

    // Open semester (set to ACTIVE)
    async open(id: number, actorId: number, actorRole: UserRole): Promise<Semester> {
        // Check permission
        if (!SEMESTER_MANAGERS.includes(actorRole)) {
            throw new Error('Insufficient permissions to open semester');
        }

        const existing = await semesterRepository.findById(id);
        if (!existing) {
            throw new Error('Semester not found');
        }

        if (existing.status === 'ACTIVE') {
            throw new Error('Semester is already active');
        }

        if (existing.status === 'CLOSED') {
            throw new Error('Cannot reopen a closed semester');
        }

        const semester = await semesterRepository.open(id);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'OPEN_SEMESTER',
            entityType: 'Semester',
            entityId: id,
            oldValue: { status: existing.status } as Prisma.JsonValue,
            newValue: { status: 'ACTIVE' } as Prisma.JsonValue,
        });

        return semester;
    }

    // Close semester (CRITICAL - locks all modifications)
    async close(
        id: number,
        actorId: number,
        actorRole: UserRole,
        options?: {
            transitions?: Array<{
                batchId: number;
                type: 'ROTATE_CYCLES' | 'RESTORE_BRANCHES';
            }>;
        }
    ): Promise<Semester> {
        // Check permission
        if (!SEMESTER_MANAGERS.includes(actorRole)) {
            throw new Error('Insufficient permissions to close semester');
        }

        const existing = await semesterRepository.findById(id);
        if (!existing) {
            throw new Error('Semester not found');
        }

        if (existing.status !== 'ACTIVE') {
            throw new Error('Can only close an active semester');
        }

        const semester = await semesterRepository.close(id);

        // Execute batch transitions if requested
        if (options?.transitions && options.transitions.length > 0) {
            for (const transition of options.transitions) {
                if (transition.type === 'ROTATE_CYCLES') {
                    await batchService.rotateCycles(transition.batchId, actorId);
                } else if (transition.type === 'RESTORE_BRANCHES') {
                    await batchService.restoreToBranches(transition.batchId, actorId);
                }
            }
        }

        // Audit log - CRITICAL action
        await auditLogRepository.create({
            actorId,
            action: 'CLOSE_SEMESTER',
            entityType: 'Semester',
            entityId: id,
            oldValue: { status: 'ACTIVE' } as Prisma.JsonValue,
            newValue: {
                status: 'CLOSED',
                transitions: options?.transitions
            } as Prisma.JsonValue,
        });

        return semester;
    }

    // Archive semester
    async archive(id: number, actorId: number, actorRole: UserRole): Promise<Semester> {
        if (!SEMESTER_MANAGERS.includes(actorRole)) {
            throw new Error('Insufficient permissions to archive semester');
        }

        const existing = await semesterRepository.findById(id);
        if (!existing) {
            throw new Error('Semester not found');
        }

        if (existing.status !== 'CLOSED') {
            throw new Error('Can only archive a closed semester');
        }

        const semester = await semesterRepository.archive(id);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'ARCHIVE_SEMESTER',
            entityType: 'Semester',
            entityId: id,
            oldValue: { status: 'CLOSED' } as Prisma.JsonValue,
            newValue: { status: 'ARCHIVED' } as Prisma.JsonValue,
        });

        return semester;
    }

    // Get semester by ID
    async getById(id: number): Promise<Semester | null> {
        return semesterRepository.findById(id);
    }

    // Get all semesters
    async getAll(status?: SemesterStatus, tenantId?: number): Promise<Semester[]> {
        return semesterRepository.findAll(status, tenantId);
    }

    // Get active semester
    async getActive(tenantId?: number): Promise<Semester | null> {
        return semesterRepository.findActive(tenantId);
    }

    // Check if semester is active (for permission checks)
    async isActive(id: number): Promise<boolean> {
        return semesterRepository.isActive(id);
    }

    // Validate that operations are allowed on this semester
    async validateOperationAllowed(semesterId: number): Promise<void> {
        const isActive = await this.isActive(semesterId);
        if (!isActive) {
            throw new Error('Semester is closed; modifications not allowed');
        }
    }
}

export const semesterService = new SemesterService();
