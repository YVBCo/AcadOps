import { Prisma } from '@prisma/client';
import { prisma } from '../data-access/prisma.js';
import { authService } from './auth.service.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'parent' });

// ============================================
// PARENT SERVICE
// Handles parent account creation and dashboard
// ============================================

class ParentService {
    /**
     * Create a parent account linked to a student.
     * Password = parent phone number.
     * Email = real parent email from admission form (preferred), or generated fallback.
     */
    async createParentAccount(opts: {
        studentProfileId: number;
        studentAdmissionId: string;
        tenantId: number;
        parentName: string;
        parentPhone: string;
        parentEmail?: string; // Real email from admission form (father/mother email)
        relationship: string; // FATHER | MOTHER | GUARDIAN
        tenantSlug: string;
        preHashedPassword?: string; // Pre-computed hash to avoid redundant Argon2 calls in loops
    }): Promise<{ userId: number; email: string } | null> {
        const { studentProfileId, studentAdmissionId, tenantId, parentName, parentPhone, relationship, tenantSlug } = opts;

        if (!parentPhone || parentPhone.trim().length < 5) {
            log.warn({ studentProfileId }, 'Skipping parent account creation — no valid phone number');
            return null;
        }

        const cleanPhone = parentPhone.replace(/[\s\-\(\)]/g, '');

        // Use real parent email when available; fall back to generated placeholder
        const realEmail = opts.parentEmail?.trim();
        const parentEmail = cleanPhone; // Phone number IS the login ID

        // Check if parent account already exists for this student
        const existingParent = await prisma.parentProfile.findFirst({
            where: { studentProfileId },
        });
        if (existingParent) {
            log.info({ studentProfileId }, 'Parent account already exists for student');
            return null;
        }

        // Check if email already exists in this tenant (case-insensitive)
        const existingUser = await prisma.user.findFirst({
            where: {
                email: { equals: parentEmail, mode: 'insensitive' },
                tenantId,
                NOT: { email: { startsWith: 'deleted_' } },
            },
        });
        if (existingUser) {
            return null;
        }

        // Use pre-hashed password if provided (avoids ~200ms Argon2 call per parent in batch loops)
        const passwordHash = opts.preHashedPassword || await authService.hashPassword('Parent@123');

        // Get student's department
        const studentProfile = await prisma.studentProfile.findUnique({
            where: { id: studentProfileId },
            select: { optedDepartmentId: true, cycleDepartmentId: true },
        });

        const deptId = studentProfile?.optedDepartmentId || studentProfile?.cycleDepartmentId || null;

        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: parentEmail,
                    passwordHash,
                    name: parentName,
                    role: 'PARENT',
                    departmentId: deptId,
                    isActive: true,
                    tenantId,
                },
            });

            await tx.parentProfile.create({
                data: {
                    userId: user.id,
                    studentProfileId,
                    relationship,
                    phoneNumber: cleanPhone,
                },
            });

            return { userId: user.id, email: parentEmail };
        });

        log.info({ parentEmail, studentProfileId, relationship }, 'Parent account created');

        return result;
    }

    /**
     * Get parent dashboard data: student list with overview info.
     * Returns shape: { parentName, students: StudentInfo[] }
     */
    async getDashboard(userId: number) {
        const parentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });

        // userId is @unique on ParentProfile — one parent links to one student
        const parentProfile = await prisma.parentProfile.findUnique({
            where: { userId },
            include: {
                studentProfile: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                        batch: { select: { id: true, name: true } },
                        section: { select: { id: true, name: true } },
                        optedDepartment: { select: { id: true, name: true, code: true } },
                        cycleDepartment: { select: { id: true, name: true, code: true } },
                    },
                },
            },
        });

        const parentProfiles = parentProfile ? [parentProfile] : [];

        const students = await Promise.all(
            parentProfiles.map(async (pp) => {
                const sp = pp.studentProfile;
                const dept = sp.optedDepartment || sp.cycleDepartment;

                // Check if mentor is assigned
                const mentorAssignment = await prisma.mentorAssignment.findFirst({
                    where: { studentProfileId: sp.id, isActive: true },
                    include: { teacherProfile: { include: { user: { select: { name: true } } } } },
                });

                return {
                    id: sp.id,
                    name: sp.user.name,
                    usn: sp.permanentUsn || sp.temporaryUsn || sp.rollNumber || sp.admissionId || '',
                    department: dept?.name || 'Unassigned',
                    semester: sp.currentSemester,
                    batch: sp.batch?.name || '',
                    section: sp.section?.name || '',
                    program: '', // Not stored on student profile directly
                    mentorName: mentorAssignment?.teacherProfile?.user?.name || null,
                };
            }),
        );

        // Get unread chat count
        const unreadCount = await prisma.chatMessage.count({
            where: {
                conversation: { parentUserId: userId },
                senderUserId: { not: userId },
                isRead: false,
            },
        });

        return {
            parentName: parentUser?.name || 'Parent',
            students,
            unreadMessages: unreadCount,
        };
    }

    /**
     * Get linked student profile by studentProfileId (validates parent owns this student).
     */
    async getStudentProfile(userId: number, studentProfileId: number) {
        const parentProfile = await prisma.parentProfile.findFirst({
            where: { userId, studentProfileId },
            include: {
                studentProfile: {
                    include: {
                        user: { select: { name: true, email: true } },
                        batch: { select: { name: true } },
                        section: { select: { name: true } },
                        optedDepartment: { select: { name: true, code: true } },
                    },
                },
            },
        });

        if (!parentProfile) throw new Error('Student not linked to your account');
        return parentProfile.studentProfile;
    }

    /**
     * Get attendance data for a specific linked student.
     * Returns shape matching frontend: { studentId, studentName, usn, summary: AttendanceSummary[] }
     */
    async getStudentAttendance(userId: number, studentProfileId: number) {
        // Validate parent owns this student
        const parentProfile = await prisma.parentProfile.findFirst({
            where: { userId, studentProfileId },
            include: {
                studentProfile: {
                    include: {
                        user: { select: { name: true } },
                    },
                },
            },
        });
        if (!parentProfile) throw new Error('Student not linked to your account');

        const sp = parentProfile.studentProfile;
        const usn = sp.permanentUsn || sp.temporaryUsn || sp.rollNumber || '';

        // Get attendance records
        const attendances = await prisma.attendance.findMany({
            where: { studentId: sp.id },
            include: { subject: { include: { course: { select: { name: true, code: true } } } } },
        });

        // Aggregate by subject/course
        const summaryMap: Record<string, { courseCode: string; courseName: string; present: number; absent: number; total: number; percentage: number }> = {};
        for (const a of attendances) {
            const key = String(a.subjectId);
            if (!summaryMap[key]) {
                summaryMap[key] = {
                    courseCode: a.subject.course?.code || '',
                    courseName: a.subject.course?.name || 'Unknown',
                    present: 0,
                    absent: 0,
                    total: 0,
                    percentage: 0,
                };
            }
            summaryMap[key].total++;
            if (a.status === 'PRESENT' || a.status === 'LATE') {
                summaryMap[key].present++;
            } else {
                summaryMap[key].absent++;
            }
            summaryMap[key].percentage = Math.round(
                (summaryMap[key].present / summaryMap[key].total) * 100,
            );
        }

        // Build individual records for date-wise view
        const records = attendances
            .map(a => ({
                id: a.id,
                date: a.date.toISOString(),
                status: a.status,
                remarks: a.remarks,
                courseCode: a.subject.course?.code || '',
                courseName: a.subject.course?.name || 'Unknown',
            }))
            .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());

        return {
            studentId: sp.id,
            studentName: sp.user.name,
            usn,
            summary: Object.values(summaryMap),
            records,
        };
    }

    /**
     * Get marks for a specific linked student.
     * Returns shape matching frontend: { studentId, studentName, usn, marks: MarkEntry[] }
     */
    async getStudentMarksById(userId: number, studentProfileId: number) {
        // Validate parent owns this student
        const parentProfile = await prisma.parentProfile.findFirst({
            where: { userId, studentProfileId },
            include: {
                studentProfile: {
                    include: {
                        user: { select: { name: true } },
                    },
                },
            },
        });
        if (!parentProfile) throw new Error('Student not linked to your account');

        const sp = parentProfile.studentProfile;
        const usn = sp.permanentUsn || sp.temporaryUsn || sp.rollNumber || '';

        const internalMarks = await prisma.internalMarksDetail.findMany({
            where: { studentUsn: usn },
            include: { course: { select: { name: true, code: true } } },
            orderBy: { createdAt: 'desc' },
        });

        const marks = internalMarks.map((m) => {
            const maxMarks = 50; // Standard IA max (best 2 of 3 IAs × 30 max → scaled, + assignment 20)
            const total = m.calculatedTotal ?? 0;
            return {
                courseCode: m.course?.code || '',
                courseName: m.course?.name || 'Unknown',
                calculatedTotal: total,
                maxMarks,
                isFinalized: m.isFinalized,
                percentage: maxMarks > 0 ? Math.round((total / maxMarks) * 100) : 0,
            };
        });

        return {
            studentId: sp.id,
            studentName: sp.user.name,
            usn,
            marks,
        };
    }

    /**
     * Get linked student's marks (legacy — used by /parent/student/marks route)
     */
    async getStudentMarks(userId: number) {
        const parentProfile = await prisma.parentProfile.findUnique({
            where: { userId },
            select: { studentProfile: { select: { id: true, rollNumber: true, permanentUsn: true, temporaryUsn: true } } },
        });

        if (!parentProfile) throw new Error('Parent profile not found');

        const sp = parentProfile.studentProfile;
        const studentUsn = sp.permanentUsn || sp.temporaryUsn || sp.rollNumber;

        const internalMarks = await prisma.internalMarksDetail.findMany({
            where: { studentUsn },
            include: { course: { select: { name: true, code: true } } },
            orderBy: { createdAt: 'desc' },
        });

        const semesterMarks = await prisma.semesterEndMarks.findMany({
            where: { studentUsn },
            include: { course: { select: { name: true, code: true } } },
            orderBy: { id: 'desc' },
        });

        return { internalMarks, semesterMarks };
    }

    /**
     * Get linked student profile (legacy)
     */
    async getLinkedStudent(userId: number) {
        const parentProfile = await prisma.parentProfile.findUnique({
            where: { userId },
            include: {
                studentProfile: {
                    include: {
                        user: { select: { name: true, email: true } },
                        batch: { select: { name: true } },
                        section: { select: { name: true } },
                        optedDepartment: { select: { name: true, code: true } },
                    },
                },
            },
        });

        if (!parentProfile) throw new Error('Parent profile not found');
        return parentProfile.studentProfile;
    }
}

export const parentService = new ParentService();
