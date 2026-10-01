import { prisma } from '../data-access/prisma.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'academic-calendar-service' });

export const academicCalendarService = {
    async declareDay(tenantId: number, declaredBy: number, data: {
        date: string;
        type: 'HOLIDAY' | 'WORKING_SATURDAY' | 'CLASS_ON_HOLIDAY';
        label?: string;
        overrideDay?: number; // 1-5
        departmentId?: number;
    }) {
        return prisma.academicCalendarDay.upsert({
            where: {
                tenantId_date_departmentId: {
                    tenantId,
                    date: new Date(data.date),
                    departmentId: data.departmentId ?? 0, // 0 as placeholder for null in unique constraint
                },
            },
            // Note: The unique constraint uses departmentId which can be null.
            // Since Prisma doesn't support null in compound unique for upsert easily,
            // use create/update pattern instead
            create: {
                tenantId,
                date: new Date(data.date),
                type: data.type,
                label: data.label,
                overrideDay: data.overrideDay,
                departmentId: data.departmentId || null,
                declaredBy,
            },
            update: {
                type: data.type,
                label: data.label,
                overrideDay: data.overrideDay,
            },
        });
    },
    // For cases where Prisma upsert with nullable unique fields is tricky:
    async declareCalendarDay(tenantId: number, declaredBy: number, data: {
        date: string;
        type: 'HOLIDAY' | 'WORKING_SATURDAY' | 'CLASS_ON_HOLIDAY';
        label?: string;
        overrideDay?: number;
        departmentId?: number;
    }) {
        const dateObj = new Date(data.date);
        // Check if entry already exists
        const existing = await prisma.academicCalendarDay.findFirst({
            where: {
                tenantId,
                date: dateObj,
                departmentId: data.departmentId || null,
            },
        });
        if (existing) {
            return prisma.academicCalendarDay.update({
                where: { id: existing.id },
                data: {
                    type: data.type,
                    label: data.label,
                    overrideDay: data.overrideDay,
                },
            });
        }
        return prisma.academicCalendarDay.create({
            data: {
                tenantId,
                date: dateObj,
                type: data.type,
                label: data.label,
                overrideDay: data.overrideDay,
                departmentId: data.departmentId || null,
                declaredBy,
            },
        });
    },
    async removeCalendarDay(id: number) {
        return prisma.academicCalendarDay.delete({ where: { id } });
    },
    async getCalendarForMonth(tenantId: number, year: number, month: number, departmentId?: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        const where: any = {
            tenantId,
            date: { gte: startDate, lte: endDate },
        };
        // Include department-specific AND general (null dept) entries
        if (departmentId) {
            where.OR = [{ departmentId }, { departmentId: null }];
            delete where.tenantId; // Move to each OR clause
            where.OR = [
                { departmentId, tenantId, date: { gte: startDate, lte: endDate } },
                { departmentId: null, tenantId, date: { gte: startDate, lte: endDate } },
            ];
            return prisma.academicCalendarDay.findMany({
                where: { OR: where.OR },
                include: { department: { select: { name: true } }, declarer: { select: { name: true } } },
                orderBy: { date: 'asc' },
            });
        }
        return prisma.academicCalendarDay.findMany({
            where,
            include: { department: { select: { name: true } }, declarer: { select: { name: true } } },
            orderBy: { date: 'asc' },
        });
    },
    async getEffectiveDayOfWeek(tenantId: number, date: Date, departmentId?: number): Promise<number | null> {
        // Returns: number (1-5) = the day's timetable to follow, null = holiday (no classes)
        const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon..6=Sat
        
        // Find any calendar entry for this date
        const entries = await prisma.academicCalendarDay.findMany({
            where: {
                tenantId,
                date: {
                    gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
                    lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
                },
                OR: departmentId
                    ? [{ departmentId }, { departmentId: null }]
                    : [{ departmentId: null }],
            },
            orderBy: { departmentId: 'desc' }, // Dept-specific takes priority
        });
        
        const entry = entries[0]; // Most specific entry
        
        if (entry) {
            if (entry.type === 'HOLIDAY') return null; // Holiday - no classes
            if (entry.type === 'WORKING_SATURDAY' || entry.type === 'CLASS_ON_HOLIDAY') {
                return entry.overrideDay || dayOfWeek; // Follow override day's timetable
            }
        }
        
        // Default behavior
        if (dayOfWeek === 0 || dayOfWeek === 6) return null; // Sun/Sat = no classes by default
        return dayOfWeek; // Normal weekday
    },
};
