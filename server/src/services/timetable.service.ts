import { SectionTimetable, DepartmentTimeSlotConfig, Prisma } from '@prisma/client';
import {
    departmentTimeSlotConfigRepository,
    sectionTimetableRepository,
    CreateSectionTimetableData,
    CreateTimeSlotConfigData
} from '../data-access/timetable.repository.js';
import { auditLogRepository } from '../data-access/index.js';

class TimetableService {
    /**
     * Configure time slot settings for a department
     * Custom durations persist for all sections in the department
     */
    async configureTimeSlots(
        departmentId: number,
        config: {
            slotDuration?: number;
            dayStartTime?: string;
            dayEndTime?: string;
            breakSlots?: Array<{ start: string; end: string; label?: string }>;
        },
        actorId: number
    ): Promise<DepartmentTimeSlotConfig> {
        const timeSlotConfig = await departmentTimeSlotConfigRepository.upsert({
            departmentId,
            slotDuration: config.slotDuration,
            dayStartTime: config.dayStartTime,
            dayEndTime: config.dayEndTime,
            breakSlots: config.breakSlots as Prisma.JsonValue,
        });

        await auditLogRepository.create({
            actorId,
            action: 'CONFIGURE_TIME_SLOTS',
            entityType: 'DepartmentTimeSlotConfig',
            entityId: timeSlotConfig.id,
            newValue: { departmentId, ...config } as Prisma.JsonValue,
        });

        return timeSlotConfig;
    }

    /**
     * Get time slot configuration for a department
     */
    async getTimeSlotConfig(departmentId: number): Promise<DepartmentTimeSlotConfig | null> {
        return departmentTimeSlotConfigRepository.findByDepartment(departmentId);
    }

    /**
     * Upload timetable (PDF/image) for a section
     */
    async uploadTimetable(
        data: {
            sectionId: number;
            semesterId: number;
            semesterNumber: number;
            fileUrl: string;
            fileName: string;
            fileType: 'pdf' | 'image';
        },
        actorId: number
    ): Promise<SectionTimetable> {
        const timetable = await sectionTimetableRepository.upsert({
            ...data,
            uploadedBy: actorId,
        });

        await auditLogRepository.create({
            actorId,
            action: 'UPLOAD_TIMETABLE',
            entityType: 'SectionTimetable',
            entityId: timetable.id,
            newValue: {
                sectionId: data.sectionId,
                semesterId: data.semesterId,
                fileName: data.fileName,
                fileType: data.fileType,
            } as Prisma.JsonValue,
        });

        return timetable;
    }

    /**
     * Get timetable for a section and semester
     */
    async getTimetable(sectionId: number, semesterId: number): Promise<SectionTimetable | null> {
        return sectionTimetableRepository.findBySectionAndSemester(sectionId, semesterId);
    }

    /**
     * Get all timetables for a section
     */
    async getTimetablesBySection(sectionId: number): Promise<SectionTimetable[]> {
        return sectionTimetableRepository.findBySection(sectionId);
    }

    /**
     * Get all timetables for a semester
     */
    async getTimetablesBySemester(semesterId: number): Promise<SectionTimetable[]> {
        return sectionTimetableRepository.findBySemester(semesterId);
    }

    /**
     * Update timetable file
     */
    async updateTimetable(
        id: number,
        data: {
            fileUrl?: string;
            fileName?: string;
            fileType?: string;
        },
        actorId: number
    ): Promise<SectionTimetable> {
        const existing = await sectionTimetableRepository.findById(id);
        if (!existing) {
            throw new Error('Timetable not found');
        }

        const updated = await sectionTimetableRepository.update(id, data);

        await auditLogRepository.create({
            actorId,
            action: 'UPDATE_TIMETABLE',
            entityType: 'SectionTimetable',
            entityId: id,
            oldValue: { fileName: existing.fileName } as Prisma.JsonValue,
            newValue: data as Prisma.JsonValue,
        });

        return updated;
    }

    /**
     * Deactivate a timetable
     */
    async deactivateTimetable(id: number, actorId: number): Promise<SectionTimetable> {
        const existing = await sectionTimetableRepository.findById(id);
        if (!existing) {
            throw new Error('Timetable not found');
        }

        const updated = await sectionTimetableRepository.deactivate(id);

        await auditLogRepository.create({
            actorId,
            action: 'DEACTIVATE_TIMETABLE',
            entityType: 'SectionTimetable',
            entityId: id,
            oldValue: { isActive: true } as Prisma.JsonValue,
            newValue: { isActive: false } as Prisma.JsonValue,
        });

        return updated;
    }
}

export const timetableService = new TimetableService();
