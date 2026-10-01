/**
 * Admissions Core Service
 * ──────────────────────────────────────
 * Handles CRUD lifecycle of individual admissions:
 *   create → update → submit → review (approve/reject)
 * 
 * Extracted from the monolithic admissions.service.ts (lines 222-603)
 * for maintainability and focused testing.
 */
import { Prisma } from '@prisma/client';
import prisma from '../../data-access/prisma.js';
import { auditLogRepository } from '../../data-access/index.js';
import { authService } from '../auth.service.js';
import { randomBytes } from 'crypto';
import {
    log,
    branchToCode,
    generateAdmissionId,
    type CreateAdmissionInput,
} from './shared.js';

class AdmissionCoreService {
    /**
     * Create a new admission entry (by Admin Clerk).
     * Uses a temporary APP reference — real ADM number assigned only on approval.
     */
    async createAdmission(data: CreateAdmissionInput, clerkId: number, _tenantId?: number) {
        const appRef = `APP-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;

        const admission = await prisma.admissionData.create({
            data: {
                admissionId: appRef,
                applicantName: data.applicantName,
                applyingThrough: data.applyingThrough,
                gender: data.gender,
                bloodGroup: data.bloodGroup,
                dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
                nationality: data.nationality,
                religion: data.religion,
                category: data.category,
                subCaste: data.subCaste,
                motherTongue: data.motherTongue,
                speciallyAbled: data.speciallyAbled || false,
                aadhaarNumber: data.aadhaarNumber,
                emailId: data.emailId,
                mobileNumber: data.mobileNumber,
                hostel: data.hostel || false,
                pickupPlace: data.pickupPlace,
                permanentAddress: data.permanentAddress as Prisma.InputJsonValue,
                localAddress: data.localAddress as Prisma.InputJsonValue,
                fatherDetails: data.fatherDetails as Prisma.InputJsonValue,
                motherDetails: data.motherDetails as Prisma.InputJsonValue,
                branchSelection: data.branchSelection,
                cetRollNo: data.cetRollNo,
                cetRank: data.cetRank,
                cetAllottedCategory: data.cetAllottedCategory,
                comedkRollNo: data.comedkRollNo,
                comedkRank: data.comedkRank,
                sslcDetails: data.sslcDetails as Prisma.InputJsonValue,
                pucDetails: data.pucDetails as Prisma.InputJsonValue,
                subjectWiseMarks: data.subjectWiseMarks as Prisma.InputJsonValue,
                documents: data.documents as unknown as Prisma.InputJsonValue,
                howDidYouKnow: data.howDidYouKnow,
                applicantDeclaration: data.applicantDeclaration || false,
                parentDeclaration: data.parentDeclaration || false,
                admissionYear: data.admissionYear,
                formData: data.formData ? (data.formData as Prisma.InputJsonValue) : undefined,
                isLateralEntry: data.isLateralEntry || false,
                enteredBy: clerkId,
                status: 'DRAFT',
            },
        });

        await auditLogRepository.create({
            actorId: clerkId,
            action: 'CREATE_ADMISSION',
            entityType: 'AdmissionData',
            entityId: admission.id,
            newValue: { admissionId: appRef, applicantName: data.applicantName } as Prisma.JsonValue,
        });

        return admission;
    }

    /**
     * Update admission (by Clerk, only if DRAFT or REJECTED)
     */
    async updateAdmission(id: number, data: Partial<CreateAdmissionInput>, clerkId: number) {
        const existing = await prisma.admissionData.findUnique({ where: { id } });
        if (!existing) throw new Error('Admission not found');
        if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
            throw new Error('Can only edit admissions in DRAFT or REJECTED status');
        }

        const updated = await prisma.admissionData.update({
            where: { id },
            data: {
                ...data,
                dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
                permanentAddress: data.permanentAddress as Prisma.InputJsonValue,
                localAddress: data.localAddress as Prisma.InputJsonValue,
                fatherDetails: data.fatherDetails as Prisma.InputJsonValue,
                motherDetails: data.motherDetails as Prisma.InputJsonValue,
                sslcDetails: data.sslcDetails as Prisma.InputJsonValue,
                pucDetails: data.pucDetails as Prisma.InputJsonValue,
                subjectWiseMarks: data.subjectWiseMarks as Prisma.InputJsonValue,
                documents: data.documents as unknown as Prisma.InputJsonValue,
                formData: data.formData
                    ? ({ ...(existing.formData as Record<string, unknown> || {}), ...data.formData } as Prisma.InputJsonValue)
                    : undefined,
                status: existing.status === 'REJECTED' ? 'DRAFT' : existing.status,
            },
        });

        await auditLogRepository.create({
            actorId: clerkId,
            action: 'UPDATE_ADMISSION',
            entityType: 'AdmissionData',
            entityId: id,
            oldValue: { status: existing.status } as Prisma.JsonValue,
            newValue: { applicantName: updated.applicantName } as Prisma.JsonValue,
        });

        return updated;
    }

    /**
     * Submit admission for review (Clerk)
     */
    async submitAdmission(id: number, clerkId: number) {
        const existing = await prisma.admissionData.findUnique({ where: { id } });
        if (!existing) throw new Error('Admission not found');
        if (existing.status !== 'DRAFT') {
            throw new Error('Can only submit admissions in DRAFT status');
        }

        const updated = await prisma.admissionData.update({
            where: { id },
            data: { status: 'SUBMITTED' },
        });

        await auditLogRepository.create({
            actorId: clerkId,
            action: 'SUBMIT_ADMISSION',
            entityType: 'AdmissionData',
            entityId: id,
            oldValue: { status: 'DRAFT' } as Prisma.JsonValue,
            newValue: { status: 'SUBMITTED' } as Prisma.JsonValue,
        });

        return updated;
    }

    /**
     * Review admission (Admissions Admin) — Approve or Reject
     */
    async reviewAdmission(
        id: number,
        status: 'APPROVED' | 'REJECTED',
        adminId: number,
        reason?: string,
        batchSemester?: number,
        tenantId?: number,
        isLateralEntry?: boolean
    ) {
        const existing = await prisma.admissionData.findUnique({ where: { id } });
        if (!existing) throw new Error('Admission not found');
        if (existing.status !== 'SUBMITTED') {
            throw new Error('Can only review admissions in SUBMITTED status');
        }

        if (status === 'REJECTED' && !reason) {
            throw new Error('Rejection reason is required');
        }

        if (status === 'APPROVED') {
            if (isLateralEntry !== undefined) {
                await prisma.admissionData.update({
                    where: { id },
                    data: { isLateralEntry },
                });
            }
            return this.approveAdmission(id, { ...existing, isLateralEntry: isLateralEntry ?? existing.isLateralEntry }, adminId, batchSemester, tenantId!);
        } else {
            const updated = await prisma.admissionData.update({
                where: { id },
                data: {
                    status: 'REJECTED',
                    rejectionReason: reason,
                    approvedBy: adminId,
                },
            });

            await auditLogRepository.create({
                actorId: adminId,
                action: 'REJECT_ADMISSION',
                entityType: 'AdmissionData',
                entityId: id,
                oldValue: { status: 'SUBMITTED' } as Prisma.JsonValue,
                newValue: { status: 'REJECTED', reason } as Prisma.JsonValue,
            });

            return updated;
        }
    }

    /**
     * Internal: Approve admission — creates student user + profile WITHOUT temporary USN.
     * Temporary USN will be assigned later when department closes admissions.
     */
    private async approveAdmission(id: number, admission: Prisma.AdmissionDataGetPayload<object>, adminId: number, batchSemester?: number, tenantId: number = 0) {
        if (!tenantId) throw new Error('Tenant ID is required for admission approval');
        const admissionYear = admission.admissionYear || new Date().getFullYear();
        const admissionId = await generateAdmissionId(tenantId, admissionYear);

        // Resolve department from branch selection
        let departmentId: number | undefined;
        if (admission.branchSelection) {
            let dept = await prisma.department.findFirst({
                where: {
                    tenantId,
                    OR: [
                        { code: admission.branchSelection },
                        { name: { contains: admission.branchSelection, mode: 'insensitive' as Prisma.QueryMode } },
                    ],
                },
            });

            if (!dept) {
                const code = branchToCode(admission.branchSelection);
                dept = await prisma.department.create({
                    data: {
                        name: admission.branchSelection,
                        code,
                        description: `${admission.branchSelection} Department`,
                        tenantId,
                    },
                });
                log.info({ deptName: dept.name, deptCode: dept.code }, 'Auto-created department');
            }

            departmentId = dept.id;
        }

        if (!departmentId) {
            throw new Error('Branch selection is missing. Please update the branch selection field.');
        }

        const tempEmail = `pending.${admissionId.toLowerCase()}.${Date.now()}@noreply.internal`;
        const tempPasswordHash = await authService.hashPassword(`LOCKED_${Date.now()}`);

        let batch = await prisma.batch.findFirst({ where: { name: String(admissionYear), tenantId } });
        if (!batch) {
            const initialSemester = batchSemester || 1;
            batch = await prisma.batch.create({
                data: { name: String(admissionYear), startYear: admissionYear, currentSemester: initialSemester, tenantId },
            });
        }

        // Check if a student was already created (from a previous partial approval)
        const existingProfile = await prisma.studentProfile.findFirst({
            where: { admissionData: { id } },
            include: { user: true },
        });
        if (existingProfile) {
            await prisma.admissionData.update({
                where: { id },
                data: {
                    admissionId: existingProfile.admissionId || admissionId,
                    status: 'APPROVED',
                    approvedBy: adminId,
                    studentProfileId: existingProfile.id,
                    isLateralEntry: admission.isLateralEntry || false,
                },
            });

            await auditLogRepository.create({
                actorId: adminId,
                action: 'APPROVE_ADMISSION',
                entityType: 'AdmissionData',
                entityId: id,
                newValue: { admissionId: existingProfile.admissionId || admissionId, studentName: admission.applicantName, relinked: true } as Prisma.JsonValue,
            });

            return { admissionId: existingProfile.admissionId || admissionId, studentProfileId: existingProfile.id };
        }

        // Create student user + profile WITHOUT temporary USN
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: tempEmail,
                    passwordHash: tempPasswordHash,
                    name: admission.applicantName,
                    role: 'STUDENT',
                    departmentId,
                    isActive: false,
                    tenantId,
                },
            });

            const profile = await tx.studentProfile.create({
                data: {
                    userId: user.id,
                    rollNumber: admissionId,
                    admissionYear: admissionYear,
                    currentSemester: batch!.currentSemester,
                    optedDepartmentId: departmentId,
                    batchId: batch!.id,
                    temporaryUsn: null,
                    admissionId: admissionId,
                    isLateralEntry: admission.isLateralEntry || false,
                },
            });

            await tx.admissionData.update({
                where: { id },
                data: {
                    admissionId,
                    status: 'APPROVED',
                    approvedBy: adminId,
                    studentProfileId: profile.id,
                },
            });
            return { user, profile };
        });

        // Parent account creation is DEFERRED — will be created when department
        // closes admissions (admission-usn.service.ts). This ensures all emails
        // (student + parent) are sent only after close admission is clicked.
        // Parent details are already stored in admissionData.fatherDetails/motherDetails.

        await auditLogRepository.create({
            actorId: adminId,
            action: 'APPROVE_ADMISSION',
            entityType: 'AdmissionData',
            entityId: id,
            newValue: {
                admissionId,
                status: 'APPROVED',
                studentUserId: result.user.id,
                note: 'Temporary USN pending - will be assigned when department closes admissions',
            } as Prisma.JsonValue,
        });

        return {
            admission: await prisma.admissionData.findUnique({ where: { id } }),
            student: result.user,
            note: 'Student approved but cannot login until department closes admissions and assigns temporary USN',
        };
    }
}

export const admissionCoreService = new AdmissionCoreService();
