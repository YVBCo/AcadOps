/**
 * Clerk Marks Service
 * ──────────────────────────────────────
 * Handles all clerk-specific data operations:
 * - Department/batch lookups
 * - Course listing for marks entry
 * - Student retrieval with internal marks status
 * - Semester-end marks submission
 * - Revaluation marks submission
 * - Clerk submission statistics
 */
import { prisma } from '../data-access/prisma.js';
import { auditLogRepository } from '../data-access/index.js';

interface SemesterMarksEntry {
    studentUsn: string;
    marks: number;
    examType?: 'REGULAR' | 'MAKEUP' | 'REWRITE';
}

class ClerkMarksService {
    /**
     * Get departments and batches available for the clerk's tenant
     */
    async getAssignments(tenantId: number) {
        const [departments, batches] = await Promise.all([
            prisma.department.findMany({
                where: { tenantId },
                select: { id: true, name: true, code: true },
                orderBy: { name: 'asc' },
            }),
            prisma.batch.findMany({
                where: { tenantId },
                select: { id: true, name: true, startYear: true, currentSemester: true },
                orderBy: { startYear: 'desc' },
            }),
        ]);

        return { departments, batches };
    }

    /**
     * Get courses for a specific department
     */
    async getCourses(departmentId: number) {
        return prisma.course.findMany({
            where: { departmentId },
            select: {
                id: true,
                name: true,
                code: true,
                credits: true,
                semesterNumber: true,
                internalMarks: true,
                externalMarks: true,
            },
            orderBy: { code: 'asc' },
        });
    }

    /**
     * Get students with their internal marks and existing semester marks
     */
    async getStudentsForMarksEntry(departmentId: number, batchId: number, courseId: number) {
        const [studentsWithInternalMarks, existingSemesterMarks] = await Promise.all([
            prisma.internalMarksSubmission.findMany({
                where: { departmentId, batchId, courseId },
                select: { studentUsn: true, marks: true },
            }),
            prisma.semesterEndMarks.findMany({
                where: { departmentId, batchId, courseId },
                select: { studentUsn: true, marks: true, status: true },
            }),
        ]);

        const semesterMarksMap = new Map(
            existingSemesterMarks.map(m => [m.studentUsn, m])
        );

        return studentsWithInternalMarks.map(im => ({
            usn: im.studentUsn,
            internalMarks: im.marks,
            semesterMarks: semesterMarksMap.get(im.studentUsn)?.marks || null,
            semesterMarksStatus: semesterMarksMap.get(im.studentUsn)?.status || null,
        }));
    }

    /**
     * Submit semester-end marks (with validation)
     */
    async submitSemesterMarks(
        departmentId: number,
        batchId: number,
        courseId: number,
        entries: SemesterMarksEntry[],
        clerkId: number
    ) {
        // Validate: Course belongs to department
        const course = await prisma.course.findFirst({
            where: { id: courseId, departmentId },
        });
        if (!course) {
            throw new Error('Course does not belong to the specified department');
        }

        // Validate: All student USNs have internal marks
        const internalMarks = await prisma.internalMarksSubmission.findMany({
            where: {
                departmentId,
                batchId,
                courseId,
                studentUsn: { in: entries.map(e => e.studentUsn) },
            },
        });

        const usnsWithInternalMarks = new Set(internalMarks.map(im => im.studentUsn));
        const missingInternalMarks = entries.filter(e => !usnsWithInternalMarks.has(e.studentUsn));

        if (missingInternalMarks.length > 0) {
            throw Object.assign(
                new Error('Internal marks not submitted for some students'),
                { students: missingInternalMarks.map(e => e.studentUsn), statusCode: 400 }
            );
        }

        // Create or update semester marks (status = PENDING)
        const results = await Promise.all(
            entries.map(entry =>
                prisma.semesterEndMarks.upsert({
                    where: {
                        departmentId_batchId_courseId_studentUsn: {
                            departmentId,
                            batchId,
                            courseId,
                            studentUsn: entry.studentUsn,
                        },
                    },
                    create: {
                        departmentId,
                        batchId,
                        courseId,
                        studentUsn: entry.studentUsn,
                        marks: entry.marks,
                        enteredBy: clerkId,
                        status: 'PENDING',
                    },
                    update: {
                        marks: entry.marks,
                        enteredBy: clerkId,
                        enteredAt: new Date(),
                        status: 'PENDING',
                        approvedBy: null,
                        approvedAt: null,
                    },
                })
            )
        );

        await auditLogRepository.create({
            actorId: clerkId,
            action: 'SUBMIT_SEMESTER_MARKS',
            entityType: 'SemesterEndMarks',
            entityId: courseId,
            newValue: { departmentId, batchId, courseId, entriesCount: entries.length },
        });

        return { count: results.length };
    }

    /**
     * Get clerk's own semester marks submissions
     */
    async getOwnSemesterMarks(
        clerkId: number,
        filters: { status?: string; departmentId?: number; batchId?: number; courseId?: number }
    ) {
        const where: Record<string, unknown> = { enteredBy: clerkId };
        if (filters.status) where.status = filters.status;
        if (filters.departmentId) where.departmentId = filters.departmentId;
        if (filters.batchId) where.batchId = filters.batchId;
        if (filters.courseId) where.courseId = filters.courseId;

        return prisma.semesterEndMarks.findMany({
            where,
            include: {
                department: { select: { name: true, code: true } },
                batch: { select: { name: true } },
                course: { select: { name: true, code: true } },
            },
            orderBy: { enteredAt: 'desc' },
        });
    }

    /**
     * Submit revaluation marks
     */
    async submitRevaluation(resultId: number, newMarks: number, clerkId: number) {
        const result = await prisma.result.findFirst({
            where: { id: resultId, isPublished: true },
        });

        if (!result) {
            throw Object.assign(new Error('Result not found or not yet published'), { statusCode: 400 });
        }

        const revaluation = await prisma.revaluation.create({
            data: {
                resultId,
                oldMarks: result.semesterMarks,
                newMarks,
                enteredBy: clerkId,
                status: 'PENDING',
            },
        });

        await auditLogRepository.create({
            actorId: clerkId,
            action: 'SUBMIT_REVALUATION',
            entityType: 'Revaluation',
            entityId: revaluation.id,
            newValue: {
                resultId,
                studentUsn: result.studentUsn,
                oldMarks: result.semesterMarks,
                newMarks,
            },
        });

        return revaluation;
    }

    /**
     * Get clerk's own revaluations
     */
    async getOwnRevaluations(clerkId: number, status?: string) {
        const where: Record<string, unknown> = { enteredBy: clerkId };
        if (status) where.status = status;

        return prisma.revaluation.findMany({
            where,
            include: {
                result: {
                    include: {
                        department: { select: { name: true, code: true } },
                        batch: { select: { name: true } },
                        course: { select: { name: true, code: true } },
                    },
                },
            },
            orderBy: { enteredAt: 'desc' },
        });
    }

    /**
     * Search published results for revaluation
     */
    async searchPublishedResults(filters: {
        studentUsn?: string;
        departmentId?: number;
        batchId?: number;
        courseId?: number;
    }) {
        const where: Record<string, unknown> = { isPublished: true };
        if (filters.studentUsn) where.studentUsn = filters.studentUsn;
        if (filters.departmentId) where.departmentId = filters.departmentId;
        if (filters.batchId) where.batchId = filters.batchId;
        if (filters.courseId) where.courseId = filters.courseId;

        return prisma.result.findMany({
            where,
            include: {
                department: { select: { name: true, code: true } },
                batch: { select: { name: true } },
                course: { select: { name: true, code: true } },
                revaluations: {
                    select: { id: true, oldMarks: true, newMarks: true, status: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get clerk's submission statistics
     */
    async getStats(clerkId: number) {
        const [semesterMarkStats, revaluationStats] = await Promise.all([
            prisma.semesterEndMarks.groupBy({
                by: ['status'],
                where: { enteredBy: clerkId },
                _count: true,
            }),
            prisma.revaluation.groupBy({
                by: ['status'],
                where: { enteredBy: clerkId },
                _count: true,
            }),
        ]);

        const stats = {
            semesterMarks: { pending: 0, approved: 0, locked: 0, total: 0 },
            revaluations: { pending: 0, approved: 0, locked: 0, total: 0 },
        };

        semesterMarkStats.forEach(s => {
            const status = s.status.toLowerCase() as keyof typeof stats.semesterMarks;
            stats.semesterMarks[status] = s._count;
            stats.semesterMarks.total += s._count;
        });

        revaluationStats.forEach(s => {
            const status = s.status.toLowerCase() as keyof typeof stats.revaluations;
            stats.revaluations[status] = s._count;
            stats.revaluations.total += s._count;
        });

        return stats;
    }
}

export const clerkMarksService = new ClerkMarksService();
