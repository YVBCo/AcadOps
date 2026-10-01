import { Attendance, AttendanceStatus, Prisma } from '@prisma/client';
import { attendanceRepository, BulkAttendanceEntry } from '../data-access/attendance.repository.js';
import { subjectRepository } from '../data-access/subject.repository.js';
import { semesterRepository } from '../data-access/semester.repository.js';
import { auditLogRepository } from '../data-access/audit-log.repository.js';
import { prisma } from '../data-access/prisma.js';
import { smsService } from './sms.service.js';

export const attendanceService = {
    // Mark attendance for a single student
    async markAttendance(
        subjectId: number,
        studentId: number,
        date: Date,
        status: AttendanceStatus,
        remarks: string | undefined,
        actorId: number
    ): Promise<Attendance> {
        // Verify subject exists
        const subject = await subjectRepository.findById(subjectId);
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(subject.semesterId);
        if (!isActive) {
            throw new Error('Cannot mark attendance in a closed semester');
        }

        // Verify student is enrolled
        const enrollment = await prisma.enrollment.findUnique({
            where: {
                studentId_subjectId: {
                    studentId,
                    subjectId,
                },
            },
        });
        if (!enrollment) {
            throw new Error('Student is not enrolled in this subject');
        }

        const attendance = await attendanceRepository.upsertAttendance({
            studentId,
            subjectId,
            date,
            status,
            remarks,
        });

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'MARK_ATTENDANCE',
            entityType: 'Attendance',
            entityId: attendance.id,
            newValue: { subjectId, studentId, date, status } as unknown as Prisma.JsonValue,
        });

        // Send SMS to parent if student is absent (fire-and-forget)
        if (status === 'ABSENT') {
            const subjectWithCourse = await prisma.subject.findUnique({
                where: { id: subjectId },
                include: { course: { select: { name: true } } },
            });
            const subjectName = subjectWithCourse?.course?.name || 'a class';
            smsService.sendAbsenceNotification(studentId, subjectName, date).catch(() => { });
        }

        return attendance;
    },

    // Bulk mark attendance for a subject on a specific date
    async bulkMarkAttendance(
        subjectId: number,
        date: Date,
        entries: BulkAttendanceEntry[],
        actorId: number
    ): Promise<{ updated: number; created: number }> {
        // Verify subject exists
        const subject = await subjectRepository.findById(subjectId);
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(subject.semesterId);
        if (!isActive) {
            throw new Error('Cannot mark attendance in a closed semester');
        }

        let created = 0;
        let updated = 0;

        // Process each entry using upsert
        for (const entry of entries) {
            const existing = await prisma.attendance.findUnique({
                where: {
                    studentId_subjectId_date: {
                        studentId: entry.studentId,
                        subjectId,
                        date,
                    },
                },
            });

            await attendanceRepository.upsertAttendance({
                studentId: entry.studentId,
                subjectId,
                date,
                status: entry.status,
                remarks: entry.remarks,
            });

            if (existing) {
                updated++;
            } else {
                created++;
            }
        }

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'BULK_MARK_ATTENDANCE',
            entityType: 'Attendance',
            entityId: subjectId,
            newValue: { subjectId, date, count: entries.length } as unknown as Prisma.JsonValue,
        });

        // Send SMS to parents for absent students (fire-and-forget)
        const absentEntries = entries.filter(e => e.status === 'ABSENT');
        if (absentEntries.length > 0) {
            const subjectWithCourse = await prisma.subject.findUnique({
                where: { id: subjectId },
                include: { course: { select: { name: true } } },
            });
            const subjectName = subjectWithCourse?.course?.name || 'a class';
            for (const entry of absentEntries) {
                smsService.sendAbsenceNotification(entry.studentId, subjectName, date).catch(() => { });
            }
        }

        return { created, updated };
    },

    // Get attendance for a subject on a specific date
    async getAttendanceByDate(subjectId: number, date: Date): Promise<Attendance[]> {
        return attendanceRepository.findBySubjectAndDate(subjectId, date);
    },

    // Get attendance summary for a subject
    async getAttendanceSummary(subjectId: number) {
        return attendanceRepository.getAttendanceSummary(subjectId);
    },

    // Get student's attendance for a subject
    async getStudentAttendance(studentId: number, subjectId?: number): Promise<Attendance[]> {
        return attendanceRepository.findByStudent(studentId, subjectId);
    },

    // Get attendance report for a date range
    async getAttendanceReport(subjectId: number, startDate: Date, endDate: Date) {
        return attendanceRepository.findBySubjectDateRange(subjectId, startDate, endDate);
    },

    // Get enrolled students for attendance sheet
    async getEnrolledStudentsForAttendance(subjectId: number, date: Date) {
        // Get enrolled students
        const enrollments = await prisma.enrollment.findMany({
            where: { subjectId },
            include: {
                student: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
            },
            orderBy: { student: { user: { name: 'asc' } } },
        });

        // Get existing attendance for this date
        const existingAttendance = await attendanceRepository.findBySubjectAndDate(subjectId, date);
        const attendanceMap = new Map(
            existingAttendance.map((a) => [a.studentId, a])
        );

        // Merge data
        return enrollments.map((enrollment) => ({
            studentId: enrollment.studentId,
            studentName: enrollment.student.user.name,
            email: enrollment.student.user.email,
            rollNumber: enrollment.student.rollNumber,
            attendance: attendanceMap.get(enrollment.studentId) || null,
        }));
    },
};
