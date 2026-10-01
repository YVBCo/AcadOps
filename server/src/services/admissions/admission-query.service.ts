/**
 * Admission Query Service
 * ──────────────────────────────────────
 * Handles read-only queries: listing admissions, dashboard stats,
 * admin clerk management, student info editing, and branch changes.
 *
 * Extracted from admissions.service.ts (lines 1058-1407)
 */
import { AdmissionStatus, Prisma } from '@prisma/client';
import prisma from '../../data-access/prisma.js';
import { auditLogRepository } from '../../data-access/index.js';
import { authService } from '../auth.service.js';
import { emailService } from '../email.service.js';
import {
    log,
    generatePassword,
    generateTemporaryUsn,
} from './shared.js';

class AdmissionQueryService {
    /**
     * Get all approved students with batch/department info — tenant-scoped
     */
    async getApprovedStudents(tenantId: number, skip = 0, take = 50) {
        const safeTake = Math.min(take, 200);
        const where = { user: { tenantId } };

        const [students, total] = await Promise.all([
            prisma.studentProfile.findMany({
                where,
                include: {
                    user: { select: { id: true, name: true, email: true } },
                    batch: { select: { id: true, name: true } },
                    optedDepartment: { select: { id: true, name: true, code: true } },
                    admissionData: true,
                },
                orderBy: [
                    { batch: { name: 'desc' } },
                    { optedDepartment: { name: 'asc' } },
                    { rollNumber: 'asc' },
                ],
                skip,
                take: safeTake,
            }),
            prisma.studentProfile.count({ where }),
        ]);
        return { students, total };
    }

    /**
     * List admissions with filters — tenant-scoped
     */
    async getAdmissions(filters: {
        status?: AdmissionStatus;
        search?: string;
        skip?: number;
        take?: number;
        enteredBy?: number;
        tenantId?: number;
    }) {
        const where: Prisma.AdmissionDataWhereInput = {};

        if (filters.tenantId) {
            where.enteredByUser = { tenantId: filters.tenantId };
        }

        if (filters.status) where.status = filters.status;
        if (filters.enteredBy) where.enteredBy = filters.enteredBy;
        if (filters.search) {
            where.OR = [
                { applicantName: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
                { admissionId: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
                { emailId: { contains: filters.search, mode: 'insensitive' as Prisma.QueryMode } },
            ];
        }

        const [admissions, total] = await Promise.all([
            prisma.admissionData.findMany({
                where,
                include: {
                    enteredByUser: { select: { id: true, name: true, email: true } },
                    approvedByUser: { select: { id: true, name: true, email: true } },
                    studentProfile: {
                        select: {
                            id: true, rollNumber: true, temporaryUsn: true,
                            permanentUsn: true, isPermanentUsnLocked: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: filters.skip || 0,
                take: filters.take || 50,
            }),
            prisma.admissionData.count({ where }),
        ]);

        return { admissions, total };
    }

    /**
     * Get single admission by ID
     */
    async getAdmissionById(id: number) {
        return prisma.admissionData.findUnique({
            where: { id },
            include: {
                enteredByUser: { select: { id: true, name: true, email: true } },
                approvedByUser: { select: { id: true, name: true, email: true } },
                studentProfile: {
                    include: {
                        user: { select: { id: true, name: true, email: true, role: true } },
                        batch: true,
                        optedDepartment: true,
                    },
                },
            },
        });
    }

    /**
     * Create Admin Clerk
     */
    async createAdminClerk(data: { email: string; name: string }, adminId: number, tenantId: number) {
        const existing = await prisma.user.findFirst({
            where: {
                email: { equals: data.email, mode: 'insensitive' },
                tenantId,
                NOT: { email: { startsWith: 'deleted_' } },
            },
        });
        if (existing) throw new Error('Email already registered in this institution');

        const password = generatePassword();
        const passwordHash = await authService.hashPassword(password);

        const clerk = await prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                name: data.name,
                role: 'ADMIN_CLERK',
                tenantId,
            },
        });

        await auditLogRepository.create({
            actorId: adminId,
            action: 'CREATE_ADMIN_CLERK',
            entityType: 'User',
            entityId: clerk.id,
            newValue: { email: data.email, name: data.name, role: 'ADMIN_CLERK' } as Prisma.JsonValue,
        });

        const { passwordHash: _, ...clerkWithoutPassword } = clerk;

        const tenantForClerk = await prisma.tenant.findUnique({
            where: { id: clerk.tenantId },
            select: { slug: true },
        });

        await emailService.sendWelcomeEmail(data.email, data.name, 'Admin Clerk', password, tenantForClerk?.slug, { tenantId: clerk.tenantId, userId: clerk.id })
            .catch(err => log.warn({ email: data.email, error: (err as Error).message }, 'Clerk welcome email failed'));

        return { user: clerkWithoutPassword, password };
    }

    /**
     * Get admin clerks — tenant-scoped
     */
    async getAdminClerks(tenantId: number, skip = 0, take = 50) {
        const safeTake = Math.min(take, 200);
        const where = { role: 'ADMIN_CLERK' as const, tenantId };

        const [clerks, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: { id: true, email: true, name: true, isActive: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                skip,
                take: safeTake,
            }),
            prisma.user.count({ where }),
        ]);
        return { clerks, total };
    }

    /**
     * Get dashboard stats — tenant-scoped
     */
    async getDashboardStats(tenantId: number) {
        const tenantFilter = { enteredByUser: { tenantId } };
        const [totalAdmissions, draft, submitted, approved, rejected, totalStudents, pendingUsn] = await Promise.all([
            prisma.admissionData.count({ where: tenantFilter }),
            prisma.admissionData.count({ where: { status: 'DRAFT', ...tenantFilter } }),
            prisma.admissionData.count({ where: { status: 'SUBMITTED', ...tenantFilter } }),
            prisma.admissionData.count({ where: { status: 'APPROVED', ...tenantFilter } }),
            prisma.admissionData.count({ where: { status: 'REJECTED', ...tenantFilter } }),
            prisma.studentProfile.count({ where: { user: { tenantId } } }),
            prisma.uSNRequest.count({ where: { status: 'PENDING', requester: { tenantId } } }),
        ]);

        return { totalAdmissions, draft, submitted, approved, rejected, totalStudents, pendingUsn };
    }

    // ============================================
    // Student Info Edit (Post-Approval)
    // ============================================

    /**
     * Admin/Super Admin directly updates student info
     */
    async updateStudentInfo(userId: number, data: any, editedBy?: number, reason?: string) {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
            include: { admissionData: true },
        });

        if (!profile) throw new Error('Student profile not found');

        if (data.name) {
            await prisma.user.update({ where: { id: userId }, data: { name: data.name } });
        }

        if (profile.admissionData) {
            const updateData: any = {};
            if (data.name) updateData.applicantName = data.name;
            if (data.mobileNumber) updateData.mobileNumber = data.mobileNumber;
            if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);
            if (data.gender) updateData.gender = data.gender;
            if (data.bloodGroup) updateData.bloodGroup = data.bloodGroup;
            if (data.category) updateData.category = data.category;
            if (data.religion) updateData.religion = data.religion;
            if (data.permanentAddress) updateData.permanentAddress = data.permanentAddress;
            if (data.localAddress) updateData.localAddress = data.localAddress;
            if (data.fatherDetails) updateData.fatherDetails = data.fatherDetails;
            if (data.motherDetails) updateData.motherDetails = data.motherDetails;

            await prisma.admissionData.update({
                where: { id: profile.admissionData.id },
                data: updateData,
            });
        }

        log.info({ userId, editedBy, reason }, 'Student info edited');
        return { message: 'Student info updated successfully' };
    }

    /**
     * Clerk creates an edit request
     */
    async createEditRequest(userId: number, data: any, clerkId: number) {
        const profile = await prisma.studentProfile.findUnique({ where: { userId } });
        if (!profile) throw new Error('Student profile not found');

        const request = await prisma.studentEditRequest.create({
            data: {
                studentProfileId: profile.id,
                requestedBy: clerkId,
                proposedChanges: data.proposedChanges || data,
                reason: data.reason || 'Student info update requested by clerk',
            },
        });

        return { message: 'Edit request submitted for admin approval', request };
    }

    /**
     * Get edit requests — tenant-scoped
     */
    async getEditRequests(status: string = 'PENDING', tenantId?: number, skip = 0, take = 50) {
        const safeTake = Math.min(take, 200);
        const where: any = { status };
        if (tenantId) {
            where.studentProfile = { user: { tenantId } };
        }

        const [requests, total] = await Promise.all([
            prisma.studentEditRequest.findMany({
                where,
                include: {
                    studentProfile: {
                        include: {
                            user: { select: { id: true, name: true, email: true } },
                        },
                    },
                    requester: { select: { id: true, name: true, email: true } },
                    reviewer: { select: { id: true, name: true, email: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: safeTake,
            }),
            prisma.studentEditRequest.count({ where }),
        ]);
        return { requests, total };
    }

    /**
     * Approve edit request — applies the proposed changes
     */
    async approveEditRequest(id: number, adminId: number, reviewNote?: string) {
        const request = await prisma.studentEditRequest.findUnique({
            where: { id },
            include: { studentProfile: { include: { admissionData: true } } },
        });

        if (!request) throw new Error('Edit request not found');
        if (request.status !== 'PENDING') throw new Error('Edit request already reviewed');

        const changes = request.proposedChanges as Record<string, unknown>;
        await this.updateStudentInfo(request.studentProfile.userId, changes);

        await prisma.studentEditRequest.update({
            where: { id },
            data: {
                status: 'APPROVED',
                reviewedBy: adminId,
                reviewNote,
                reviewedAt: new Date(),
            },
        });

        return { message: 'Edit request approved and changes applied' };
    }

    /**
     * Reject edit request
     */
    async rejectEditRequest(id: number, adminId: number, reviewNote?: string) {
        const request = await prisma.studentEditRequest.findUnique({ where: { id } });
        if (!request) throw new Error('Edit request not found');
        if (request.status !== 'PENDING') throw new Error('Edit request already reviewed');

        await prisma.studentEditRequest.update({
            where: { id },
            data: {
                status: 'REJECTED',
                reviewedBy: adminId,
                reviewNote,
                reviewedAt: new Date(),
            },
        });

        return { message: 'Edit request rejected' };
    }

    /**
     * Change student branch
     */
    async changeBranch(userId: number, newBranch: string, adminId: number) {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
            include: { admissionData: true },
        });

        if (!profile) throw new Error('Student profile not found');

        const user = await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
        const newDept = await prisma.department.findFirst({
            where: {
                tenantId: user?.tenantId,
                OR: [
                    { code: newBranch },
                    { name: { contains: newBranch, mode: 'insensitive' as Prisma.QueryMode } },
                ],
            },
        });

        if (!newDept) throw new Error(`Cannot resolve department for branch: ${newBranch}`);

        const oldBranch = profile.admissionData?.branchSelection || 'Unknown';

        await prisma.studentProfile.update({
            where: { id: profile.id },
            data: { optedDepartmentId: newDept.id },
        });

        await prisma.user.update({
            where: { id: userId },
            data: { departmentId: newDept.id },
        });

        if (profile.admissionData) {
            await prisma.admissionData.update({
                where: { id: profile.admissionData.id },
                data: { branchSelection: newBranch },
            });
        }

        let newUsn: string | undefined;
        if (profile.permanentUsn) {
            const newTempUsn = await generateTemporaryUsn(newDept.code || 'GEN', user?.tenantId || 0);
            await prisma.studentProfile.update({
                where: { id: profile.id },
                data: {
                    rollNumber: newTempUsn,
                    permanentUsn: null,
                },
            });
            newUsn = newTempUsn;
        }

        log.info({ userId, oldBranch, newBranch, adminId, newUsn }, 'Branch change');

        return {
            message: `Branch changed from ${oldBranch} to ${newBranch} successfully`,
            newDepartment: newDept.name,
            usnReassigned: !!newUsn,
            newTemporaryUsn: newUsn,
        };
    }
    /**
     * Resolve tenant by slug and find the system admin user for public submissions.
     * Used by the public apply endpoint to identify the institution.
     */
    async resolveTenantAndSystemUser(slug: string) {
        const tenant = await prisma.tenant.findUnique({ where: { slug } });
        if (!tenant || !tenant.isActive) {
            return { tenant: null, systemUser: null };
        }

        const systemUser = await prisma.user.findFirst({
            where: {
                tenantId: tenant.id,
                role: { in: ['ADMISSIONS_ADMIN', 'SUPER_ADMIN'] },
                isActive: true,
            },
            orderBy: { createdAt: 'asc' },
        });

        return { tenant, systemUser };
    }
}

export const admissionQueryService = new AdmissionQueryService();
