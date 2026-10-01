import { Prisma, MentorApprovalStatus } from '@prisma/client';
import { prisma } from '../data-access/prisma.js';
import { validateNotLocked, getBatchCurrentSemester } from '../utils/semester-lock.js';
import {
    internalAssessmentRepository,
    internalMarksDetailRepository
} from '../data-access/internal-assessment.repository.js';
import { auditLogRepository } from '../data-access/index.js';
import { courseAllocationRepository } from '../data-access/course-allocation.repository.js';
import { internalAssessmentService } from './internal-assessment.service.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'teacher-service' });

interface RecordMarksData {
    studentUsn: string;
    courseId: number;
    batchId: number;
    sectionId: number;
    internal1?: number | null;
    internal2?: number | null;
    internal3?: number | null;
    assignmentMarks?: number | null;
}

interface MarkAttendanceEntry {
    studentUsn: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    remarks?: string;
}

class TeacherService {
    // Get teacher profile from user ID (returns null for non-teachers)
    private async getTeacherProfile(userId: number) {
        const teacher = await prisma.teacherProfile.findUnique({
            where: { userId },
            include: {
                user: {
                    select: { id: true, name: true, email: true, departmentId: true, role: true }
                }
            }
        });
        return teacher; // Can be null for admin users
    }

    // Get teacher's assigned course allocations
    async getAssignedCourses(userId: number) {
        const teacher = await this.getTeacherProfile(userId);

        // If no teacher profile (admin user), return empty array
        if (!teacher) {
            return [];
        }

        const allocations = await prisma.courseAllocation.findMany({
            where: { teacherId: teacher.id },
            include: {
                course: {
                    include: {
                        department: true
                    }
                },
                section: {
                    include: {
                        department: true,
                        batch: true,
                        _count: {
                            select: { students: true }
                        }
                    }
                }
            },
            orderBy: [
                { section: { batch: { name: 'asc' } } },
                { course: { name: 'asc' } }
            ]
        });

        return allocations;
    }


    // Verify teacher has access to allocation
    private async verifyAllocationAccess(userId: number, allocationId: number) {
        const teacher = await this.getTeacherProfile(userId);

        if (!teacher) {
            throw new Error('Teacher profile not found. Only teachers can perform this action.');
        }

        const allocation = await prisma.courseAllocation.findUnique({
            where: { id: allocationId },
            include: {
                course: true,
                section: {
                    include: {
                        department: true,
                        batch: true
                    }
                }
            }
        });

        if (!allocation) {
            throw new Error('Course allocation not found');
        }

        if (allocation.teacherId !== teacher.id) {
            throw new Error('You do not have access to this course allocation');
        }

        return { teacher, allocation };
    }

    // Verify teacher has access to section/course
    private async verifySectionCourseAccess(userId: number, sectionId: number, courseId: number) {
        const teacher = await this.getTeacherProfile(userId);

        if (!teacher) {
            throw new Error('Teacher profile not found. Only teachers can perform this action.');
        }

        // Get the section info first
        const section = await prisma.section.findUnique({
            where: { id: sectionId },
            include: { batch: true }
        });

        if (!section) {
            throw new Error('Section not found');
        }

        // Find allocation with matching semester
        const allocation = await prisma.courseAllocation.findFirst({
            where: {
                sectionId,
                courseId,
                teacherId: teacher.id
            },
            include: {
                course: true,
                section: {
                    include: {
                        department: true,
                        batch: true
                    }
                }
            }
        });

        if (!allocation) {
            throw new Error('You do not have access to this section/course');
        }

        return { teacher, allocation };
    }

    // Get students for a specific allocation
    async getStudentsForAllocation(userId: number, allocationId: number) {
        const { allocation } = await this.verifyAllocationAccess(userId, allocationId);

        const students = await prisma.studentProfile.findMany({
            where: { sectionId: allocation.sectionId },
            include: {
                user: {
                    select: { id: true, name: true, email: true }
                }
            },
            orderBy: { rollNumber: 'asc' }
        });

        return students.map(s => ({
            studentProfileId: s.id,
            userId: s.user.id,
            name: s.user.name,
            email: s.user.email,
            usn: s.rollNumber,
            batchId: allocation.section.batchId,
            sectionId: allocation.sectionId
        }));
    }

    // Get internal marks for section/course
    async getInternalMarks(userId: number, sectionId: number, courseId: number) {
        await this.verifySectionCourseAccess(userId, sectionId, courseId);

        const marks = await prisma.internalMarksDetail.findMany({
            where: { sectionId, courseId },
            include: {
                course: true,
                section: {
                    include: { batch: true }
                }
            },
            orderBy: { studentUsn: 'asc' }
        });

        return marks;
    }

    // Record internal marks for a single student
    async recordMarks(
        userId: number,
        data: RecordMarksData,
        semesterNumber: number
    ) {
        const { teacher, allocation } = await this.verifySectionCourseAccess(
            userId,
            data.sectionId,
            data.courseId
        );

        // Check if marks are already finalized
        const existingMarks = await prisma.internalMarksDetail.findFirst({
            where: {
                studentUsn: data.studentUsn,
                courseId: data.courseId,
                batchId: data.batchId
            }
        });

        if (existingMarks?.isFinalized) {
            throw new Error('Cannot edit marks that have been submitted. Contact Department Admin for corrections.');
        }

        // Check if semester is locked (batch has progressed past this semester)
        await validateNotLocked(data.batchId, semesterNumber, 'record marks');

        // Get IA config
        let config = await internalAssessmentRepository.findConfig(data.courseId, semesterNumber);
        if (!config) {
            // Use defaults matching InternalAssessmentConfig schema
            config = {
                id: 0,
                courseId: data.courseId,
                semesterNumber,
                numInternals: 3,
                maxMarksPerInternal: 30,
                internalsToConsider: 2,
                internalWeightage: 30,
                hasAssignment: true,
                numAssignments: 1,
                maxAssignmentMarks: 20,
                assignmentWeightage: 10,
                hasLab: false,
                numLabExams: 0,
                maxLabMarks: 0,
                labWeightage: 0,
                totalMarks: 50,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }

        // Calculate total using best-of-two logic
        const calculatedTotal = internalAssessmentService.calculateFinalInternal(
            data.internal1 ?? null,
            data.internal2 ?? null,
            data.internal3 ?? null,
            data.assignmentMarks ?? null,
            config
        );

        const marks = await prisma.internalMarksDetail.upsert({
            where: {
                studentUsn_courseId_batchId: {
                    studentUsn: data.studentUsn,
                    courseId: data.courseId,
                    batchId: data.batchId
                }
            },
            create: {
                studentUsn: data.studentUsn,
                courseId: data.courseId,
                batchId: data.batchId,
                sectionId: data.sectionId,
                internal1: data.internal1,
                internal2: data.internal2,
                internal3: data.internal3,
                assignmentMarks: data.assignmentMarks,
                calculatedTotal,
                updatedBy: userId
            },
            update: {
                internal1: data.internal1,
                internal2: data.internal2,
                internal3: data.internal3,
                assignmentMarks: data.assignmentMarks,
                calculatedTotal,
                updatedBy: userId
            }
        });

        // Audit log
        await auditLogRepository.create({
            actorId: userId,
            action: 'TEACHER_RECORD_MARKS',
            entityType: 'InternalMarksDetail',
            entityId: marks.id,
            newValue: {
                role: 'TEACHER',
                teacherId: teacher.id,
                departmentId: allocation.section.departmentId,
                batchId: data.batchId,
                sectionId: data.sectionId,
                courseId: data.courseId,
                usn: data.studentUsn,
                marks: {
                    internal1: data.internal1,
                    internal2: data.internal2,
                    internal3: data.internal3,
                    assignmentMarks: data.assignmentMarks,
                    calculatedTotal
                }
            } as unknown as Prisma.JsonValue
        });

        return marks;
    }

    // Bulk record marks for a section/course (optimized — batched transaction)
    async bulkRecordMarks(
        userId: number,
        entries: RecordMarksData[],
        semesterNumber: number
    ) {
        if (entries.length === 0) {
            return { created: 0, updated: 0 };
        }

        // Verify access for the first entry (all should be same section/course)
        const first = entries[0];
        const { teacher, allocation } = await this.verifySectionCourseAccess(
            userId,
            first.sectionId,
            first.courseId
        );

        // Validate semester lock ONCE (all entries share the same batch/semester)
        await validateNotLocked(first.batchId, semesterNumber, 'record marks');

        // Get IA config ONCE
        let config = await internalAssessmentRepository.findConfig(first.courseId, semesterNumber);
        if (!config) {
            config = {
                id: 0,
                courseId: first.courseId,
                semesterNumber,
                numInternals: 3,
                maxMarksPerInternal: 30,
                internalsToConsider: 2,
                internalWeightage: 30,
                hasAssignment: true,
                numAssignments: 1,
                maxAssignmentMarks: 20,
                assignmentWeightage: 10,
                hasLab: false,
                numLabExams: 0,
                maxLabMarks: 0,
                labWeightage: 0,
                totalMarks: 50,
                createdAt: new Date(),
                updatedAt: new Date()
            };
        }

        // Pre-fetch ALL existing marks for this section/course in ONE query
        const allUsns = entries.map(e => e.studentUsn);
        const existingMarksRows = await prisma.internalMarksDetail.findMany({
            where: {
                studentUsn: { in: allUsns },
                courseId: first.courseId,
                batchId: first.batchId
            },
            select: { studentUsn: true, isFinalized: true }
        });
        const existingMap = new Map(existingMarksRows.map(m => [m.studentUsn, m]));

        // Filter out finalized entries and prepare upserts
        const upsertOps: Prisma.PrismaPromise<unknown>[] = [];
        let created = 0;
        let updated = 0;
        let skipped = 0;

        for (const entry of entries) {
            const existing = existingMap.get(entry.studentUsn);
            if (existing?.isFinalized) {
                skipped++;
                continue;
            }

            const calculatedTotal = internalAssessmentService.calculateFinalInternal(
                entry.internal1 ?? null,
                entry.internal2 ?? null,
                entry.internal3 ?? null,
                entry.assignmentMarks ?? null,
                config
            );

            upsertOps.push(
                prisma.internalMarksDetail.upsert({
                    where: {
                        studentUsn_courseId_batchId: {
                            studentUsn: entry.studentUsn,
                            courseId: entry.courseId,
                            batchId: entry.batchId
                        }
                    },
                    create: {
                        studentUsn: entry.studentUsn,
                        courseId: entry.courseId,
                        batchId: entry.batchId,
                        sectionId: entry.sectionId,
                        internal1: entry.internal1,
                        internal2: entry.internal2,
                        internal3: entry.internal3,
                        assignmentMarks: entry.assignmentMarks,
                        calculatedTotal,
                        updatedBy: userId
                    },
                    update: {
                        internal1: entry.internal1,
                        internal2: entry.internal2,
                        internal3: entry.internal3,
                        assignmentMarks: entry.assignmentMarks,
                        calculatedTotal,
                        updatedBy: userId
                    }
                })
            );

            if (existing) {
                updated++;
            } else {
                created++;
            }
        }

        // Execute ALL upserts in a single transaction (one DB round-trip)
        if (upsertOps.length > 0) {
            await prisma.$transaction(upsertOps);
        }

        // Audit log
        await auditLogRepository.create({
            actorId: userId,
            action: 'TEACHER_BULK_RECORD_MARKS',
            entityType: 'InternalMarksDetail',
            entityId: first.courseId,
            newValue: {
                role: 'TEACHER',
                teacherId: teacher.id,
                departmentId: allocation.section.departmentId,
                batchId: first.batchId,
                sectionId: first.sectionId,
                courseId: first.courseId,
                count: entries.length,
                created,
                updated,
                skipped
            } as unknown as Prisma.JsonValue
        });

        return { created, updated, skipped };
    }

    // Submit/finalize marks for a section/course (locks editing)
    async submitMarks(userId: number, sectionId: number, courseId: number) {
        const { teacher, allocation } = await this.verifySectionCourseAccess(
            userId,
            sectionId,
            courseId
        );

        // Finalize all marks for this section/course
        const result = await prisma.internalMarksDetail.updateMany({
            where: {
                sectionId,
                courseId,
                isFinalized: false
            },
            data: {
                isFinalized: true,
                mentorApprovalStatus: MentorApprovalStatus.SUBMITTED_BY_TEACHER,
                updatedBy: userId
            }
        });

        // Audit log
        await auditLogRepository.create({
            actorId: userId,
            action: 'TEACHER_SUBMIT_MARKS',
            entityType: 'InternalMarksDetail',
            entityId: courseId,
            newValue: {
                role: 'TEACHER',
                teacherId: teacher.id,
                departmentId: allocation.section.departmentId,
                batchId: allocation.section.batchId,
                sectionId,
                courseId,
                submissionStatus: 'SUBMITTED',
                count: result.count
            } as unknown as Prisma.JsonValue
        });

        return { submitted: result.count };
    }

    // Get timetable for a section
    async getSectionTimetable(userId: number, sectionId: number) {
        const teacher = await this.getTeacherProfile(userId);

        if (!teacher) {
            throw new Error('Teacher profile not found. Only teachers can perform this action.');
        }

        // Verify teacher has at least one allocation in this section
        const allocation = await prisma.courseAllocation.findFirst({
            where: {
                sectionId,
                teacherId: teacher.id
            }
        });

        if (!allocation) {
            throw new Error('You do not have access to this section');
        }


        const timetable = await prisma.sectionTimetable.findFirst({
            where: {
                sectionId,
                isActive: true
            },
            include: {
                section: {
                    include: {
                        department: true,
                        batch: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return timetable;
    }

    // =====================================
    // ATTENDANCE METHODS
    // =====================================

    // Get or create subject for attendance tracking
    private async getOrCreateSubject(courseId: number, semesterId: number, sectionName: string) {
        let subject = await prisma.subject.findFirst({
            where: {
                courseId,
                semesterId,
                section: sectionName
            }
        });

        if (!subject) {
            subject = await prisma.subject.create({
                data: {
                    courseId,
                    semesterId,
                    section: sectionName
                }
            });
        }

        return subject;
    }

    // Get enrolled students for attendance (mapped from section students)
    async getStudentsForAttendance(
        userId: number,
        sectionId: number,
        courseId: number,
        date: Date
    ) {
        const { allocation } = await this.verifySectionCourseAccess(userId, sectionId, courseId);

        // Get students in section
        const students = await prisma.studentProfile.findMany({
            where: { sectionId },
            include: {
                user: {
                    select: { id: true, name: true, email: true }
                }
            },
            orderBy: { rollNumber: 'asc' }
        });

        // Get existing attendance for this date
        // First, find subject
        const semester = await prisma.semester.findFirst({
            where: { status: 'ACTIVE' }
        });

        if (!semester) {
            return students.map(s => ({
                studentId: s.id,
                name: s.user.name,
                usn: s.rollNumber,
                attendance: null
            }));
        }

        const subject = await prisma.subject.findFirst({
            where: {
                courseId,
                semesterId: semester.id,
                section: allocation.section.name
            }
        });

        if (!subject) {
            return students.map(s => ({
                studentId: s.id,
                name: s.user.name,
                usn: s.rollNumber,
                attendance: null
            }));
        }

        const existingAttendance = await prisma.attendance.findMany({
            where: {
                subjectId: subject.id,
                date: new Date(date.toISOString().split('T')[0])
            }
        });

        const attendanceMap = new Map(existingAttendance.map(a => [a.studentId, a]));

        return students.map(s => ({
            studentId: s.id,
            name: s.user.name,
            usn: s.rollNumber,
            attendance: attendanceMap.get(s.id) || null
        }));
    }

    // Mark attendance for a section/course/date (optimized — batched transaction)
    async markAttendance(
        userId: number,
        sectionId: number,
        courseId: number,
        date: Date,
        entries: MarkAttendanceEntry[]
    ) {
        const { teacher, allocation } = await this.verifySectionCourseAccess(userId, sectionId, courseId);

        // Get or create subject
        const semester = await prisma.semester.findFirst({
            where: { status: 'ACTIVE' }
        });

        if (!semester) {
            throw new Error('No active semester found');
        }

        const subject = await this.getOrCreateSubject(
            courseId,
            semester.id,
            allocation.section.name
        );

        const normalizedDate = new Date(date.toISOString().split('T')[0]);

        // Check if already locked
        const existingLocked = await prisma.attendance.findFirst({
            where: {
                subjectId: subject.id,
                date: normalizedDate,
                isLocked: true
            }
        });

        if (existingLocked) {
            throw new Error('Attendance for this date is already submitted. Contact Department Admin for corrections.');
        }

        // Pre-fetch ALL student profiles by USN in ONE query (eliminates N+1)
        const allUsns = entries.map(e => e.studentUsn);
        const studentProfiles = await prisma.studentProfile.findMany({
            where: { rollNumber: { in: allUsns } },
            select: { id: true, rollNumber: true }
        });
        const studentMap = new Map(studentProfiles.map(s => [s.rollNumber, s.id]));

        // Pre-fetch existing attendance for this subject+date in ONE query
        const existingAttendance = await prisma.attendance.findMany({
            where: {
                subjectId: subject.id,
                date: normalizedDate,
                studentId: { in: studentProfiles.map(s => s.id) }
            },
            select: { studentId: true }
        });
        const existingStudentIds = new Set(existingAttendance.map(a => a.studentId));

        // Build all upsert operations
        const upsertOps: Prisma.PrismaPromise<unknown>[] = [];
        let created = 0;
        let updated = 0;
        let notFound = 0;

        for (const entry of entries) {
            const studentId = studentMap.get(entry.studentUsn);
            if (!studentId) {
                log.warn({ usn: entry.studentUsn }, 'Student not found for USN — skipping attendance entry');
                notFound++;
                continue;
            }

            upsertOps.push(
                prisma.attendance.upsert({
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
                })
            );

            if (existingStudentIds.has(studentId)) {
                updated++;
            } else {
                created++;
            }
        }

        // Execute ALL upserts in a single transaction
        if (upsertOps.length > 0) {
            await prisma.$transaction(upsertOps);
        }

        // Audit log
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
                sectionId,
                courseId,
                date: normalizedDate,
                count: entries.length,
                created,
                updated,
                notFound
            } as unknown as Prisma.JsonValue
        });

        return { created, updated };
    }

    // Submit/lock attendance for a date (teacher declares class was conducted)
    async submitAttendance(
        userId: number,
        sectionId: number,
        courseId: number,
        date: Date
    ) {
        const { teacher, allocation } = await this.verifySectionCourseAccess(userId, sectionId, courseId);

        const semester = await prisma.semester.findFirst({
            where: { status: 'ACTIVE' }
        });

        if (!semester) {
            throw new Error('No active semester found');
        }

        const subject = await prisma.subject.findFirst({
            where: {
                courseId,
                semesterId: semester.id,
                section: allocation.section.name
            }
        });

        if (!subject) {
            throw new Error('No attendance records found for this course/section');
        }

        const normalizedDate = new Date(date.toISOString().split('T')[0]);

        // Lock all attendance for this date
        const result = await prisma.attendance.updateMany({
            where: {
                subjectId: subject.id,
                date: normalizedDate,
                isLocked: false
            },
            data: {
                isLocked: true
            }
        });

        // Audit log
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
                sectionId,
                courseId,
                date: normalizedDate,
                submissionStatus: 'SUBMITTED',
                count: result.count
            } as unknown as Prisma.JsonValue
        });

        return { submitted: result.count };
    }

    // Get attendance records for a section/course
    async getAttendanceRecords(
        userId: number,
        sectionId: number,
        courseId: number,
        startDate?: Date,
        endDate?: Date
    ) {
        const { allocation } = await this.verifySectionCourseAccess(userId, sectionId, courseId);

        const semester = await prisma.semester.findFirst({
            where: { status: 'ACTIVE' }
        });

        if (!semester) {
            return [];
        }

        const subject = await prisma.subject.findFirst({
            where: {
                courseId,
                semesterId: semester.id,
                section: allocation.section.name
            }
        });

        if (!subject) {
            return [];
        }

        const where: Prisma.AttendanceWhereInput = { subjectId: subject.id };

        if (startDate && endDate) {
            where.date = {
                gte: new Date(startDate.toISOString().split('T')[0]),
                lte: new Date(endDate.toISOString().split('T')[0])
            };
        }

        const attendance = await prisma.attendance.findMany({
            where,
            include: {
                student: {
                    include: {
                        user: {
                            select: { name: true }
                        }
                    }
                }
            },
            orderBy: [
                { date: 'desc' },
                { student: { rollNumber: 'asc' } }
            ]
        });

        return attendance;
    }

    // =====================================================
    // ASSESSMENT CONFIG METHODS
    // =====================================================

    // Get assessment config for a course/semester
    async getAssessmentConfig(courseId: number, semesterNumber: number) {
        let config = await prisma.internalAssessmentConfig.findUnique({
            where: {
                courseId_semesterNumber: { courseId, semesterNumber }
            }
        });

        // Return default config if not found
        if (!config) {
            return {
                courseId,
                semesterNumber,
                numInternals: 3,
                maxMarksPerInternal: 30,
                internalsToConsider: 2,
                internalWeightage: 30,
                hasAssignment: true,
                numAssignments: 1,
                maxAssignmentMarks: 20,
                assignmentWeightage: 10,
                hasLab: false,
                numLabExams: 0,
                maxLabMarks: 0,
                labWeightage: 0,
                totalMarks: 50,
            };
        }

        return config;
    }

    // Create or update assessment config (Dept Admin only)
    async upsertAssessmentConfig(
        courseId: number,
        semesterNumber: number,
        data: {
            numInternals?: number;
            maxMarksPerInternal?: number;
            internalsToConsider?: number;
            internalWeightage?: number;
            hasAssignment?: boolean;
            numAssignments?: number;
            maxAssignmentMarks?: number;
            assignmentWeightage?: number;
            hasLab?: boolean;
            numLabExams?: number;
            maxLabMarks?: number;
            labWeightage?: number;
        }
    ) {
        // Validate total weightage = 50
        const internalW = data.internalWeightage ?? 30;
        const assignmentW = data.hasAssignment !== false ? (data.assignmentWeightage ?? 10) : 0;
        const labW = data.hasLab ? (data.labWeightage ?? 0) : 0;

        if (internalW + assignmentW + labW !== 50) {
            throw new Error(`Total weightage must equal 50. Current: ${internalW + assignmentW + labW}`);
        }

        return prisma.internalAssessmentConfig.upsert({
            where: {
                courseId_semesterNumber: { courseId, semesterNumber }
            },
            create: {
                courseId,
                semesterNumber,
                numInternals: data.numInternals ?? 3,
                maxMarksPerInternal: data.maxMarksPerInternal ?? 30,
                internalsToConsider: data.internalsToConsider ?? 2,
                internalWeightage: internalW,
                hasAssignment: data.hasAssignment ?? true,
                numAssignments: data.numAssignments ?? 1,
                maxAssignmentMarks: data.maxAssignmentMarks ?? 20,
                assignmentWeightage: assignmentW,
                hasLab: data.hasLab ?? false,
                numLabExams: data.numLabExams ?? 0,
                maxLabMarks: data.maxLabMarks ?? 0,
                labWeightage: labW,
                totalMarks: 50,
            },
            update: {
                numInternals: data.numInternals,
                maxMarksPerInternal: data.maxMarksPerInternal,
                internalsToConsider: data.internalsToConsider,
                internalWeightage: internalW,
                hasAssignment: data.hasAssignment,
                numAssignments: data.numAssignments,
                maxAssignmentMarks: data.maxAssignmentMarks,
                assignmentWeightage: assignmentW,
                hasLab: data.hasLab,
                numLabExams: data.numLabExams,
                maxLabMarks: data.maxLabMarks,
                labWeightage: labW,
            }
        });
    }

    // Calculate total marks using config
    calculateMarksWithConfig(
        config: {
            numInternals: number;
            maxMarksPerInternal: number;
            internalsToConsider: number;
            internalWeightage: number;
            hasAssignment: boolean;
            maxAssignmentMarks: number;
            assignmentWeightage: number;
            hasLab: boolean;
            maxLabMarks: number;
            labWeightage: number;
        },
        marks: {
            internal1?: number | null;
            internal2?: number | null;
            internal3?: number | null;
            assignmentMarks?: number | null;
            labMarks?: number | null;
        }
    ): number | null {
        // Collect available internals
        const internals: number[] = [];
        if (marks.internal1 != null) internals.push(marks.internal1);
        if (marks.internal2 != null && config.numInternals >= 2) internals.push(marks.internal2);
        if (marks.internal3 != null && config.numInternals >= 3) internals.push(marks.internal3);

        // Need at least internalsToConsider marks, or all if less internals exist
        const requiredInternals = Math.min(config.internalsToConsider, config.numInternals);
        if (internals.length < requiredInternals) return null;

        // Take best N internals
        internals.sort((a, b) => b - a);
        const bestInternals = internals.slice(0, config.internalsToConsider);
        const internalSum = bestInternals.reduce((sum, v) => sum + v, 0);
        const maxInternalSum = config.internalsToConsider * config.maxMarksPerInternal;
        const scaledInternal = (internalSum / maxInternalSum) * config.internalWeightage;

        // Assignment marks
        let scaledAssignment = 0;
        if (config.hasAssignment && marks.assignmentMarks != null) {
            scaledAssignment = (marks.assignmentMarks / config.maxAssignmentMarks) * config.assignmentWeightage;
        }

        // Lab marks
        let scaledLab = 0;
        if (config.hasLab && marks.labMarks != null) {
            scaledLab = (marks.labMarks / config.maxLabMarks) * config.labWeightage;
        }

        return Math.round((scaledInternal + scaledAssignment + scaledLab) * 100) / 100;
    }

    // =====================================================
    // EDIT REQUEST METHODS
    // =====================================================

    // Create an edit request for locked marks
    async createMarksEditRequest(
        userId: number,
        marksId: number,
        newValues: {
            internal1?: number | null;
            internal2?: number | null;
            internal3?: number | null;
            assignmentMarks?: number | null;
        },
        reason: string
    ) {
        // Get the existing marks record
        const existingMarks = await prisma.internalMarksDetail.findUnique({
            where: { id: marksId },
            include: { course: true, section: true }
        });

        if (!existingMarks) {
            throw new Error('Marks record not found');
        }

        if (!existingMarks.isFinalized) {
            throw new Error('Marks are not locked - you can edit directly');
        }

        // Create edit request
        const editRequest = await prisma.editRequest.create({
            data: {
                type: 'MARKS',
                requesterId: userId,
                subjectId: existingMarks.courseId,
                entityType: 'InternalMarksDetail',
                entityId: marksId,
                oldValue: {
                    internal1: existingMarks.internal1,
                    internal2: existingMarks.internal2,
                    internal3: existingMarks.internal3,
                    assignmentMarks: existingMarks.assignmentMarks,
                },
                newValue: newValues,
                reason,
                status: 'PENDING',
            }
        });

        return editRequest;
    }

    // Create an edit request for locked attendance
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

        if (!existingAttendance) {
            throw new Error('Attendance record not found');
        }

        if (!existingAttendance.isLocked) {
            throw new Error('Attendance is not locked - you can edit directly');
        }

        const editRequest = await prisma.editRequest.create({
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

        return editRequest;
    }

    // Get my edit requests
    async getMyEditRequests(userId: number) {
        return prisma.editRequest.findMany({
            where: { requesterId: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                reviewer: {
                    select: { name: true }
                }
            }
        });
    }

    // Get attendance history for a section/course/date range
    async getAttendanceHistory(
        sectionId: number,
        courseId: number,
        startDate?: Date,
        endDate?: Date
    ) {
        // Build where clause
        const where: Prisma.AttendanceWhereInput = {
            student: { sectionId },
            subject: { courseId }
        };

        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = startDate;
            if (endDate) where.date.lte = endDate;
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

        // Group by date
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

export const teacherService = new TeacherService();
