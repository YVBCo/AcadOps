import { SectionTimetable, DepartmentTimeSlotConfig, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

// ============================================
// Department Time Slot Config Repository
// ============================================

export interface CreateTimeSlotConfigData {
    departmentId: number;
    slotDuration?: number;
    dayStartTime?: string;
    dayEndTime?: string;
    breakSlots?: Prisma.JsonValue;
}

export interface UpdateTimeSlotConfigData {
    slotDuration?: number;
    dayStartTime?: string;
    dayEndTime?: string;
    breakSlots?: Prisma.JsonValue;
}

export const departmentTimeSlotConfigRepository = {
    // Upsert config for department
    async upsert(data: CreateTimeSlotConfigData): Promise<DepartmentTimeSlotConfig> {
        return prisma.departmentTimeSlotConfig.upsert({
            where: { departmentId: data.departmentId },
            create: {
                departmentId: data.departmentId,
                slotDuration: data.slotDuration,
                dayStartTime: data.dayStartTime,
                dayEndTime: data.dayEndTime,
                breakSlots: data.breakSlots as Prisma.InputJsonValue,
            },
            update: {
                slotDuration: data.slotDuration,
                dayStartTime: data.dayStartTime,
                dayEndTime: data.dayEndTime,
                breakSlots: data.breakSlots as Prisma.InputJsonValue,
            },
        });
    },

    // Get config by department
    async findByDepartment(departmentId: number): Promise<DepartmentTimeSlotConfig | null> {
        return prisma.departmentTimeSlotConfig.findUnique({
            where: { departmentId },
        });
    },
};

// ============================================
// Section Timetable Repository
// ============================================

export interface CreateSectionTimetableData {
    sectionId: number;
    semesterId: number;
    semesterNumber: number;
    fileUrl: string;
    fileName: string;
    fileType: string;
    uploadedBy: number;
}

export interface UpdateSectionTimetableData {
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    isActive?: boolean;
}

export const sectionTimetableRepository = {
    // Create or update timetable
    async upsert(data: CreateSectionTimetableData): Promise<SectionTimetable> {
        return prisma.sectionTimetable.upsert({
            where: {
                sectionId_semesterId: {
                    sectionId: data.sectionId,
                    semesterId: data.semesterId,
                },
            },
            create: data,
            update: {
                fileUrl: data.fileUrl,
                fileName: data.fileName,
                fileType: data.fileType,
                semesterNumber: data.semesterNumber,
                uploadedBy: data.uploadedBy,
                isActive: true,
            },
        });
    },

    // Get timetable by section and semester
    async findBySectionAndSemester(
        sectionId: number,
        semesterId: number
    ): Promise<SectionTimetable | null> {
        return prisma.sectionTimetable.findUnique({
            where: {
                sectionId_semesterId: {
                    sectionId,
                    semesterId,
                },
            },
            include: {
                section: {
                    include: {
                        department: true,
                        batch: true,
                    },
                },
                semester: true,
                uploader: {
                    select: { id: true, name: true, email: true },
                },
            },
        });
    },

    // Get timetable by section
    async findBySection(sectionId: number): Promise<SectionTimetable[]> {
        return prisma.sectionTimetable.findMany({
            where: { sectionId, isActive: true },
            include: {
                semester: true,
                uploader: {
                    select: { id: true, name: true },
                },
            },
            orderBy: { semesterNumber: 'desc' },
        });
    },

    // Get active timetables for a semester
    async findBySemester(semesterId: number): Promise<SectionTimetable[]> {
        return prisma.sectionTimetable.findMany({
            where: { semesterId, isActive: true },
            include: {
                section: {
                    include: {
                        department: true,
                        batch: true,
                    },
                },
            },
        });
    },

    // Update timetable
    async update(id: number, data: UpdateSectionTimetableData): Promise<SectionTimetable> {
        return prisma.sectionTimetable.update({
            where: { id },
            data,
        });
    },

    // Deactivate timetable
    async deactivate(id: number): Promise<SectionTimetable> {
        return prisma.sectionTimetable.update({
            where: { id },
            data: { isActive: false },
        });
    },

    // Find by id
    async findById(id: number): Promise<SectionTimetable | null> {
        return prisma.sectionTimetable.findUnique({
            where: { id },
            include: {
                section: true,
                semester: true,
            },
        });
    },
};
