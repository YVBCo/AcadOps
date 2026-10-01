/**
 * Results Service
 * ──────────────────────────────────────
 * Handles COE result operations: listing, publishing, generation.
 */
import { prisma } from '../data-access/prisma.js';

interface ResultFilters {
    status?: string;
    isPublished?: boolean;
    departmentId?: number;
    batchId?: number;
    courseId?: number;
}

class ResultsService {
    /**
     * List results with optional filters
     */
    async list(filters: ResultFilters) {
        const where: Record<string, unknown> = {};
        if (filters.status && filters.status !== 'ALL') where.status = filters.status;
        if (filters.isPublished !== undefined) where.isPublished = filters.isPublished;
        if (filters.departmentId) where.departmentId = filters.departmentId;
        if (filters.batchId) where.batchId = filters.batchId;
        if (filters.courseId) where.courseId = filters.courseId;

        return prisma.result.findMany({
            where,
            include: {
                department: { select: { id: true, name: true, code: true } },
                batch: { select: { id: true, name: true, currentSemester: true } },
                course: { select: { id: true, name: true, code: true } },
                finalizer: { select: { id: true, name: true } },
            },
            orderBy: [
                { departmentId: 'asc' },
                { batchId: 'asc' },
                { courseId: 'asc' },
                { studentUsn: 'asc' },
            ],
        });
    }

    /**
     * Publish a single result
     */
    async publishOne(resultId: number, userId: number) {
        const result = await prisma.result.findUnique({ where: { id: resultId } });
        if (!result) throw Object.assign(new Error('Result not found'), { statusCode: 404 });
        if (result.isPublished) throw Object.assign(new Error('Result is already published'), { statusCode: 400 });

        return prisma.result.update({
            where: { id: resultId },
            data: {
                isPublished: true,
                publishedAt: new Date(),
                finalizedBy: userId,
                finalizedAt: new Date(),
            },
        });
    }

    /**
     * Batch-publish results matching filter criteria
     */
    async publishBatch(
        filters: { departmentId?: number; batchId?: number; courseId?: number },
        userId: number
    ) {
        const where: Record<string, unknown> = { isPublished: false };
        if (filters.departmentId) where.departmentId = filters.departmentId;
        if (filters.batchId) where.batchId = filters.batchId;
        if (filters.courseId) where.courseId = filters.courseId;

        const result = await prisma.result.updateMany({
            where,
            data: {
                isPublished: true,
                publishedAt: new Date(),
                finalizedBy: userId,
                finalizedAt: new Date(),
            },
        });

        return { count: result.count };
    }

    /**
     * Generate results by combining internal + semester marks
     */
    async generate(departmentId: number, batchId: number, courseId: number) {
        const internalMarks = await prisma.internalMarksSubmission.findMany({
            where: { departmentId, batchId, courseId },
        });

        const semesterUploads = await prisma.semesterMarkUpload.findMany({
            where: { departmentId, batchId, courseId, status: 'POSTED' },
            include: { marks: true },
        });

        // Build maps
        const semesterMarksMap = new Map<string, number>();
        for (const upload of semesterUploads) {
            for (const mark of upload.marks) {
                semesterMarksMap.set(mark.studentUsn, mark.externalMarks);
            }
        }

        const internalMarksMap = new Map<string, number>();
        for (const im of internalMarks) {
            internalMarksMap.set(im.studentUsn, im.marks);
        }

        const allUsns = new Set([...internalMarksMap.keys(), ...semesterMarksMap.keys()]);
        if (allUsns.size === 0) {
            throw Object.assign(new Error('No marks data found for this combination'), { statusCode: 400 });
        }

        let generated = 0;
        let skipped = 0;
        const missingInternal: string[] = [];
        const missingSemester: string[] = [];

        for (const usn of allUsns) {
            const internal = internalMarksMap.get(usn);
            const semester = semesterMarksMap.get(usn);

            if (internal === undefined) { missingInternal.push(usn); continue; }
            if (semester === undefined) { missingSemester.push(usn); continue; }

            const total = internal + semester;
            let status: 'PASS' | 'FAIL' | 'MAKEUP_ELIGIBLE' = 'PASS';
            if (total < 40) {
                status = internal >= 20 ? 'MAKEUP_ELIGIBLE' : 'FAIL';
            }

            try {
                await prisma.result.upsert({
                    where: {
                        departmentId_batchId_courseId_studentUsn: {
                            departmentId, batchId, courseId, studentUsn: usn,
                        },
                    },
                    create: {
                        departmentId, batchId, courseId,
                        studentUsn: usn,
                        internalMarks: internal, semesterMarks: semester,
                        totalMarks: total, status,
                    },
                    update: {
                        internalMarks: internal, semesterMarks: semester,
                        totalMarks: total, status,
                    },
                });
                generated++;
            } catch {
                skipped++;
            }
        }

        return {
            generated,
            skipped,
            missingInternal: missingInternal.length > 0 ? missingInternal : undefined,
            missingSemester: missingSemester.length > 0 ? missingSemester : undefined,
        };
    }
}

export const resultsService = new ResultsService();
