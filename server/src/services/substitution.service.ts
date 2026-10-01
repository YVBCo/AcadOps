import { prisma } from '../data-access/prisma.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'substitution-service' });

export const substitutionService = {
    async getAvailableTeachers(tenantId: number, semesterId: number, dayOfWeek: number, periodNumber: number, date: Date, departmentId?: number) {
        // Find all teachers in the department
        const where: any = { user: { tenantId, role: 'TEACHER', isActive: true } };
        if (departmentId) where.user.departmentId = departmentId;
        
        const allTeachers = await prisma.teacherProfile.findMany({
            where,
            include: { user: { select: { id: true, name: true, email: true } } },
        });
        
        // Find teachers who already have a slot at this time
        const busySlots = await prisma.timetableSlot.findMany({
            where: {
                semesterId,
                dayOfWeek,
                periodNumber,
                isBreak: false,
                courseAllocation: { teacherId: { not: null } },
            },
            include: { courseAllocation: { select: { teacherId: true } } },
        });
        const busyTeacherIds = new Set(busySlots.map(s => s.courseAllocation?.teacherId).filter(Boolean));
        
        // Also check if any teacher already has a substitution at this time today
        const busySubs = await prisma.teacherSubstitution.findMany({
            where: {
                date: {
                    gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
                    lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
                },
                timetableSlot: { periodNumber, dayOfWeek },
            },
            select: { substituteTeacherId: true },
        });
        busySubs.forEach(s => busyTeacherIds.add(s.substituteTeacherId));
        
        // Filter to available teachers
        return allTeachers
            .filter(t => !busyTeacherIds.has(t.id))
            .map(t => ({
                teacherProfileId: t.id,
                userId: t.user.id,
                name: t.user.name,
                email: t.user.email,
                employeeId: t.employeeId,
            }));
    },
    
    async assignSubstitute(data: {
        timetableSlotId: number;
        date: string;
        originalTeacherId: number;
        substituteTeacherId: number;
        substituteCourseId?: number;
        reason?: string;
        assignedBy: number;
    }) {
        return prisma.teacherSubstitution.create({
            data: {
                timetableSlotId: data.timetableSlotId,
                date: new Date(data.date),
                originalTeacherId: data.originalTeacherId,
                substituteTeacherId: data.substituteTeacherId,
                substituteCourseId: data.substituteCourseId || null,
                reason: data.reason,
                assignedBy: data.assignedBy,
            },
            include: {
                timetableSlot: { include: { courseAllocation: { include: { course: true } } } },
                originalTeacher: { include: { user: { select: { name: true } } } },
                substituteTeacher: { include: { user: { select: { name: true } } } },
                substituteCourse: { select: { name: true, code: true } },
            },
        });
    },
    
    async getSubstitutionsForDate(tenantId: number, date: string, departmentId?: number) {
        const dateObj = new Date(date);
        const where: any = {
            date: {
                gte: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()),
                lt: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + 1),
            },
        };
        if (departmentId) {
            where.timetableSlot = { section: { departmentId } };
        }
        
        return prisma.teacherSubstitution.findMany({
            where,
            include: {
                timetableSlot: {
                    include: {
                        section: { select: { name: true } },
                        courseAllocation: { include: { course: { select: { name: true, code: true } } } },
                    },
                },
                originalTeacher: { include: { user: { select: { name: true } } } },
                substituteTeacher: { include: { user: { select: { name: true } } } },
                substituteCourse: { select: { name: true, code: true } },
            },
            orderBy: { timetableSlot: { periodNumber: 'asc' } },
        });
    },
    
    async removeSubstitution(id: number) {
        return prisma.teacherSubstitution.delete({ where: { id } });
    },
};
