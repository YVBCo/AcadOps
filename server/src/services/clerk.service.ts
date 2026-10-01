/**
 * Clerk Service
 * ──────────────────────────────────────
 * COE-managed clerk account operations: list, create, toggle, delete.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../data-access/prisma.js';
import { auditLogRepository } from '../data-access/index.js';
import { userService } from './user.service.js';

class ClerkService {
    /**
     * List all clerks for a tenant
     */
    async list(tenantId: number) {
        return prisma.user.findMany({
            where: { role: 'CLERK', tenantId },
            select: {
                id: true, name: true, email: true,
                isActive: true, createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Create a new clerk with email notification
     */
    async create(
        data: { name: string; email: string },
        tenantId: number,
        actorId: number
    ) {
        // Check duplicate email
        const existing = await prisma.user.findFirst({
            where: {
                email: { equals: data.email, mode: 'insensitive' },
                tenantId,
                NOT: { email: { startsWith: 'deleted_' } },
            },
        });
        if (existing) {
            throw Object.assign(new Error('Email already registered'), { statusCode: 400 });
        }

        const result = await userService.createWithEmailNotification(
            { name: data.name, email: data.email, role: 'CLERK', tenantId },
            actorId
        );

        await auditLogRepository.create({
            actorId,
            action: 'CREATE_CLERK',
            entityType: 'User',
            entityId: result.user.id,
            newValue: { name: result.user.name, email: result.user.email, role: 'CLERK' } as Prisma.JsonValue,
        });

        return {
            id: result.user.id, name: result.user.name,
            email: result.user.email, isActive: result.user.isActive,
            createdAt: result.user.createdAt,
        };
    }

    /**
     * Toggle clerk active status
     */
    async toggleActive(clerkId: number, tenantId: number, actorId: number) {
        const clerk = await prisma.user.findFirst({
            where: { id: clerkId, role: 'CLERK', tenantId },
        });
        if (!clerk) throw Object.assign(new Error('Clerk not found'), { statusCode: 404 });

        const updated = await prisma.user.update({
            where: { id: clerkId },
            data: { isActive: !clerk.isActive },
        });

        await auditLogRepository.create({
            actorId,
            action: clerk.isActive ? 'DEACTIVATE_CLERK' : 'ACTIVATE_CLERK',
            entityType: 'User',
            entityId: clerkId,
            oldValue: { isActive: clerk.isActive } as Prisma.JsonValue,
            newValue: { isActive: updated.isActive } as Prisma.JsonValue,
        });

        return {
            id: updated.id, name: updated.name,
            email: updated.email, isActive: updated.isActive,
            createdAt: updated.createdAt,
        };
    }

    /**
     * Soft-delete a clerk (deactivate)
     */
    async softDelete(clerkId: number, tenantId: number, actorId: number) {
        const clerk = await prisma.user.findFirst({
            where: { id: clerkId, role: 'CLERK', tenantId },
        });
        if (!clerk) throw Object.assign(new Error('Clerk not found'), { statusCode: 404 });

        await prisma.user.update({
            where: { id: clerkId },
            data: { isActive: false },
        });

        await auditLogRepository.create({
            actorId,
            action: 'DELETE_CLERK',
            entityType: 'User',
            entityId: clerkId,
            oldValue: { name: clerk.name, email: clerk.email } as Prisma.JsonValue,
        });
    }
}

export const clerkService = new ClerkService();
