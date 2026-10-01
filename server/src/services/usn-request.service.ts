import { Prisma } from '@prisma/client';
import { prisma } from '../data-access/prisma.js';
import { auditLogRepository } from '../data-access/index.js';
import { authService } from './auth.service.js';

class USNRequestService {
    // Create USN request (Teacher/Mentor requests permanent USN for a student)
    async createRequest(studentProfileId: number, requestedBy: number, reason?: string) {
        // Verify the requester is a teacher
        const requester = await prisma.user.findUnique({ where: { id: requestedBy } });
        if (!requester || requester.role !== 'TEACHER') {
            throw new Error('Only teachers can request permanent USN assignment');
        }

        // Verify the student exists and doesn't already have a permanent USN
        const student = await prisma.studentProfile.findUnique({
            where: { id: studentProfileId },
            include: { user: true },
        });
        if (!student) throw new Error('Student not found');
        if (student.permanentUsn) {
            throw new Error('Student already has a permanent USN assigned');
        }

        // Check for existing pending request
        const existingRequest = await prisma.uSNRequest.findFirst({
            where: {
                studentProfileId,
                status: 'PENDING',
            },
        });
        if (existingRequest) {
            throw new Error('A pending USN request already exists for this student');
        }

        // Verify the teacher is a mentor for this student
        const teacherProfile = await prisma.teacherProfile.findUnique({
            where: { userId: requestedBy },
        });
        if (!teacherProfile) throw new Error('Teacher profile not found');

        const mentorAssignment = await prisma.mentorAssignment.findFirst({
            where: {
                teacherProfileId: teacherProfile.id,
                studentProfileId,
                isActive: true,
            },
        });
        if (!mentorAssignment) {
            throw new Error('You must be an active mentor for this student to request USN assignment');
        }

        const request = await prisma.uSNRequest.create({
            data: {
                studentProfileId,
                requestedBy,
                reason: reason || 'Mentor requests permanent USN assignment',
                status: 'PENDING',
            },
        });

        await auditLogRepository.create({
            actorId: requestedBy,
            action: 'CREATE_USN_REQUEST',
            entityType: 'USNRequest',
            entityId: request.id,
            newValue: {
                studentProfileId,
                studentName: student.user.name,
                temporaryUsn: student.temporaryUsn,
            } as Prisma.JsonValue,
        });

        return request;
    }

    // Review USN request (Admissions Admin approves/rejects)
    async reviewRequest(
        requestId: number,
        status: 'APPROVED' | 'REJECTED',
        reviewerId: number,
        permanentUsn?: string,
        reviewNote?: string
    ) {
        const request = await prisma.uSNRequest.findUnique({
            where: { id: requestId },
            include: {
                studentProfile: { include: { user: true } },
            },
        });

        if (!request) throw new Error('USN request not found');
        if (request.status !== 'PENDING') {
            throw new Error('This request has already been reviewed');
        }

        if (status === 'APPROVED') {
            if (!permanentUsn) throw new Error('Permanent USN is required for approval');

            // Check USN uniqueness
            const existing = await prisma.studentProfile.findFirst({
                where: { permanentUsn },
            });
            if (existing) throw new Error(`Permanent USN ${permanentUsn} is already assigned`);

            // Generate new password based on permanent USN
            const dept = await prisma.department.findUnique({
                where: { id: request.studentProfile.user.departmentId! },
            });
            const deptCode = dept?.code?.toUpperCase() || 'GEN';
            const last3 = permanentUsn.slice(-3);
            const batchYear = request.studentProfile.admissionYear;
            const newPassword = `${deptCode}${batchYear}${last3}`;
            const passwordHash = await authService.hashPassword(newPassword);

            await prisma.$transaction(async (tx) => {
                // Update the request
                await tx.uSNRequest.update({
                    where: { id: requestId },
                    data: {
                        status: 'APPROVED',
                        permanentUsn,
                        reviewedBy: reviewerId,
                        reviewNote,
                        reviewedAt: new Date(),
                    },
                });

                // Update student profile
                await tx.studentProfile.update({
                    where: { id: request.studentProfileId },
                    data: {
                        permanentUsn,
                        isPermanentUsnLocked: true,
                        rollNumber: permanentUsn,
                    },
                });

                // Reset password for permanent USN login
                await tx.user.update({
                    where: { id: request.studentProfile.userId },
                    data: { passwordHash },
                });
            });

            await auditLogRepository.create({
                actorId: reviewerId,
                action: 'APPROVE_USN_REQUEST',
                entityType: 'USNRequest',
                entityId: requestId,
                newValue: {
                    permanentUsn,
                    studentName: request.studentProfile.user.name,
                    previousUsn: request.studentProfile.temporaryUsn,
                } as Prisma.JsonValue,
            });
        } else {
            // Reject
            await prisma.uSNRequest.update({
                where: { id: requestId },
                data: {
                    status: 'REJECTED',
                    reviewedBy: reviewerId,
                    reviewNote: reviewNote || 'Request rejected',
                    reviewedAt: new Date(),
                },
            });

            await auditLogRepository.create({
                actorId: reviewerId,
                action: 'REJECT_USN_REQUEST',
                entityType: 'USNRequest',
                entityId: requestId,
                newValue: { reviewNote } as Prisma.JsonValue,
            });
        }

        return prisma.uSNRequest.findUnique({
            where: { id: requestId },
            include: {
                studentProfile: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
                requester: { select: { id: true, name: true, email: true } },
                reviewer: { select: { id: true, name: true, email: true } },
            },
        });
    }

    // List USN requests
    async getRequests(filters: {
        status?: 'PENDING' | 'APPROVED' | 'REJECTED';
        requestedBy?: number;
        skip?: number;
        take?: number;
    }) {
        const where: Prisma.USNRequestWhereInput = {};
        if (filters.status) where.status = filters.status;
        if (filters.requestedBy) where.requestedBy = filters.requestedBy;

        const [requests, total] = await Promise.all([
            prisma.uSNRequest.findMany({
                where,
                include: {
                    studentProfile: {
                        include: {
                            user: { select: { id: true, name: true, email: true } },
                            optedDepartment: { select: { id: true, name: true, code: true } },
                            batch: { select: { id: true, name: true } },
                        },
                    },
                    requester: { select: { id: true, name: true, email: true } },
                    reviewer: { select: { id: true, name: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: filters.skip || 0,
                take: filters.take || 50,
            }),
            prisma.uSNRequest.count({ where }),
        ]);

        return { requests, total };
    }

    // Get single request
    async getRequestById(id: number) {
        return prisma.uSNRequest.findUnique({
            where: { id },
            include: {
                studentProfile: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                        optedDepartment: true,
                        batch: true,
                    },
                },
                requester: { select: { id: true, name: true, email: true } },
                reviewer: { select: { id: true, name: true, email: true } },
            },
        });
    }
}

export const usnRequestService = new USNRequestService();
