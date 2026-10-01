import prisma from '../data-access/prisma.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'system-error' });

interface LogErrorData {
    tenantId?: number;
    errorCode: string;
    message: string;
    stack?: string;
    endpoint?: string;
    method?: string;
    userId?: number;
    metadata?: any;
    severity?: 'ERROR' | 'WARNING' | 'CRITICAL';
}

class SystemErrorService {
    /**
     * Log an error to the database
     */
    async log(data: LogErrorData) {
        try {
            return await prisma.systemError.create({
                data: {
                    tenantId: data.tenantId,
                    errorCode: data.errorCode,
                    message: data.message.substring(0, 2000), // Truncate
                    stack: data.stack?.substring(0, 5000),
                    endpoint: data.endpoint,
                    method: data.method,
                    userId: data.userId,
                    metadata: data.metadata,
                    severity: data.severity || 'ERROR',
                },
            });
        } catch (err) {
            // Don't let error logging cause more errors
            log.error({ err }, 'Failed to log system error to database');
            return null;
        }
    }

    /**
     * Get errors with filtering
     */
    async list(filters: {
        tenantId?: number;
        severity?: string;
        resolved?: boolean;
        limit?: number;
        offset?: number;
    }) {
        const where: any = {};
        if (filters.tenantId) where.tenantId = filters.tenantId;
        if (filters.severity) where.severity = filters.severity;
        if (filters.resolved !== undefined) where.resolved = filters.resolved;

        const [errors, total] = await Promise.all([
            prisma.systemError.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: filters.limit || 50,
                skip: filters.offset || 0,
                include: {
                    tenant: { select: { name: true, slug: true } },
                },
            }),
            prisma.systemError.count({ where }),
        ]);

        return { errors, total };
    }

    /**
     * Resolve an error
     */
    async resolve(id: number) {
        return prisma.systemError.update({
            where: { id },
            data: { resolved: true, resolvedAt: new Date() },
        });
    }

    /**
     * Mark multiple errors as resolved
     */
    async resolveMany(ids: number[]) {
        return prisma.systemError.updateMany({
            where: { id: { in: ids } },
            data: { resolved: true, resolvedAt: new Date() },
        });
    }

    /**
     * Get error stats
     */
    async getStats() {
        const [total, unresolved, critical, last24h] = await Promise.all([
            prisma.systemError.count(),
            prisma.systemError.count({ where: { resolved: false } }),
            prisma.systemError.count({ where: { severity: 'CRITICAL', resolved: false } }),
            prisma.systemError.count({
                where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
            }),
        ]);

        return { total, unresolved, critical, last24h };
    }

    /**
     * Delete old resolved errors (cleanup)
     */
    async cleanup(olderThanDays: number = 30) {
        const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        return prisma.systemError.deleteMany({
            where: { resolved: true, createdAt: { lt: cutoff } },
        });
    }
}

export const systemErrorService = new SystemErrorService();
