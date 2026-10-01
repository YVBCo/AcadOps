import { prisma } from './prisma.js';
import { EditRequest, EditRequestStatus, EditRequestType, Prisma } from '@prisma/client';

export interface CreateEditRequestData {
    type: EditRequestType;
    requesterId: number;
    subjectId: number;
    entityType: string;
    entityId: number;
    oldValue: Prisma.InputJsonValue;
    newValue: Prisma.InputJsonValue;
    reason?: string;
}

export const editRequestRepository = {
    async create(data: CreateEditRequestData): Promise<EditRequest> {
        return prisma.editRequest.create({
            data: {
                type: data.type,
                requesterId: data.requesterId,
                subjectId: data.subjectId,
                entityType: data.entityType,
                entityId: data.entityId,
                oldValue: data.oldValue,
                newValue: data.newValue,
                reason: data.reason,
            },
            include: {
                requester: true,
            },
        });
    },

    async findById(id: number): Promise<EditRequest | null> {
        return prisma.editRequest.findUnique({
            where: { id },
            include: {
                requester: true,
                reviewer: true,
            },
        });
    },

    async findByStatus(status: EditRequestStatus): Promise<EditRequest[]> {
        return prisma.editRequest.findMany({
            where: { status },
            include: {
                requester: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    },

    async findByRequester(requesterId: number): Promise<EditRequest[]> {
        return prisma.editRequest.findMany({
            where: { requesterId },
            include: {
                reviewer: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    },

    async findBySubject(subjectId: number, status?: EditRequestStatus): Promise<EditRequest[]> {
        return prisma.editRequest.findMany({
            where: {
                subjectId,
                ...(status && { status }),
            },
            include: {
                requester: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    },

    async findPendingByDepartment(departmentId: number): Promise<EditRequest[]> {
        // Teachers are linked to departments through User.departmentId
        return prisma.editRequest.findMany({
            where: {
                status: 'PENDING',
                requester: {
                    departmentId: departmentId,
                },
            },
            include: {
                requester: {
                    include: {
                        teacherProfile: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    },

    async findAll(options: {
        skip?: number;
        take?: number;
        status?: EditRequestStatus;
        type?: EditRequestType;
    } = {}): Promise<{ requests: EditRequest[]; total: number }> {
        const where: Prisma.EditRequestWhereInput = {};
        if (options.status) where.status = options.status;
        if (options.type) where.type = options.type;

        const [requests, total] = await Promise.all([
            prisma.editRequest.findMany({
                where,
                skip: options.skip,
                take: options.take,
                include: {
                    requester: true,
                    reviewer: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.editRequest.count({ where }),
        ]);

        return { requests, total };
    },

    async approve(id: number, reviewerId: number, reviewNote?: string): Promise<EditRequest> {
        return prisma.editRequest.update({
            where: { id },
            data: {
                status: 'APPROVED',
                reviewerId,
                reviewNote,
                reviewedAt: new Date(),
            },
            include: {
                requester: true,
                reviewer: true,
            },
        });
    },

    async reject(id: number, reviewerId: number, reviewNote?: string): Promise<EditRequest> {
        return prisma.editRequest.update({
            where: { id },
            data: {
                status: 'REJECTED',
                reviewerId,
                reviewNote,
                reviewedAt: new Date(),
            },
            include: {
                requester: true,
                reviewer: true,
            },
        });
    },

    async countPending(): Promise<number> {
        return prisma.editRequest.count({
            where: { status: 'PENDING' },
        });
    },

    async countPendingByDepartment(departmentId: number): Promise<number> {
        // Teachers are linked to departments through User.departmentId
        return prisma.editRequest.count({
            where: {
                status: 'PENDING',
                requester: {
                    departmentId: departmentId,
                },
            },
        });
    },
};

export type EditRequestRepository = typeof editRequestRepository;
