/**
 * Mentor — Shared utilities
 * Extracted from mentor.service.ts
 */
import prisma from '../../data-access/prisma.js';
import { mentorAssignmentRepository } from '../../data-access/mentor-assignment.repository.js';

/**
 * Helper: Build an OR query to find a student by any USN field
 */
export function studentUsnWhere(usn: string) {
    return {
        OR: [
            { rollNumber: usn },
            { permanentUsn: usn },
            { temporaryUsn: usn },
        ],
    };
}

/**
 * Get teacher profile for mentor operations
 */
export async function getMentorTeacherProfile(userId: number) {
    const teacher = await prisma.teacherProfile.findUnique({
        where: { userId },
        include: { user: true }
    });

    if (!teacher) {
        throw new Error('Teacher profile not found');
    }

    return teacher;
}

/**
 * Verify mentor has access to a student by USN
 */
export async function verifyMentorStudentAccess(teacherProfileId: number, studentUsn: string) {
    const hasAccess = await mentorAssignmentRepository.canAccessStudent(teacherProfileId, studentUsn);
    if (!hasAccess) {
        throw new Error('You do not have access to this student');
    }
}
