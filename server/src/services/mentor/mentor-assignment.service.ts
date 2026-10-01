/**
 * Mentor Assignment Service
 * ──────────────────────────────────────
 * Handles mentor assignment/expiration (Dept Admin operations)
 * and marks approval workflow.
 *
 * Extracted from mentor.service.ts (lines 23-200, 469-713)
 */
import { Prisma, MentorApprovalStatus } from '@prisma/client';
import prisma from '../../data-access/prisma.js';
import { mentorAssignmentRepository } from '../../data-access/mentor-assignment.repository.js';
import { auditLogRepository } from '../../data-access/index.js';
import { validateNotLocked } from '../../utils/semester-lock.js';
import { getMentorTeacherProfile } from './shared.js';

class MentorAssignmentService {
    /**
     * Assign a teacher as mentor to multiple students (Dept Admin)
     */
    async assignMentor(
        teacherProfileId: number,
        studentProfileIds: number[],
        departmentId: number,
        batchId: number,
        sectionId: number,
        academicYear: string,
        semester: number,
        actorId: number
    ): Promise<{ assigned: number; skipped: number }> {
        const teacher = await prisma.teacherProfile.findUnique({
            where: { id: teacherProfileId },
            include: { user: true }
        });

        if (!teacher) throw new Error('Teacher not found');
        if (teacher.user.departmentId !== departmentId) {
            throw new Error('Mentor must belong to the same department as students');
        }

        const assignments = studentProfileIds.map(studentProfileId => ({
            teacherProfileId,
            studentProfileId,
            departmentId,
            batchId,
            sectionId,
            academicYear,
            semester,
            assignedBy: actorId
        }));

        const result = await mentorAssignmentRepository.createMany(assignments);

        await auditLogRepository.create({
            actorId,
            action: 'DEPT_ADMIN_ASSIGN_MENTOR',
            entityType: 'MentorAssignment',
            entityId: teacherProfileId,
            newValue: {
                role: 'DEPARTMENT_ADMIN',
                teacherProfileId, departmentId, batchId, sectionId,
                academicYear, semester,
                studentCount: studentProfileIds.length,
                assignedCount: result.count
            } as unknown as Prisma.JsonValue
        });

        return {
            assigned: result.count,
            skipped: studentProfileIds.length - result.count
        };
    }

    /**
     * Get current mentor assignments for a department
     */
    async getMentorAssignments(departmentId: number, batchId?: number, sectionId?: number) {
        const assignments = await mentorAssignmentRepository.findByDepartment(
            departmentId, batchId, sectionId, true
        );

        const grouped = new Map<number, { teacher: any; students: any[] }>();

        for (const assignment of assignments) {
            if (!grouped.has(assignment.teacherProfileId)) {
                grouped.set(assignment.teacherProfileId, {
                    teacher: assignment.teacherProfile,
                    students: []
                });
            }
            grouped.get(assignment.teacherProfileId)!.students.push({
                ...assignment.studentProfile,
                section: assignment.section,
                batch: assignment.batch,
                assignedAt: assignment.assignedAt,
                assignmentId: assignment.id
            });
        }

        return Array.from(grouped.values());
    }

    /**
     * Get mentor assignment history
     */
    async getMentorAssignmentHistory(departmentId: number, batchId?: number) {
        return mentorAssignmentRepository.getHistory(departmentId, batchId);
    }

    /**
     * Manually expire a mentor assignment
     */
    async expireMentorAssignment(assignmentId: number, actorId: number) {
        const assignment = await mentorAssignmentRepository.findById(assignmentId);
        if (!assignment) throw new Error('Mentor assignment not found');

        const result = await mentorAssignmentRepository.expire(assignmentId);

        await auditLogRepository.create({
            actorId,
            action: 'DEPT_ADMIN_EXPIRE_MENTOR_ASSIGNMENT',
            entityType: 'MentorAssignment',
            entityId: assignmentId,
            oldValue: { isActive: true } as unknown as Prisma.JsonValue,
            newValue: { isActive: false, expiredAt: result.expiredAt } as unknown as Prisma.JsonValue
        });

        return result;
    }

    /**
     * Bulk expire all assignments for a semester
     */
    async expireForSemester(
        departmentId: number,
        academicYear: string,
        semester: number,
        actorId: number
    ) {
        const result = await mentorAssignmentRepository.expireForSemester(
            departmentId, academicYear, semester
        );

        await auditLogRepository.create({
            actorId,
            action: 'DEPT_ADMIN_EXPIRE_SEMESTER_ASSIGNMENTS',
            entityType: 'MentorAssignment',
            entityId: departmentId,
            newValue: {
                departmentId, academicYear, semester,
                expiredCount: result.count
            } as unknown as Prisma.JsonValue
        });

        return result;
    }

    // ── Marks Approval ──────────────────────────────────────────

    /**
     * Get marks pending mentor approval
     */
    async getPendingApprovals(userId: number) {
        const teacher = await getMentorTeacherProfile(userId);
        const assignments = await mentorAssignmentRepository.findByTeacher(teacher.id, true);
        const studentUsns = assignments.map(a => a.studentProfile?.rollNumber).filter(Boolean) as string[];

        if (studentUsns.length === 0) return [];

        return prisma.internalMarksDetail.findMany({
            where: {
                studentUsn: { in: studentUsns },
                mentorApprovalStatus: MentorApprovalStatus.SUBMITTED_BY_TEACHER
            },
            include: { course: true, batch: true, section: true },
            orderBy: [
                { course: { name: 'asc' } },
                { studentUsn: 'asc' }
            ]
        });
    }

    /**
     * Approve internal marks (bulk)
     */
    async approveMarks(userId: number, marksIds: number[]) {
        const teacher = await getMentorTeacherProfile(userId);

        const marks = await prisma.internalMarksDetail.findMany({
            where: { id: { in: marksIds } }
        });

        for (const mark of marks) {
            const hasAccess = await mentorAssignmentRepository.canAccessStudent(teacher.id, mark.studentUsn);
            if (!hasAccess) throw new Error(`You do not have access to student ${mark.studentUsn}`);
            if (mark.mentorApprovalStatus !== MentorApprovalStatus.SUBMITTED_BY_TEACHER) {
                throw new Error(`Marks for ${mark.studentUsn} are not in a state that can be approved`);
            }
        }

        const result = await prisma.internalMarksDetail.updateMany({
            where: { id: { in: marksIds } },
            data: {
                mentorApprovalStatus: MentorApprovalStatus.APPROVED_BY_MENTOR,
                mentorApprovedBy: teacher.id,
                mentorApprovedAt: new Date()
            }
        });

        await auditLogRepository.create({
            actorId: userId,
            action: 'MENTOR_APPROVE_MARKS',
            entityType: 'InternalMarksDetail',
            entityId: marksIds[0],
            newValue: {
                role: 'TEACHER', teacherProfileId: teacher.id,
                marksIds, approvedCount: result.count
            } as unknown as Prisma.JsonValue
        });

        return { approved: result.count };
    }

    /**
     * Reject internal marks with reason
     */
    async rejectMarks(userId: number, marksId: number, reason: string) {
        if (!reason || reason.trim().length < 10) {
            throw new Error('Rejection reason is required (minimum 10 characters)');
        }

        const teacher = await getMentorTeacherProfile(userId);

        const mark = await prisma.internalMarksDetail.findUnique({ where: { id: marksId } });
        if (!mark) throw new Error('Marks not found');

        const hasAccess = await mentorAssignmentRepository.canAccessStudent(teacher.id, mark.studentUsn);
        if (!hasAccess) throw new Error('You do not have access to this student');

        if (mark.mentorApprovalStatus !== MentorApprovalStatus.SUBMITTED_BY_TEACHER) {
            throw new Error('Marks are not in a state that can be rejected');
        }

        const result = await prisma.internalMarksDetail.update({
            where: { id: marksId },
            data: {
                mentorApprovalStatus: MentorApprovalStatus.REJECTED_BY_MENTOR,
                mentorRejectionReason: reason,
                isFinalized: false
            }
        });

        await auditLogRepository.create({
            actorId: userId,
            action: 'MENTOR_REJECT_MARKS',
            entityType: 'InternalMarksDetail',
            entityId: marksId,
            newValue: {
                role: 'TEACHER', teacherProfileId: teacher.id,
                marksId, reason
            } as unknown as Prisma.JsonValue
        });

        return result;
    }

    /**
     * Update marks as mentor (creates pending approval request)
     */
    async updateMarksAsMentor(
        userId: number,
        marksId: number,
        updates: {
            internal1?: number | null;
            internal2?: number | null;
            internal3?: number | null;
            assignmentMarks?: number | null;
        }
    ) {
        const teacher = await getMentorTeacherProfile(userId);

        const mark = await prisma.internalMarksDetail.findUnique({ where: { id: marksId } });
        if (!mark) throw new Error('Marks not found');

        const hasAccess = await mentorAssignmentRepository.canAccessStudent(teacher.id, mark.studentUsn);
        if (!hasAccess) throw new Error('You do not have access to this student');

        const batch = await prisma.batch.findUnique({ where: { id: mark.batchId } });
        if (batch) {
            await validateNotLocked(mark.batchId, batch.currentSemester, 'update marks as mentor');
        }

        const result = await prisma.internalMarksDetail.update({
            where: { id: marksId },
            data: {
                ...updates,
                mentorApprovalStatus: MentorApprovalStatus.MENTOR_EDIT_PENDING_APPROVAL,
                mentorApprovedBy: teacher.id,
                updatedBy: userId
            }
        });

        await auditLogRepository.create({
            actorId: userId,
            action: 'MENTOR_UPDATE_MARKS',
            entityType: 'InternalMarksDetail',
            entityId: marksId,
            oldValue: {
                internal1: mark.internal1, internal2: mark.internal2,
                internal3: mark.internal3, assignmentMarks: mark.assignmentMarks
            } as unknown as Prisma.JsonValue,
            newValue: {
                ...updates,
                mentorApprovalStatus: MentorApprovalStatus.MENTOR_EDIT_PENDING_APPROVAL
            } as unknown as Prisma.JsonValue
        });

        return result;
    }

    /**
     * Get mentor tracking summary for a department (Dept Admin view).
     */
    async getMentorTrackingSummary(departmentId: number, batchId?: number, sectionId?: number) {
        const where: any = { departmentId, isActive: true };
        if (batchId) where.batchId = batchId;
        if (sectionId) where.sectionId = sectionId;

        const assignments = await prisma.mentorAssignment.findMany({
            where,
            include: {
                teacherProfile: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
                studentProfile: {
                    include: {
                        user: { select: { name: true } },
                    },
                },
                section: { select: { id: true, name: true } },
                batch: { select: { id: true, name: true } },
                studentInteractions: {
                    select: { id: true, meetingNumber: true, interactionDate: true },
                    orderBy: { interactionDate: 'desc' },
                },
                parentInteractions: {
                    select: { id: true, interactionDate: true, purpose: true },
                    orderBy: { interactionDate: 'desc' },
                },
            },
            orderBy: [
                { teacherProfile: { user: { name: 'asc' } } },
                { studentProfile: { rollNumber: 'asc' } },
            ],
        });

        const mentorMap = new Map<number, any>();

        for (const a of assignments) {
            const teacherId = a.teacherProfileId;
            if (!mentorMap.has(teacherId)) {
                mentorMap.set(teacherId, {
                    teacherProfileId: teacherId,
                    teacherName: a.teacherProfile.user.name,
                    teacherEmail: a.teacherProfile.user.email,
                    totalStudents: 0,
                    studentsWithMeetings: 0,
                    totalMeetingsLogged: 0,
                    totalParentInteractions: 0,
                    lastActivity: null as string | null,
                    students: [] as any[],
                });
            }

            const mentor = mentorMap.get(teacherId)!;
            mentor.totalStudents++;

            const meetingCount = a.studentInteractions.length;
            const parentCount = a.parentInteractions.length;

            if (meetingCount > 0) mentor.studentsWithMeetings++;
            mentor.totalMeetingsLogged += meetingCount;
            mentor.totalParentInteractions += parentCount;

            const latestStudentDate = a.studentInteractions[0]?.interactionDate;
            const latestParentDate = a.parentInteractions[0]?.interactionDate;
            const latestDate = latestStudentDate && latestParentDate
                ? (latestStudentDate > latestParentDate ? latestStudentDate : latestParentDate)
                : latestStudentDate || latestParentDate;

            if (latestDate) {
                const dateStr = latestDate.toISOString();
                if (!mentor.lastActivity || dateStr > mentor.lastActivity) {
                    mentor.lastActivity = dateStr;
                }
            }

            mentor.students.push({
                usn: a.studentProfile.permanentUsn || a.studentProfile.temporaryUsn || a.studentProfile.rollNumber,
                name: a.studentProfile.user?.name || 'Unknown',
                section: a.section?.name || '',
                batch: a.batch?.name || '',
                meetingsLogged: meetingCount,
                parentInteractions: parentCount,
                lastMeeting: a.studentInteractions[0]?.interactionDate?.toISOString() || null,
            });
        }

        return Array.from(mentorMap.values());
    }
}

export const mentorAssignmentService = new MentorAssignmentService();
