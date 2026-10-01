/**
 * COE Service
 * ──────────────────────────────────────
 * Handles COE-specific queries: students with temp USNs,
 * internal marks submissions review.
 *
 * Extracted from coe.routes.ts to enforce the repository pattern.
 */
import { prisma } from '../data-access/prisma.js';

class CoeService {
    /**
     * Get students with temporary USNs awaiting permanent USN assignment.
     * Tenant-scoped via user.tenantId join.
     */
    async getStudentsWithTempUsn(tenantId: number) {
        return prisma.studentProfile.findMany({
            where: {
                temporaryUsn: { not: null },
                permanentUsn: null,
                user: { tenantId },
            },
            include: {
                user: {
                    select: {
                        id: true, name: true, email: true, departmentId: true,
                        department: { select: { id: true, name: true, code: true } },
                    },
                },
                batch: { select: { id: true, name: true } },
            },
            orderBy: [{ temporaryUsn: 'asc' }],
        });
    }

    /**
     * Get internal marks submissions for COE review.
     * Tenant-scoped via department.tenantId relation filter.
     */
    async getInternalMarksSubmissions(
        tenantId: number,
        filters: {
            departmentId?: number;
            batchId?: number;
            courseId?: number;
        } = {}
    ) {
        const where: Record<string, unknown> = {};
        if (filters.departmentId) where.departmentId = filters.departmentId;
        if (filters.batchId) where.batchId = filters.batchId;
        if (filters.courseId) where.courseId = filters.courseId;
        // Tenant isolation: scope by tenant via department relation
        where.department = { tenantId };

        const submissions = await prisma.internalMarksSubmission.findMany({
            where,
            include: {
                department: { select: { id: true, name: true, code: true } },
                batch: { select: { id: true, name: true, currentSemester: true } },
                course: { select: { id: true, name: true, code: true } },
                submitter: { select: { id: true, name: true } },
            },
            orderBy: [
                { departmentId: 'asc' },
                { batchId: 'asc' },
                { courseId: 'asc' },
                { studentUsn: 'asc' },
            ],
        });

        return submissions.map(s => ({
            id: s.id,
            studentUsn: s.studentUsn,
            marks: s.marks,
            submittedAt: s.submittedAt,
            department: s.department,
            batch: s.batch,
            course: s.course,
            teacher: { name: s.submitter.name },
        }));
    }
}

export const coeService = new CoeService();
