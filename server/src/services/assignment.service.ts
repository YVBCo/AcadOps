import { Assignment, Submission, Prisma } from '@prisma/client';
import { assignmentRepository, CreateAssignmentData, UpdateAssignmentData, CreateSubmissionData } from '../data-access/assignment.repository.js';
import { subjectRepository } from '../data-access/subject.repository.js';
import { semesterRepository } from '../data-access/semester.repository.js';
import { auditLogRepository } from '../data-access/audit-log.repository.js';
import { prisma } from '../data-access/prisma.js';

export const assignmentService = {
    /**
     * Check if a user can manage assignments for a given subject.
     * Admins always can; teachers only if they're assigned to the subject.
     */
    async canManageSubjectAssignments(userId: number, subjectId: number, role: string): Promise<boolean> {
        if (role === 'SUPER_ADMIN' || role === 'DEPARTMENT_ADMIN') {
            return true;
        }

        if (role === 'TEACHER') {
            const teacherProfile = await prisma.teacherProfile.findUnique({
                where: { userId },
            });
            if (!teacherProfile) return false;

            const assignment = await prisma.subjectTeacher.findUnique({
                where: {
                    subjectId_teacherId: {
                        subjectId,
                        teacherId: teacherProfile.id,
                    },
                },
            });
            return !!assignment;
        }

        return false;
    },

    /**
     * Resolve a userId to a student profile ID.
     */
    async getStudentProfileByUserId(userId: number) {
        return prisma.studentProfile.findUnique({
            where: { userId },
        });
    },

    // Create assignment (Teachers or Admins only)
    async createAssignment(data: CreateAssignmentData, actorId: number): Promise<Assignment> {
        // Verify subject exists
        const subject = await subjectRepository.findById(data.subjectId);
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(subject.semesterId);
        if (!isActive) {
            throw new Error('Cannot create assignments in a closed semester');
        }

        const assignment = await assignmentRepository.createAssignment(data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'CREATE_ASSIGNMENT',
            entityType: 'Assignment',
            entityId: assignment.id,
            newValue: { title: data.title, subjectId: data.subjectId, dueDate: data.dueDate } as unknown as Prisma.JsonValue,
        });

        return assignment;
    },

    // Update assignment
    async updateAssignment(id: number, data: UpdateAssignmentData, actorId: number): Promise<Assignment> {
        const existing = await assignmentRepository.findAssignmentById(id);
        if (!existing) {
            throw new Error('Assignment not found');
        }

        // Get subject to check semester
        const subject = await subjectRepository.findById(existing.subjectId);
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(subject.semesterId);
        if (!isActive) {
            throw new Error('Cannot modify assignments in a closed semester');
        }

        const assignment = await assignmentRepository.updateAssignment(id, data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'UPDATE_ASSIGNMENT',
            entityType: 'Assignment',
            entityId: id,
            oldValue: { title: existing.title, dueDate: existing.dueDate } as unknown as Prisma.JsonValue,
            newValue: data as unknown as Prisma.JsonValue,
        });

        return assignment;
    },

    // Delete assignment
    async deleteAssignment(id: number, actorId: number): Promise<void> {
        const existing = await assignmentRepository.findAssignmentById(id);
        if (!existing) {
            throw new Error('Assignment not found');
        }

        // Get subject to check semester
        const subject = await subjectRepository.findById(existing.subjectId);
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(subject.semesterId);
        if (!isActive) {
            throw new Error('Cannot delete assignments in a closed semester');
        }

        await assignmentRepository.deleteAssignment(id);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'DELETE_ASSIGNMENT',
            entityType: 'Assignment',
            entityId: id,
            oldValue: { title: existing.title, subjectId: existing.subjectId } as unknown as Prisma.JsonValue,
        });
    },

    // Get assignments by subject
    async getAssignmentsBySubject(subjectId: number): Promise<Assignment[]> {
        return assignmentRepository.findBySubject(subjectId);
    },

    // Get assignment by ID
    async getAssignmentById(id: number): Promise<Assignment | null> {
        return assignmentRepository.findAssignmentById(id);
    },

    // Submit assignment (Students only)
    // LATE SUBMISSIONS ARE FLAGGED, NOT BLOCKED
    async submitAssignment(
        assignmentId: number,
        studentProfileId: number,
        data: { fileUrl?: string; content?: string },
        actorId: number
    ): Promise<Submission> {
        const assignment = await assignmentRepository.findAssignmentById(assignmentId);
        if (!assignment) {
            throw new Error('Assignment not found');
        }

        // Check if student is enrolled in the subject
        const enrollment = await prisma.enrollment.findUnique({
            where: {
                studentId_subjectId: {
                    studentId: studentProfileId,
                    subjectId: assignment.subjectId,
                },
            },
        });
        if (!enrollment) {
            throw new Error('You are not enrolled in this subject');
        }

        // Check if already submitted
        const existing = await assignmentRepository.findSubmissionByAssignmentAndStudent(
            assignmentId,
            studentProfileId
        );
        if (existing) {
            throw new Error('You have already submitted this assignment');
        }

        // Check if late - FLAG but do NOT block
        const now = new Date();
        const isLate = now > assignment.dueDate;

        const submission = await assignmentRepository.createSubmission(
            {
                assignmentId,
                studentId: studentProfileId,
                ...data,
            },
            isLate
        );

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'SUBMIT_ASSIGNMENT',
            entityType: 'Submission',
            entityId: submission.id,
            newValue: { assignmentId, isLate } as Prisma.JsonValue,
        });

        return submission;
    },

    // Update submission (resubmit)
    async updateSubmission(
        submissionId: number,
        data: { fileUrl?: string; content?: string },
        actorId: number
    ): Promise<Submission> {
        const submission = await assignmentRepository.findSubmissionById(submissionId);
        if (!submission) {
            throw new Error('Submission not found');
        }

        // Check if graded - cannot update if graded
        if (submission.score !== null) {
            throw new Error('Cannot update a graded submission');
        }

        const updated = await assignmentRepository.updateSubmission(submissionId, data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'UPDATE_SUBMISSION',
            entityType: 'Submission',
            entityId: submissionId,
            oldValue: { fileUrl: submission.fileUrl } as Prisma.JsonValue,
        });

        return updated;
    },

    // Grade submission (Teachers only)
    async gradeSubmission(
        submissionId: number,
        score: number,
        feedback: string | undefined,
        actorId: number
    ): Promise<Submission> {
        const submission = await assignmentRepository.findSubmissionById(submissionId);
        if (!submission) {
            throw new Error('Submission not found');
        }

        const assignment = await assignmentRepository.findAssignmentById(submission.assignmentId);
        if (!assignment) {
            throw new Error('Assignment not found');
        }

        // Validate score
        if (score < 0 || score > assignment.maxScore) {
            throw new Error(`Score must be between 0 and ${assignment.maxScore}`);
        }

        const graded = await assignmentRepository.gradeSubmission(submissionId, score, feedback);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'GRADE_SUBMISSION',
            entityType: 'Submission',
            entityId: submissionId,
            newValue: { score, feedback } as Prisma.JsonValue,
        });

        return graded;
    },

    // Get submissions for an assignment
    async getSubmissionsByAssignment(assignmentId: number): Promise<Submission[]> {
        return assignmentRepository.findSubmissionsByAssignment(assignmentId);
    },

    // Get student's submissions
    async getStudentSubmissions(studentProfileId: number): Promise<Submission[]> {
        return assignmentRepository.findSubmissionsByStudent(studentProfileId);
    },

    // Get assignment stats
    async getAssignmentStats(assignmentId: number) {
        return assignmentRepository.getAssignmentStats(assignmentId);
    },
};
