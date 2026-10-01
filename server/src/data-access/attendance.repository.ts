import { prisma } from './prisma.js';
import { Attendance, AttendanceStatus, Prisma } from '@prisma/client';

export interface CreateAttendanceData {
    studentId: number;
    subjectId: number;
    date: Date;
    status: AttendanceStatus;
    remarks?: string;
}

export interface UpdateAttendanceData {
    status?: AttendanceStatus;
    remarks?: string;
}

export interface BulkAttendanceEntry {
    studentId: number;
    status: AttendanceStatus;
    remarks?: string;
}

export const attendanceRepository = {
    async create(data: CreateAttendanceData): Promise<Attendance> {
        return prisma.attendance.create({
            data,
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
        });
    },

    async createMany(subjectId: number, date: Date, entries: BulkAttendanceEntry[]): Promise<number> {
        const result = await prisma.attendance.createMany({
            data: entries.map((entry) => ({
                studentId: entry.studentId,
                subjectId,
                date,
                status: entry.status,
                remarks: entry.remarks,
            })),
            skipDuplicates: true,
        });
        return result.count;
    },

    async upsertAttendance(data: CreateAttendanceData): Promise<Attendance> {
        return prisma.attendance.upsert({
            where: {
                studentId_subjectId_date: {
                    studentId: data.studentId,
                    subjectId: data.subjectId,
                    date: data.date,
                },
            },
            update: {
                status: data.status,
                remarks: data.remarks,
                markedAt: new Date(),
            },
            create: data,
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
        });
    },

    async findById(id: number): Promise<Attendance | null> {
        return prisma.attendance.findUnique({
            where: { id },
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
                subject: {
                    include: { course: true },
                },
            },
        });
    },

    async findBySubjectAndDate(subjectId: number, date: Date): Promise<Attendance[]> {
        return prisma.attendance.findMany({
            where: {
                subjectId,
                date,
            },
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
            orderBy: { student: { user: { name: 'asc' } } },
        });
    },

    async findByStudent(studentId: number, subjectId?: number): Promise<Attendance[]> {
        return prisma.attendance.findMany({
            where: {
                studentId,
                ...(subjectId && { subjectId }),
            },
            include: {
                subject: {
                    include: { course: { select: { id: true, name: true, code: true } } },
                },
            },
            orderBy: { date: 'desc' },
        });
    },

    async findBySubjectDateRange(
        subjectId: number,
        startDate: Date,
        endDate: Date
    ): Promise<Attendance[]> {
        return prisma.attendance.findMany({
            where: {
                subjectId,
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
            orderBy: [{ date: 'desc' }, { student: { user: { name: 'asc' } } }],
        });
    },

    async getAttendanceSummary(subjectId: number): Promise<{
        studentId: number;
        studentName: string;
        present: number;
        absent: number;
        late: number;
        excused: number;
        total: number;
        percentage: number;
    }[]> {
        // Get all students enrolled in the subject
        const enrollments = await prisma.enrollment.findMany({
            where: { subjectId },
            include: {
                student: {
                    include: { user: { select: { id: true, name: true } } },
                },
            },
        });

        // Get attendance records for the subject
        const attendanceRecords = await prisma.attendance.groupBy({
            by: ['studentId', 'status'],
            where: { subjectId },
            _count: { status: true },
        });

        // Build summary for each student
        const summaryMap = new Map<number, {
            studentId: number;
            studentName: string;
            present: number;
            absent: number;
            late: number;
            excused: number;
            total: number;
        }>();

        // Initialize with enrolled students
        enrollments.forEach((enrollment) => {
            summaryMap.set(enrollment.studentId, {
                studentId: enrollment.studentId,
                studentName: enrollment.student.user.name,
                present: 0,
                absent: 0,
                late: 0,
                excused: 0,
                total: 0,
            });
        });

        // Fill in attendance data
        attendanceRecords.forEach((record) => {
            const summary = summaryMap.get(record.studentId);
            if (summary) {
                const count = record._count.status;
                summary.total += count;
                switch (record.status) {
                    case 'PRESENT':
                        summary.present = count;
                        break;
                    case 'ABSENT':
                        summary.absent = count;
                        break;
                    case 'LATE':
                        summary.late = count;
                        break;
                    case 'EXCUSED':
                        summary.excused = count;
                        break;
                }
            }
        });

        // Calculate percentages and return
        return Array.from(summaryMap.values()).map((summary) => ({
            ...summary,
            percentage: summary.total > 0
                ? Math.round(((summary.present + summary.late) / summary.total) * 100)
                : 0,
        }));
    },

    async update(id: number, data: UpdateAttendanceData): Promise<Attendance> {
        return prisma.attendance.update({
            where: { id },
            data: {
                ...data,
                markedAt: new Date(),
            },
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
        });
    },

    async delete(id: number): Promise<void> {
        await prisma.attendance.delete({ where: { id } });
    },
};
