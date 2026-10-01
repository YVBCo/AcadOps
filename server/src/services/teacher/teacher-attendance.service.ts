/**
 * Teacher Attendance Service
 * ──────────────────────────────────────
 * Handles attendance marking, submission/locking, and history queries.
 *
 * Extracted from teacher.service.ts (lines 561-1300)
 */
import { Prisma } from '@prisma/client';
import prisma from '../../data-access/prisma.js';
import { ApiError } from '../../api/middleware/error.middleware.js';
import { auditLogRepository } from '../../data-access/index.js';
import {
    verifySectionCourseAccess,
    getOrCreateActiveSemester,
} from './shared.js';

export interface MarkAttendanceEntry {
    studentUsn: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    remarks?: string;
}

class TeacherAttendanceService {
    /**
     * Get or create subject for attendance tracking (race-condition safe)
     */
    private async getOrCreateSubject(courseId: number, semesterId: number, sectionName: string) {
        let subject = await prisma.subject.findFirst({
            where: { courseId, semesterId, section: sectionName }
        });

        if (!subject) {
            try {
                subject = await prisma.subject.create({
                    data: { courseId, semesterId, section: sectionName }
                });
            } catch (err: unknown) {
                if ((err as { code?: string }).code === 'P2002') {
                    subject = await prisma.subject.findFirst({
                        where: { courseId, semesterId, section: sectionName }
                    });
                    if (!subject) throw err;
                } else {
                    throw err;
                }
            }
        }

        return subject;
    }

    /**
     * Get enrolled students for attendance (mapped from section students)
     */
    async getStudentsForAttendance(
        userId: number,
        sectionId: number,
        courseId: number,
        date: Date,
        tenantId?: number
    ) {
        const { allocation } = await verifySectionCourseAccess(userId, sectionId, courseId);

        const students = await prisma.studentProfile.findMany({
            where: { sectionId },
            include: {
                user: {
                    select: { id: true, name: true, email: true, tenantId: true }
                }
            },
            orderBy: { rollNumber: 'asc' }
        });

        const resolvedTenantId = tenantId || allocation.section.department?.tenantId ||
            (students.length > 0 ? students[0].user.tenantId : undefined);

        const semester = resolvedTenantId
            ? await getOrCreateActiveSemester(resolvedTenantId)
            : await prisma.semester.findFirst({ where: { status: 'ACTIVE' } });

        const noAttendanceResult = students.map(s => ({
            studentId: s.id,
            name: s.user.name,
            usn: s.rollNumber,
            attendanceStatus: null as string | null,
            isSubmitted: false,
            attendance: null
        }));

        if (!semester) {
            return noAttendanceResult;
        }

        const subject = await prisma.subject.findFirst({
            where: {
                courseId,
                semesterId: semester.id,
                section: allocation.section.name
            }
        });

        if (!subject) {
            return noAttendanceResult;
        }

        const existingAttendance = await prisma.attendance.findMany({
            where: {
                subjectId: subject.id,
                date: new Date(date.toISOString().split('T')[0])
            }
        });

        const attendanceMap = new Map(existingAttendance.map(a => [a.studentId, a]));

        return students.map(s => {
            const att = attendanceMap.get(s.id) || null;
            return {
                studentId: s.id,
                name: s.user.name,
                usn: s.rollNumber,
                attendanceStatus: att?.status || null,
                isSubmitted: att?.isLocked || false,
                attendance: att
            };
        });
    }

    /**
     * Mark attendance for a section/course/date
     */
    async markAttendance(
        userId: number,
        sectionId: number,
        courseId: number,
        date: Date,
        entries: MarkAttendanceEntry[],
        tenantId?: number
    ) {
        const { teacher, allocation } = await verifySectionCourseAccess(userId, sectionId, courseId);

        const resolvedTenantId = tenantId || allocation.section.department?.tenantId;

        const semester = resolvedTenantId
            ? await getOrCreateActiveSemester(resolvedTenantId)
            : await prisma.semester.findFirst({ where: { status: 'ACTIVE' } });

        if (!semester) {
            throw new ApiError(400, 'No active semester found. Please contact your administrator to set up an active semester.');
        }

        const subject = await this.getOrCreateSubject(
            courseId,
            semester.id,
            allocation.section.name
        );

        const normalizedDate = new Date(date.toISOString().split('T')[0]);

        const existingLocked = await prisma.attendance.findFirst({
            where: {
                subjectId: subject.id,
                date: normalizedDate,
                isLocked: true
            }
        });

        if (existingLocked) {
            throw new ApiError(409, 'Attendance for this date is already submitted. Contact Department Admin for corrections.');
        }

        if (entries.length === 0) {
            return { created: 0, updated: 0, message: 'No entries to process' };
        }

        // Pre-fetch all student profiles in a single query (avoids N+1)
        const usns = entries.map(e => e.studentUsn);
        const studentProfiles = await prisma.studentProfile.findMany({
            where: { rollNumber: { in: usns } },
            select: { id: true, rollNumber: true }
        });
        const profileMap = new Map(studentProfiles.map(sp => [sp.rollNumber, sp.id]));

        let created = 0;
        let updated = 0;

        // ── Pre-fetch existing attendance to eliminate N+1 queries ──
        const validStudentIds = entries
            .map(e => profileMap.get(e.studentUsn))
            .filter((id): id is number => id !== undefined);

        const existingAttendance = await prisma.attendance.findMany({
            where: {
                studentId: { in: validStudentIds },
                subjectId: subject.id,
                date: normalizedDate,
            },
            select: { studentId: true },
        });
        const existingSet = new Set(existingAttendance.map(a => a.studentId));

        await prisma.$transaction(async (tx) => {
            for (const entry of entries) {
                const studentId = profileMap.get(entry.studentUsn);
                if (!studentId) continue;

                const hadExisting = existingSet.has(studentId);

                try {
                    await tx.attendance.upsert({
                        where: {
                            studentId_subjectId_date: {
                                studentId,
                                subjectId: subject.id,
                                date: normalizedDate
                            }
                        },
                        create: {
                            studentId,
                            subjectId: subject.id,
                            date: normalizedDate,
                            status: entry.status,
                            remarks: entry.remarks
                        },
                        update: {
                            status: entry.status,
                            remarks: entry.remarks
                        }
                    });
                } catch (upsertErr) {
                    if (upsertErr instanceof Prisma.PrismaClientKnownRequestError && upsertErr.code === 'P2002') {
                        await tx.attendance.updateMany({
                            where: {
                                studentId,
                                subjectId: subject.id,
                                date: normalizedDate,
                                isLocked: false,
                            },
                            data: {
                                status: entry.status,
                                remarks: entry.remarks
                            }
                        });
                    } else {
                        throw upsertErr;
                    }
                }

                if (hadExisting) { updated++; } else { created++; }
            }
        }, { timeout: 20000 });

        await auditLogRepository.create({
            actorId: userId,
            action: 'TEACHER_MARK_ATTENDANCE',
            entityType: 'Attendance',
            entityId: subject.id,
            newValue: {
                role: 'TEACHER',
                teacherId: teacher.id,
                departmentId: allocation.section.departmentId,
                batchId: allocation.section.batchId,
                sectionId, courseId,
                date: normalizedDate,
                count: entries.length, created, updated
            } as unknown as Prisma.JsonValue
        });

        return { created, updated };
    }

    /**
     * Submit/lock attendance for a date
     */
    async submitAttendance(
        userId: number,
        sectionId: number,
        courseId: number,
        date: Date,
        tenantId?: number
    ) {
        const { teacher, allocation } = await verifySectionCourseAccess(userId, sectionId, courseId);

        const resolvedTenantId = tenantId || allocation.section.department?.tenantId;
        const semester = resolvedTenantId
            ? await getOrCreateActiveSemester(resolvedTenantId)
            : await prisma.semester.findFirst({ where: { status: 'ACTIVE' } });

        if (!semester) {
            throw new ApiError(400, 'No active semester found. Please contact your administrator.');
        }

        const subject = await prisma.subject.findFirst({
            where: {
                courseId,
                semesterId: semester.id,
                section: allocation.section.name
            }
        });

        if (!subject) {
            throw new ApiError(404, 'No attendance records found for this course/section. Mark attendance first.');
        }

        const normalizedDate = new Date(date.toISOString().split('T')[0]);

        const result = await prisma.attendance.updateMany({
            where: {
                subjectId: subject.id,
                date: normalizedDate,
                isLocked: false
            },
            data: { isLocked: true }
        });

        await auditLogRepository.create({
            actorId: userId,
            action: 'TEACHER_SUBMIT_ATTENDANCE',
            entityType: 'Attendance',
            entityId: subject.id,
            newValue: {
                role: 'TEACHER',
                teacherId: teacher.id,
                departmentId: allocation.section.departmentId,
                batchId: allocation.section.batchId,
                sectionId, courseId,
                date: normalizedDate,
                submissionStatus: 'SUBMITTED',
                count: result.count
            } as unknown as Prisma.JsonValue
        });

        return { submitted: result.count };
    }

    /**
     * Get attendance records for a section/course
     */
    async getAttendanceRecords(
        userId: number,
        sectionId: number,
        courseId: number,
        startDate?: Date,
        endDate?: Date,
        tenantId?: number
    ) {
        const { allocation } = await verifySectionCourseAccess(userId, sectionId, courseId);

        const resolvedTenantId = tenantId || allocation.section.department?.tenantId;
        const semester = resolvedTenantId
            ? await getOrCreateActiveSemester(resolvedTenantId)
            : await prisma.semester.findFirst({ where: { status: 'ACTIVE' } });

        if (!semester) return [];

        const subject = await prisma.subject.findFirst({
            where: {
                courseId,
                semesterId: semester.id,
                section: allocation.section.name
            }
        });

        if (!subject) return [];

        const where: Prisma.AttendanceWhereInput = { subjectId: subject.id };

        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate.toISOString().split('T')[0]),
                lte: new Date(endDate.toISOString().split('T')[0])
            };
        }

        return prisma.attendance.findMany({
            where,
            include: {
                student: {
                    include: {
                        user: { select: { name: true } }
                    }
                }
            },
            orderBy: [
                { date: 'desc' },
                { student: { rollNumber: 'asc' } }
            ]
        });
    }

    /**
     * Create an edit request for locked attendance
     */
    async createAttendanceEditRequest(
        userId: number,
        attendanceId: number,
        newStatus: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
        reason: string
    ) {
        const existingAttendance = await prisma.attendance.findUnique({
            where: { id: attendanceId },
            include: { student: true, subject: true }
        });

        if (!existingAttendance) throw new Error('Attendance record not found');
        if (!existingAttendance.isLocked) throw new Error('Attendance is not locked - you can edit directly');

        return prisma.editRequest.create({
            data: {
                type: 'ATTENDANCE',
                requesterId: userId,
                subjectId: existingAttendance.subjectId,
                entityType: 'Attendance',
                entityId: attendanceId,
                oldValue: { status: existingAttendance.status },
                newValue: { status: newStatus },
                reason,
                status: 'PENDING',
            }
        });
    }

    /**
     * Get attendance history for a section/course/date range
     */
    async getAttendanceHistory(
        sectionId: number,
        courseId: number,
        startDate?: Date,
        endDate?: Date
    ) {
        const where: Prisma.AttendanceWhereInput = {
            student: { sectionId },
            subject: { courseId }
        };

        if (startDate || endDate) {
            where.date = {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
            };
        }

        const attendance = await prisma.attendance.findMany({
            where,
            include: {
                student: {
                    include: {
                        user: { select: { name: true } }
                    }
                },
                subject: {
                    include: {
                        course: { select: { name: true, code: true } }
                    }
                }
            },
            orderBy: [
                { date: 'desc' },
                { student: { rollNumber: 'asc' } }
            ]
        });

        const groupedByDate: Record<string, typeof attendance> = {};
        const dates: string[] = [];

        for (const record of attendance) {
            const dateKey = record.date.toISOString().split('T')[0];
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = [];
                dates.push(dateKey);
            }
            groupedByDate[dateKey].push(record);
        }

        return {
            dates: dates.sort((a, b) => b.localeCompare(a)),
            attendance: groupedByDate
        };
    }
}

export const teacherAttendanceService = new TeacherAttendanceService();
