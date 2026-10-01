import { prisma, ExtendedTransactionClient } from './prisma.js';
import { AuditLog, Prisma, UserRole } from '@prisma/client';

export interface CreateAuditLogData {
    actorId?: number;
    action: string;
    entityType: string;
    entityId?: number;
    oldValue?: Prisma.JsonValue;
    newValue?: Prisma.JsonValue;
    ipAddress?: string;
    userAgent?: string;
    tenantId?: number;
}

export const auditLogRepository = {
    // Create audit log entry (IMMUTABLE - no update/delete)
    async create(data: CreateAuditLogData, tx?: ExtendedTransactionClient): Promise<AuditLog> {
        const client = tx ?? prisma;

        // Auto-resolve tenantId from actor if not provided
        let tenantId = data.tenantId;
        if (!tenantId && data.actorId) {
            const actor = await (client as any).user.findUnique({
                where: { id: data.actorId },
                select: { tenantId: true },
            });
            tenantId = actor?.tenantId;
        }

        return (client.auditLog.create as any)({
            data: {
                tenantId,
                actorId: data.actorId,
                action: data.action,
                entityType: data.entityType,
                entityId: data.entityId,
                oldValue: data.oldValue ?? Prisma.JsonNull,
                newValue: data.newValue ?? Prisma.JsonNull,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
            },
        });
    },

    // Find by actor
    async findByActor(actorId: number, options?: {
        skip?: number;
        take?: number;
    }): Promise<AuditLog[]> {
        return prisma.auditLog.findMany({
            where: { actorId },
            skip: options?.skip,
            take: options?.take,
            orderBy: { timestamp: 'desc' },
            include: {
                actor: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });
    },

    // Find by entity
    async findByEntity(entityType: string, entityId: number): Promise<AuditLog[]> {
        return prisma.auditLog.findMany({
            where: { entityType, entityId },
            orderBy: { timestamp: 'desc' },
            include: {
                actor: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });
    },

    // Find all with filters (for Admin view)
    async findAll(options: {
        skip?: number;
        take?: number;
        actorId?: number;
        entityType?: string;
        action?: string;
        startDate?: Date;
        endDate?: Date;
        actorRole?: string;
    }): Promise<{ logs: AuditLog[]; total: number }> {
        const where: Prisma.AuditLogWhereInput = {};

        if (options.actorId) where.actorId = options.actorId;
        if (options.actorRole) where.actor = { role: options.actorRole as UserRole };
        if (options.entityType) where.entityType = options.entityType;
        if (options.action) where.action = { contains: options.action };
        if (options.startDate || options.endDate) {
            where.timestamp = {};
            if (options.startDate) where.timestamp.gte = options.startDate;
            if (options.endDate) where.timestamp.lte = options.endDate;
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip: options.skip,
                take: options.take,
                orderBy: { timestamp: 'desc' },
                include: {
                    actor: {
                        select: { id: true, name: true, email: true, role: true },
                    },
                },
            }),
            prisma.auditLog.count({ where }),
        ]);

        return { logs, total };
    },

    /**
     * Find audit logs by a list of actor IDs (e.g. all users in cycle departments for FYC).
     * Returns paginated results with total count.
     */
    async findByActorIds(actorIds: number[], options?: {
        skip?: number;
        take?: number;
        action?: string;
        startDate?: Date;
        endDate?: Date;
    }): Promise<{ logs: AuditLog[]; total: number }> {
        const where: Prisma.AuditLogWhereInput = {
            actorId: { in: actorIds },
        };

        if (options?.action) where.action = { contains: options.action };
        if (options?.startDate || options?.endDate) {
            where.timestamp = {};
            if (options?.startDate) where.timestamp.gte = options.startDate;
            if (options?.endDate) where.timestamp.lte = options.endDate;
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip: options?.skip,
                take: options?.take,
                orderBy: { timestamp: 'desc' },
                include: {
                    actor: {
                        select: { id: true, name: true, email: true, role: true },
                    },
                },
            }),
            prisma.auditLog.count({ where }),
        ]);

        return { logs, total };
    },

    // Find by department (through actor's department)
    async findByDepartment(departmentId: number, options?: {
        skip?: number;
        take?: number;
        actorRole?: string;
    }): Promise<{ logs: AuditLog[]; total: number }> {
        const where: Prisma.AuditLogWhereInput = {
            actor: {
                departmentId,
                role: options?.actorRole ? (options.actorRole as UserRole) : undefined,
            },
        };

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip: options?.skip,
                take: options?.take,
                orderBy: { timestamp: 'desc' },
                include: {
                    actor: {
                        select: { id: true, name: true, email: true, role: true },
                    },
                },
            }),
            prisma.auditLog.count({ where }),
        ]);

        return { logs, total };
    },

    /**
     * Get audit log statistics (action breakdown, entity breakdown, counts).
     */
    async getStats() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [actionStats, entityStats, totalCount, recentCount] = await Promise.all([
            prisma.auditLog.groupBy({
                by: ['action'],
                _count: { action: true },
                orderBy: { _count: { action: 'desc' } },
                take: 10,
            }),
            prisma.auditLog.groupBy({
                by: ['entityType'],
                _count: { entityType: true },
                orderBy: { _count: { entityType: 'desc' } },
            }),
            prisma.auditLog.count(),
            prisma.auditLog.count({
                where: { timestamp: { gte: thirtyDaysAgo } },
            }),
        ]);

        return {
            totalLogs: totalCount,
            logsLast30Days: recentCount,
            topActions: actionStats.map(s => ({
                action: s.action,
                count: s._count.action,
            })),
            entityBreakdown: entityStats.map(s => ({
                entityType: s.entityType,
                count: s._count.entityType,
            })),
        };
    },
};

export type AuditLogRepository = typeof auditLogRepository;
