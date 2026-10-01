import { Subject, Prisma } from '@prisma/client';
import { subjectRepository, semesterRepository, auditLogRepository, CreateSubjectData, UpdateSubjectData } from '../data-access/index.js';
import { prisma } from '../data-access/prisma.js';

class SubjectService {
    // Create subject (only when semester is ACTIVE)
    async create(data: CreateSubjectData, actorId: number): Promise<Subject> {
        // CRITICAL: Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(data.semesterId);
        if (!isActive) {
            throw new Error('Cannot create subjects in a non-active semester');
        }

        // Check for duplicate
        const existing = await subjectRepository.findUnique(data.courseId, data.semesterId, data.section);
        if (existing) {
            throw new Error('Subject with this course, semester, and section already exists');
        }

        const subject = await subjectRepository.create(data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'CREATE_SUBJECT',
            entityType: 'Subject',
            entityId: subject.id,
            newValue: data as unknown as Prisma.JsonValue,
        });

        return subject;
    }

    // Update subject (only when semester is ACTIVE)
    async update(id: number, data: UpdateSubjectData, actorId: number): Promise<Subject> {
        const existing = await subjectRepository.findById(id);
        if (!existing) {
            throw new Error('Subject not found');
        }

        // CRITICAL: Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(existing.semesterId);
        if (!isActive) {
            throw new Error('Cannot modify subjects in a closed semester');
        }

        const subject = await subjectRepository.update(id, data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'UPDATE_SUBJECT',
            entityType: 'Subject',
            entityId: id,
            oldValue: { section: existing.section } as Prisma.JsonValue,
            newValue: data as unknown as Prisma.JsonValue,
        });

        return subject;
    }

    // Delete subject (only when semester is ACTIVE)
    async delete(id: number, actorId: number): Promise<void> {
        const existing = await subjectRepository.findById(id);
        if (!existing) {
            throw new Error('Subject not found');
        }

        // CRITICAL: Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(existing.semesterId);
        if (!isActive) {
            throw new Error('Cannot delete subjects in a closed semester');
        }

        await subjectRepository.delete(id);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'DELETE_SUBJECT',
            entityType: 'Subject',
            entityId: id,
            oldValue: { courseId: existing.courseId, section: existing.section } as Prisma.JsonValue,
        });
    }

    // Assign teacher to subject
    async assignTeacher(subjectId: number, teacherId: number, isPrimary: boolean, actorId: number): Promise<void> {
        const subject = await subjectRepository.findById(subjectId);
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(subject.semesterId);
        if (!isActive) {
            throw new Error('Cannot modify teacher assignments in a closed semester');
        }

        await subjectRepository.assignTeacher(subjectId, teacherId, isPrimary);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'ASSIGN_TEACHER',
            entityType: 'Subject',
            entityId: subjectId,
            newValue: { teacherId, isPrimary } as Prisma.JsonValue,
        });
    }

    // Remove teacher from subject
    async removeTeacher(subjectId: number, teacherId: number, actorId: number): Promise<void> {
        const subject = await subjectRepository.findById(subjectId);
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(subject.semesterId);
        if (!isActive) {
            throw new Error('Cannot modify teacher assignments in a closed semester');
        }

        await subjectRepository.removeTeacher(subjectId, teacherId);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'REMOVE_TEACHER',
            entityType: 'Subject',
            entityId: subjectId,
            oldValue: { teacherId } as Prisma.JsonValue,
        });
    }

    // Enroll student
    async enrollStudent(subjectId: number, studentId: number, actorId: number): Promise<void> {
        const subject = await subjectRepository.findById(subjectId);
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(subject.semesterId);
        if (!isActive) {
            throw new Error('Cannot enroll students in a closed semester');
        }

        await subjectRepository.enrollStudent(subjectId, studentId);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'ENROLL_STUDENT',
            entityType: 'Subject',
            entityId: subjectId,
            newValue: { studentId } as Prisma.JsonValue,
        });
    }

    // Unenroll student from subject
    async unenrollStudent(subjectId: number, studentId: number, actorId: number): Promise<void> {
        const subject = await subjectRepository.findById(subjectId);
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(subject.semesterId);
        if (!isActive) {
            throw new Error('Cannot unenroll students from a closed semester');
        }

        await subjectRepository.unenrollStudent(subjectId, studentId);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'UNENROLL_STUDENT',
            entityType: 'Subject',
            entityId: subjectId,
            newValue: { studentId } as Prisma.JsonValue,
        });
    }

    // Get subject by ID
    async getById(id: number): Promise<Subject | null> {
        return subjectRepository.findById(id);
    }

    // Get subjects by semester
    async getBySemester(semesterId: number): Promise<Subject[]> {
        return subjectRepository.findBySemester(semesterId);
    }

    // Get subjects by department and semester
    async getByDepartmentAndSemester(departmentId: number, semesterId: number): Promise<Subject[]> {
        return subjectRepository.findByDepartmentAndSemester(departmentId, semesterId);
    }

    // Get subjects by teacher
    async getByTeacher(teacherProfileId: number): Promise<Subject[]> {
        return subjectRepository.findByTeacher(teacherProfileId);
    }

    // Get subjects by student
    async getByStudent(studentProfileId: number): Promise<Subject[]> {
        return subjectRepository.findByStudent(studentProfileId);
    }

    /**
     * Get the profile ID for a user based on their role.
     * Returns teacher profile ID or student profile ID.
     */
    async getUserProfileId(userId: number, role: 'TEACHER' | 'STUDENT'): Promise<number | null> {


        if (role === 'TEACHER') {
            const profile = await prisma.teacherProfile.findUnique({ where: { userId } });
            return profile?.id ?? null;
        }
        if (role === 'STUDENT') {
            const profile = await prisma.studentProfile.findUnique({ where: { userId } });
            return profile?.id ?? null;
        }
        return null;
    }

    /**
     * Get enrolled students for a subject (formatted)
     */
    async getEnrolledStudents(subjectId: number) {


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

        return enrollments.map(e => ({
            id: e.student.id,
            userId: e.student.userId,
            name: e.student.user.name,
            email: e.student.user.email,
            rollNumber: e.student.rollNumber,
            enrolledAt: e.enrolledAt,
        }));
    }

    /**
     * Get assigned teachers for a subject (formatted)
     */
    async getAssignedTeachers(subjectId: number) {


        const assignments = await prisma.subjectTeacher.findMany({
            where: { subjectId },
            include: {
                teacher: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });

        return assignments.map(a => ({
            id: a.teacher.id,
            userId: a.teacher.userId,
            name: a.teacher.user.name,
            email: a.teacher.user.email,
            employeeId: a.teacher.employeeId,
            designation: a.teacher.designation,
            isPrimary: a.isPrimary,
            assignedAt: a.assignedAt,
        }));
    }

    /**
     * Get a student's complete academic history across all semesters
     */
    async getStudentHistory(userId: number) {


        const studentProfile = await prisma.studentProfile.findUnique({
            where: { userId },
            include: { program: true },
        });

        if (!studentProfile) {
            throw new Error('Student profile not found');
        }

        const enrollments = await prisma.enrollment.findMany({
            where: { studentId: studentProfile.id },
            include: {
                subject: {
                    include: {
                        course: { select: { id: true, name: true, code: true, credits: true } },
                        semester: { select: { id: true, name: true, status: true, startDate: true, endDate: true } },
                        teachers: {
                            include: { teacher: { include: { user: { select: { name: true } } } } },
                            where: { isPrimary: true },
                        },
                    },
                },
            },
            orderBy: { subject: { semester: { startDate: 'desc' } } },
        });

        const [attendanceData, marksData] = await Promise.all([
            prisma.attendance.findMany({ where: { studentId: studentProfile.id } }),
            prisma.marks.findMany({ where: { studentId: studentProfile.id } }),
        ]);

        // Group by semester
        const semesterMap = new Map<number, {
            id: number; name: string; status: string;
            startDate: Date; endDate: Date;
            subjects: Array<{
                id: number; section: string | null;
                course: { id: number; name: string; code: string; credits: number };
                teacher: string | null;
                attendance: { present: number; absent: number; late: number; excused: number; percentage: number };
                marks: Array<{ examType: string; score: number; maxScore: number; percentage: number }>;
            }>;
        }>();

        for (const enrollment of enrollments) {
            const semester = enrollment.subject.semester;
            if (!semesterMap.has(semester.id)) {
                semesterMap.set(semester.id, {
                    id: semester.id, name: semester.name, status: semester.status,
                    startDate: semester.startDate, endDate: semester.endDate, subjects: [],
                });
            }

            const subjectAttendance = attendanceData.filter(a => a.subjectId === enrollment.subjectId);
            const present = subjectAttendance.filter(a => a.status === 'PRESENT').length;
            const absent = subjectAttendance.filter(a => a.status === 'ABSENT').length;
            const late = subjectAttendance.filter(a => a.status === 'LATE').length;
            const excused = subjectAttendance.filter(a => a.status === 'EXCUSED').length;
            const total = subjectAttendance.length;

            const subjectMarks = marksData
                .filter(m => m.subjectId === enrollment.subjectId)
                .map(m => ({ examType: m.examType, score: m.score, maxScore: m.maxScore, percentage: (m.score / m.maxScore) * 100 }));

            semesterMap.get(semester.id)!.subjects.push({
                id: enrollment.subject.id, section: enrollment.subject.section,
                course: enrollment.subject.course,
                teacher: enrollment.subject.teachers[0]?.teacher.user.name || null,
                attendance: { present, absent, late, excused, percentage: total > 0 ? ((present + late) / total) * 100 : 0 },
                marks: subjectMarks,
            });
        }

        const currentYear = new Date().getFullYear();
        const yearOfStudy = Math.min(4, currentYear - studentProfile.admissionYear + 1);
        const semesters = Array.from(semesterMap.values()).sort((a, b) =>
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );
        const totalCredits = enrollments.reduce((acc, e) => acc + e.subject.course.credits, 0);

        return {
            student: {
                id: studentProfile.id, rollNumber: studentProfile.rollNumber,
                admissionYear: studentProfile.admissionYear, yearOfStudy,
                programDuration: studentProfile.program?.durationYears ?? 4,
            },
            program: studentProfile.program ? {
                id: studentProfile.program.id, name: studentProfile.program.name, code: studentProfile.program.code,
            } : null,
            semesters,
            summary: {
                totalSemesters: semesters.length, totalSubjects: enrollments.length,
                totalCredits, totalAttendanceRecords: attendanceData.length, totalMarksRecords: marksData.length,
            },
        };
    }
}

export const subjectService = new SubjectService();

