/**
 * Mentor Dashboard Service
 * ──────────────────────────────────────
 * Handles mentor's student-facing operations: profile views,
 * academic performance, attendance, observations, and interactions.
 *
 * Extracted from mentor.service.ts (lines 200-975)
 */
import { Prisma, MentorApprovalStatus } from '@prisma/client';
import prisma from '../../data-access/prisma.js';
import { mentorAssignmentRepository } from '../../data-access/mentor-assignment.repository.js';
import { auditLogRepository } from '../../data-access/index.js';
import {
    studentUsnWhere,
    getMentorTeacherProfile,
    verifyMentorStudentAccess,
} from './shared.js';

class MentorDashboardService {
    /**
     * Check if a user (teacher) is also a mentor
     */
    async isMentor(userId: number): Promise<boolean> {
        const teacher = await prisma.teacherProfile.findUnique({
            where: { userId }
        });
        if (!teacher) return false;
        const count = await mentorAssignmentRepository.countByTeacher(teacher.id, true);
        return count > 0;
    }

    /**
     * Get mentor profile with statistics
     */
    async getMentorProfile(userId: number) {
        const teacher = await getMentorTeacherProfile(userId);
        const studentCount = await mentorAssignmentRepository.countByTeacher(teacher.id, true);

        // Get pending approvals count
        const assignments = await mentorAssignmentRepository.findByTeacher(teacher.id, true);
        const studentUsns = assignments.map(a => a.studentProfile?.rollNumber).filter(Boolean) as string[];
        let pendingApprovals = 0;
        if (studentUsns.length > 0) {
            pendingApprovals = await prisma.internalMarksDetail.count({
                where: {
                    studentUsn: { in: studentUsns },
                    mentorApprovalStatus: MentorApprovalStatus.SUBMITTED_BY_TEACHER
                }
            });
        }

        const activeAssignments = await prisma.mentorAssignment.findMany({
            where: { teacherProfileId: teacher.id, isActive: true },
            select: {
                id: true, semester: true, academicYear: true, assignedAt: true,
            },
            distinct: ['semester', 'academicYear'],
        });

        return {
            isMentor: studentCount > 0,
            teacher: {
                id: teacher.id,
                designation: teacher.designation,
                user: { name: teacher.user.name, email: teacher.user.email },
            },
            totalStudents: studentCount,
            activeAssignments: studentCount,
            pendingApprovals,
            assignments: activeAssignments.map(a => ({
                id: a.id,
                semesterNumber: a.semester,
                academicYear: a.academicYear,
                studentCount,
                assignedAt: a.assignedAt?.toISOString() || new Date().toISOString(),
            })),
        };
    }

    /**
     * Get students assigned to mentor
     */
    async getAssignedStudents(userId: number) {
        const teacher = await getMentorTeacherProfile(userId);
        const assignments = await mentorAssignmentRepository.findByTeacher(teacher.id, true);

        // Get all student profile IDs to batch-fetch parent profiles
        const studentProfileIds = assignments
            .map((a: any) => a.studentProfile?.id)
            .filter(Boolean) as number[];

        // Batch fetch parent profiles for all assigned students
        const parentProfiles = studentProfileIds.length > 0
            ? await prisma.parentProfile.findMany({
                where: { studentProfileId: { in: studentProfileIds } },
                include: { user: { select: { id: true, name: true, email: true } } },
            })
            : [];
        const parentMap = new Map(parentProfiles.map(pp => [pp.studentProfileId, pp]));

        return assignments.map((assignment: any) => {
            const sp = assignment.studentProfile;
            const parentProfile = sp?.id ? parentMap.get(sp.id) : undefined;
            return {
                usn: sp?.permanentUsn || sp?.temporaryUsn || sp?.rollNumber || `student-${sp?.id}`,
                name: sp?.user?.name || 'Unknown',
                email: sp?.user?.email || '',
                rollNumber: sp?.rollNumber || '',
                currentSemester: sp?.currentSemester || 1,
                section: assignment.section || sp?.section || null,
                batch: assignment.batch || sp?.batch || null,
                parentInfo: parentProfile ? {
                    name: parentProfile.user?.name || '',
                    loginId: parentProfile.phoneNumber || parentProfile.user?.email || '',
                    phone: parentProfile.phoneNumber || '',
                    relationship: parentProfile.relationship || 'FATHER',
                } : null,
            };
        });
    }

    /**
     * Get detailed student profile (for mentor viewing)
     */
    async getStudentProfile(userId: number, studentUsn: string) {
        const teacher = await getMentorTeacherProfile(userId);
        await verifyMentorStudentAccess(teacher.id, studentUsn);

        const student = await prisma.studentProfile.findFirst({
            where: studentUsnWhere(studentUsn),
            include: {
                user: { select: { id: true, name: true, email: true } },
                batch: true,
                section: { include: { department: true } },
                optedDepartment: { select: { id: true, name: true, code: true } },
                cycleDepartment: { select: { id: true, name: true, code: true } },
                program: { select: { id: true, name: true } },
            }
        });

        if (!student) throw new Error('Student not found');

        // Fetch parent profile for this student
        const parentProfile = await prisma.parentProfile.findFirst({
            where: { studentProfileId: student.id },
            include: { user: { select: { id: true, name: true, email: true } } },
        });

        return {
            usn: student.permanentUsn || student.temporaryUsn || student.rollNumber,
            name: student.user?.name || 'Unknown',
            email: student.user?.email || '',
            rollNumber: student.rollNumber,
            currentSemester: student.currentSemester,
            admissionYear: student.admissionYear,
            department: student.optedDepartment || student.cycleDepartment || student.section?.department || null,
            section: student.section ? { id: student.section.id, name: student.section.name } : null,
            batch: student.batch ? { id: student.batch.id, name: student.batch.name } : null,
            program: student.program || null,
            parentInfo: parentProfile ? {
                name: parentProfile.user?.name || '',
                loginId: parentProfile.phoneNumber || parentProfile.user?.email || '',
                phone: parentProfile.phoneNumber || '',
                relationship: parentProfile.relationship || 'FATHER',
                hasDefaultPassword: true, // Default until changed
            } : null,
        };
    }

    /**
     * Get student academic performance (marks, SGPA)
     */
    async getStudentAcademicPerformance(userId: number, studentUsn: string) {
        const teacher = await getMentorTeacherProfile(userId);
        await verifyMentorStudentAccess(teacher.id, studentUsn);

        const [internalMarks, semesterMarks, results] = await Promise.all([
            prisma.internalMarksDetail.findMany({
                where: { studentUsn },
                include: { course: true, batch: true },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.semesterEndMarks.findMany({
                where: { studentUsn },
                include: { course: true },
                orderBy: { id: 'desc' }
            }),
            prisma.result.findMany({
                where: { studentUsn },
                orderBy: { id: 'desc' }
            }),
        ]);

        return { internalMarks, semesterMarks, results };
    }

    /**
     * Get student attendance summary
     */
    async getStudentAttendance(userId: number, studentUsn: string) {
        const teacher = await getMentorTeacherProfile(userId);
        await verifyMentorStudentAccess(teacher.id, studentUsn);

        const student = await prisma.studentProfile.findFirst({
            where: studentUsnWhere(studentUsn)
        });

        if (!student) throw new Error('Student not found');

        const attendance = await prisma.attendance.findMany({
            where: { studentId: student.id },
            include: {
                subject: { include: { course: true } }
            },
            orderBy: { date: 'desc' }
        });

        const subjectSummary = new Map<number, {
            course: any; total: number; present: number; absent: number; percentage: number;
        }>();

        for (const record of attendance) {
            if (!subjectSummary.has(record.subjectId)) {
                subjectSummary.set(record.subjectId, {
                    course: record.subject.course,
                    total: 0, present: 0, absent: 0, percentage: 0
                });
            }

            const summary = subjectSummary.get(record.subjectId)!;
            summary.total++;
            if (record.status === 'PRESENT' || record.status === 'LATE') {
                summary.present++;
            } else if (record.status === 'ABSENT') {
                summary.absent++;
            }
            summary.percentage = (summary.present / summary.total) * 100;
        }

        return {
            records: attendance,
            summary: Array.from(subjectSummary.values())
        };
    }

    // ── Observations (Digital Mentor Card) ──────────────────────

    /**
     * Record or update semester observation for a student
     */
    async recordObservation(
        userId: number,
        studentUsn: string,
        data: {
            personalityCommunication?: string;
            curricularResponse?: string;
            coCurricularResponse?: string;
            extraCurricularResponse?: string;
            overallAssessment: 'SATISFACTORY' | 'MODERATE' | 'NEEDS_IMPROVEMENT';
            mentorRemarks?: string;
        }
    ) {
        const teacher = await getMentorTeacherProfile(userId);

        const assignment = await prisma.mentorAssignment.findFirst({
            where: {
                teacherProfileId: teacher.id,
                studentProfile: studentUsnWhere(studentUsn),
                isActive: true
            },
            include: { studentProfile: true }
        });

        if (!assignment) throw new Error('No active mentor assignment found for this student');

        const observation = await prisma.mentorObservation.upsert({
            where: {
                mentorAssignmentId_academicYear_semester: {
                    mentorAssignmentId: assignment.id,
                    academicYear: assignment.academicYear,
                    semester: assignment.semester
                }
            },
            create: {
                mentorAssignmentId: assignment.id,
                academicYear: assignment.academicYear,
                semester: assignment.semester,
                ...data
            },
            update: data
        });

        await auditLogRepository.create({
            actorId: userId,
            action: 'MENTOR_RECORD_OBSERVATION',
            entityType: 'MentorObservation',
            entityId: observation.id,
            newValue: {
                studentUsn,
                academicYear: assignment.academicYear,
                semester: assignment.semester,
                overallAssessment: data.overallAssessment
            } as unknown as Prisma.JsonValue
        });

        return observation;
    }

    /**
     * Get observations for a student
     */
    async getObservations(userId: number, studentUsn: string) {
        const teacher = await getMentorTeacherProfile(userId);
        await verifyMentorStudentAccess(teacher.id, studentUsn);

        return prisma.mentorObservation.findMany({
            where: {
                mentorAssignment: {
                    studentProfile: studentUsnWhere(studentUsn)
                }
            },
            orderBy: [
                { academicYear: 'desc' },
                { semester: 'desc' }
            ]
        });
    }

    // ── Interactions (Student & Parent) ─────────────────────────

    /**
     * Log student interaction/meeting
     */
    async logStudentInteraction(
        userId: number,
        studentUsn: string,
        data: {
            personalAspects?: string;
            academicAspects?: string;
            careerAspects?: string;
            otherAspects?: string;
            interactionDate: Date;
        }
    ) {
        const teacher = await getMentorTeacherProfile(userId);

        const assignment = await prisma.mentorAssignment.findFirst({
            where: {
                teacherProfileId: teacher.id,
                studentProfile: studentUsnWhere(studentUsn),
                isActive: true
            }
        });

        if (!assignment) throw new Error('No active mentor assignment found for this student');

        const lastInteraction = await prisma.mentorStudentInteraction.findFirst({
            where: { mentorAssignmentId: assignment.id },
            orderBy: { meetingNumber: 'desc' }
        });
        const meetingNumber = (lastInteraction?.meetingNumber || 0) + 1;

        const interaction = await prisma.mentorStudentInteraction.create({
            data: {
                mentorAssignmentId: assignment.id,
                meetingNumber,
                ...data
            }
        });

        await auditLogRepository.create({
            actorId: userId,
            action: 'MENTOR_LOG_STUDENT_INTERACTION',
            entityType: 'MentorStudentInteraction',
            entityId: interaction.id,
            newValue: { studentUsn, meetingNumber } as unknown as Prisma.JsonValue
        });

        return interaction;
    }

    /**
     * Log parent interaction
     */
    async logParentInteraction(
        userId: number,
        studentUsn: string,
        data: {
            interactionDate: Date;
            mode: 'CALL' | 'MEETING';
            purpose: 'ATTENDANCE' | 'IA_MARKS' | 'BEHAVIOR' | 'OTHER';
            summary: string;
        }
    ) {
        const teacher = await getMentorTeacherProfile(userId);

        const assignment = await prisma.mentorAssignment.findFirst({
            where: {
                teacherProfileId: teacher.id,
                studentProfile: studentUsnWhere(studentUsn),
                isActive: true
            }
        });

        if (!assignment) throw new Error('No active mentor assignment found for this student');

        const interaction = await prisma.mentorParentInteraction.create({
            data: {
                mentorAssignmentId: assignment.id,
                ...data,
                mentorSignature: true
            }
        });

        await auditLogRepository.create({
            actorId: userId,
            action: 'MENTOR_LOG_PARENT_INTERACTION',
            entityType: 'MentorParentInteraction',
            entityId: interaction.id,
            newValue: { studentUsn, mode: data.mode, purpose: data.purpose } as unknown as Prisma.JsonValue
        });

        return interaction;
    }

    /**
     * Get all interactions for a student (both student and parent)
     */
    async getInteractions(userId: number, studentUsn: string) {
        const teacher = await getMentorTeacherProfile(userId);
        await verifyMentorStudentAccess(teacher.id, studentUsn);

        const [studentInteractions, parentInteractions] = await Promise.all([
            prisma.mentorStudentInteraction.findMany({
                where: {
                    mentorAssignment: {
                        studentProfile: studentUsnWhere(studentUsn)
                    }
                },
                orderBy: { interactionDate: 'desc' }
            }),
            prisma.mentorParentInteraction.findMany({
                where: {
                    mentorAssignment: {
                        studentProfile: studentUsnWhere(studentUsn)
                    }
                },
                orderBy: { interactionDate: 'desc' }
            }),
        ]);

        return { studentInteractions, parentInteractions };
    }

    /**
     * Change the password for a student's parent account.
     * Only the assigned mentor can do this.
     */
    async changeParentPassword(userId: number, studentUsn: string, newPassword: string) {
        const teacher = await getMentorTeacherProfile(userId);
        await verifyMentorStudentAccess(teacher.id, studentUsn);

        // Find the student
        const student = await prisma.studentProfile.findFirst({
            where: studentUsnWhere(studentUsn),
            select: { id: true },
        });
        if (!student) throw new Error('Student not found');

        // Find the parent profile
        const parentProfile = await prisma.parentProfile.findFirst({
            where: { studentProfileId: student.id },
            include: { user: { select: { id: true, name: true } } },
        });
        if (!parentProfile) throw new Error('No parent account linked to this student');

        // Hash and update password
        const { authService } = await import('../auth.service.js');
        const passwordHash = await authService.hashPassword(newPassword);
        await prisma.user.update({
            where: { id: parentProfile.userId },
            data: { passwordHash },
        });

        return { success: true, parentName: parentProfile.user?.name || 'Parent' };
    }
}

export const mentorDashboardService = new MentorDashboardService();
