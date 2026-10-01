import { prisma } from '../data-access/prisma.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'classroom-service' });

export const classroomService = {
    async create(tenantId: number, data: { name: string; building?: string; capacity?: number; type?: string }) {
        return prisma.classroom.create({ data: { tenantId, ...data } });
    },
    async update(id: number, data: { name?: string; building?: string; capacity?: number; type?: string; isActive?: boolean }) {
        return prisma.classroom.update({ where: { id }, data });
    },
    async remove(id: number) {
        return prisma.classroom.update({ where: { id }, data: { isActive: false } });
    },
    async list(tenantId: number, type?: string) {
        const where: any = { tenantId, isActive: true };
        if (type) where.type = type;
        return prisma.classroom.findMany({ where, orderBy: { name: 'asc' } });
    },
    async getFreeClassrooms(tenantId: number, dayOfWeek: number, periodNumber: number, semesterId: number, type?: string) {
        // Get all occupied room IDs at this slot
        const occupiedSlots = await prisma.timetableSlot.findMany({
            where: { semesterId, dayOfWeek, periodNumber, classroomId: { not: null } },
            select: { classroomId: true },
        });
        const occupiedIds = occupiedSlots.map(s => s.classroomId!).filter(Boolean);
        const where: any = { tenantId, isActive: true, id: { notIn: occupiedIds } };
        if (type) where.type = type;
        return prisma.classroom.findMany({ where, orderBy: { name: 'asc' } });
    },
};
