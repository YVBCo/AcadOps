/**
 * Revaluations Service
 * ──────────────────────────────────────
 * COE revaluation management: list, approve, reject.
 */
import { prisma } from '../data-access/prisma.js';
import { MarksStatus } from '@prisma/client';

class RevaluationsService {
    /**
     * List revaluations with optional status filter
     */
    async list(status?: string) {
        const where: Record<string, unknown> = {};
        if (status && ['PENDING', 'APPROVED', 'LOCKED'].includes(status)) {
            where.status = status as MarksStatus;
        }

        return prisma.revaluation.findMany({
            where,
            include: {
                result: {
                    select: {
                        id: true, studentUsn: true, totalMarks: true,
                        department: { select: { name: true, code: true } },
                        batch: { select: { name: true } },
                        course: { select: { name: true, code: true } },
                    },
                },
                enteredByUser: { select: { name: true, email: true } },
                approvedByUser: { select: { name: true } },
            },
            orderBy: { enteredAt: 'desc' },
        });
    }

    /**
     * Approve a revaluation and update the result
     */
    async approve(revaluationId: number, userId: number) {
        const reval = await prisma.revaluation.findUnique({
            where: { id: revaluationId },
            include: { result: true },
        });

        if (!reval) throw Object.assign(new Error('Revaluation not found'), { statusCode: 404 });
        if (reval.status !== 'PENDING') {
            throw Object.assign(new Error(`Revaluation is already ${reval.status.toLowerCase()}`), { statusCode: 400 });
        }

        return prisma.$transaction(async (tx) => {
            const updated = await tx.revaluation.update({
                where: { id: revaluationId },
                data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
            });

            await tx.result.update({
                where: { id: reval.resultId },
                data: { totalMarks: reval.newMarks },
            });

            return updated;
        });
    }

    /**
     * Reject a revaluation (set status to LOCKED)
     */
    async reject(revaluationId: number, userId: number) {
        const reval = await prisma.revaluation.findUnique({ where: { id: revaluationId } });

        if (!reval) throw Object.assign(new Error('Revaluation not found'), { statusCode: 404 });
        if (reval.status !== 'PENDING') {
            throw Object.assign(new Error(`Revaluation is already ${reval.status.toLowerCase()}`), { statusCode: 400 });
        }

        return prisma.revaluation.update({
            where: { id: revaluationId },
            data: { status: 'LOCKED', approvedBy: userId, approvedAt: new Date() },
        });
    }
}

export const revaluationsService = new RevaluationsService();
