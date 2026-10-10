import { AdmissionStatus, Prisma } from '@prisma/client';
import prisma from '../data-access/prisma.js';
import { auditLogRepository } from '../data-access/index.js';
import { authService } from './auth.service.js';
import { emailService } from './email.service.js';
import { logger } from '../utils/logger.js';
import { randomInt } from 'crypto';

const log = logger.child({ module: 'admissions' });

// Generate next admission ID (ADM000001, ADM000002, ...)
async function generateAdmissionId(): Promise<string> {
    const last = await prisma.admissionData.findFirst({
        orderBy: { id: 'desc' },
        select: { admissionId: true },
    });

    let nextNum = 1;
    if (last?.admissionId) {
        const match = last.admissionId.match(/ADM(\d+)/);
        if (match) nextNum = parseInt(match[1]) + 1;
    }
    return `ADM${nextNum.toString().padStart(6, '0')}`;
}

// Generate temporary USN based on department code and sequence
async function generateTemporaryUsn(departmentCode: string): Promise<string> {
    // Use full department code (e.g., CSE, IS, ECE) instead of just first 2 chars
    const prefix = departmentCode.toUpperCase();
    const count = await prisma.studentProfile.count({
        where: {
            temporaryUsn: { startsWith: prefix },
        },
    });
    return `${prefix}${(count + 1).toString().padStart(3, '0')}`;
}

export interface CreateAdmissionInput {
    applicantName: string;
    applyingThrough?: string;
    gender?: string;
    bloodGroup?: string;
    dateOfBirth?: string;
    nationality?: string;
    religion?: string;
    category?: string;
    subCaste?: string;
    motherTongue?: string;
    speciallyAbled?: boolean;
    aadhaarNumber?: string;
    emailId?: string;
    mobileNumber?: string;
    hostel?: boolean;
    pickupPlace?: string;
    permanentAddress?: any;
    localAddress?: any;
    fatherDetails?: any;
    motherDetails?: any;
    branchSelection?: string;
    cetRollNo?: string;
    cetRank?: string;
    cetAllottedCategory?: string;
    comedkRollNo?: string;
    comedkRank?: string;
    sslcDetails?: any;
    pucDetails?: any;
    subjectWiseMarks?: any;
    documents?: any;
    howDidYouKnow?: string;
    applicantDeclaration?: boolean;
    parentDeclaration?: boolean;
    admissionYear?: number;
    formData?: Record<string, any>;  // Dynamic form field values
}

class AdmissionsService {
    // Helper: convert branch name to short department code
    private branchToCode(branch: string): string {
        const map: Record<string, string> = {
            'CSE': 'CSE', 'ISE': 'ISE', 'ECE': 'ECE', 'CIVIL': 'CIVIL', 'MECH.': 'MECH',
            'CS & BS': 'CSBS', 'CSE (AI)': 'CSEAI', 'CSE (AI&ML)': 'CSEAIML',
            'CSE (DS)': 'CSEDS', 'Comp.Engg.': 'CE',
            'CSE (IOT & Cyber Security Including Block Chain Tech.)': 'CSEIOT',
        };
        return map[branch] || branch.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8);
    }

    // Get all approved students with batch/department info
    async getApprovedStudents() {
        const students = await prisma.studentProfile.findMany({
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
        });
        return students;
    }

    // Create admission entry (by Admin Clerk)
    // Uses a temporary APP reference — real ADM number assigned only on approval
    async createAdmission(data: CreateAdmissionInput, clerkId: number) {
        // Generate a temporary application reference (not the real admission ID)
        const appRef = `APP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        const admission = await prisma.admissionData.create({
            data: {
                admissionId: appRef, // Temporary reference — real ADM ID assigned on approval
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
                documents: data.documents as Prisma.InputJsonValue,
                howDidYouKnow: data.howDidYouKnow,
                applicantDeclaration: data.applicantDeclaration || false,
                parentDeclaration: data.parentDeclaration || false,
                admissionYear: data.admissionYear,
                formData: data.formData ? (data.formData as Prisma.InputJsonValue) : undefined,
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

    // Update admission (by Clerk, only if DRAFT or REJECTED)
    async updateAdmission(id: number, data: Partial<CreateAdmissionInput>, clerkId: number) {
        const existing = await prisma.admissionData.findUnique({ where: { id } });
        if (!existing) throw new Error('Admission not found');
        if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
            throw new Error('Can only edit admissions in DRAFT or REJECTED status');
        }

        // Allow any ADMISSIONS_ADMIN or ADMIN_CLERK to edit DRAFT/REJECTED admissions
        // No ownership check needed - clerks can help each other with drafts


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
                documents: data.documents as Prisma.InputJsonValue,
                formData: data.formData
                    ? ({ ...(existing.formData as Record<string, any> || {}), ...data.formData } as Prisma.InputJsonValue)
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

    // Submit admission for review (Clerk)
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

    // Review admission (Admissions Admin) - Approve or Reject
    async reviewAdmission(
        id: number,
        status: 'APPROVED' | 'REJECTED',
        adminId: number,
        reason?: string,
        batchSemester?: number,
        tenantId: number = 1
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
            // Create student account and assign temporary USN
            return this.approveAdmission(id, existing, adminId, batchSemester, tenantId);
        } else {
            // Reject - send back to clerk
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

    // Internal: Approve admission - creates student user + profile WITHOUT temporary USN
    // Temporary USN will be assigned later when department closes admissions
    private async approveAdmission(id: number, admission: any, adminId: number, batchSemester?: number, tenantId: number = 1) {
        // Generate the REAL admission ID now (on approval)
        const admissionId = await generateAdmissionId();

        // Resolve department from branch selection
        let departmentId: number | undefined;
        if (admission.branchSelection) {
            // Try to find existing department by code or name
            let dept = await prisma.department.findFirst({
                where: {
                    OR: [
                        { code: admission.branchSelection },
                        { name: { contains: admission.branchSelection, mode: 'insensitive' as Prisma.QueryMode } },
                    ],
                },
            });

            // Auto-create department if not found
            if (!dept) {
                const branchCode = this.branchToCode(admission.branchSelection);
                dept = await prisma.department.create({
                    data: {
                        name: admission.branchSelection,
                        code: branchCode,
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

        // Generate a temporary placeholder email (will be updated when USN is assigned)
        const tempEmail = `pending.${admissionId.toLowerCase()}.${Date.now()}@student.edu`;

        // NO password generation here - student cannot login until USN is assigned
        const tempPasswordHash = await authService.hashPassword(`LOCKED_${Date.now()}`);

        // Use admission year from form data, or fall back to current year
        const admissionYear = admission.admissionYear || new Date().getFullYear();

        // Find or create batch for this admission year
        let batch = await prisma.batch.findFirst({ where: { name: String(admissionYear) } });
        if (!batch) {
            const initialSemester = batchSemester || 1;
            batch = await prisma.batch.create({
                data: { name: String(admissionYear), startYear: admissionYear, currentSemester: initialSemester, tenantId },
            });
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
                    rollNumber: admissionId, // Use admission ID as temporary roll number
                    admissionYear: admissionYear,
                    currentSemester: batch!.currentSemester,
                    optedDepartmentId: departmentId,
                    batchId: batch!.id,
                    temporaryUsn: null, // Will be assigned when department closes admissions
                    admissionId: admissionId,
                },
            });

            // Link admission data to student profile and assign real admission ID
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

    // ============================================
    // DEPARTMENT ADMISSION CLOSURE & USN ALLOCATION
    // ============================================

    // Close admissions for a department and allocate temporary USNs alphabetically
    async closeAdmissionsForDepartment(departmentId: number, adminId: number) {
        const department = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!department) throw new Error('Department not found');
        if (!department.isAdmissionOpen) {
            throw new Error('Admissions are already closed for this department');
        }

        // Fetch all approved students without temporary USN for this department
        const studentsWithoutUsn = await prisma.studentProfile.findMany({
            where: {
                optedDepartmentId: departmentId,
                temporaryUsn: null,
            },
            include: {
                user: true,
                admissionData: true,
            },
            orderBy: {
                user: { name: 'asc' }, // Sort alphabetically by name
            },
        });

        if (studentsWithoutUsn.length === 0) {
            throw new Error('No students pending temporary USN allocation for this department');
        }

        const deptCode = department.code || 'GEN';

        // Student password = branch code + batch year (e.g. CSE2023)
        // All students in same department share the same general password
        const batchYear = studentsWithoutUsn[0]?.admissionYear || new Date().getFullYear();
        const tempPassword = `${deptCode.toUpperCase()}${batchYear}`;
        const passwordHash = await authService.hashPassword(tempPassword);

        // Allocate USNs in alphabetical order
        const allocatedStudents = [];
        for (const student of studentsWithoutUsn) {
            const temporaryUsn = await generateTemporaryUsn(deptCode);

            // Generate email based on USN or use existing admission email
            let email = student.admissionData?.emailId || `${temporaryUsn.toLowerCase()}@student.edu`;

            // Check email uniqueness
            const existingEmail = await prisma.user.findFirst({ where: { email } });
            if (existingEmail && existingEmail.id !== student.userId) {
                email = `${temporaryUsn.toLowerCase()}@student.edu`;
                const existingGenerated = await prisma.user.findFirst({ where: { email } });
                if (existingGenerated && existingGenerated.id !== student.userId) {
                    email = `${temporaryUsn.toLowerCase()}.${Date.now()}@student.edu`;
                }
            }

            // Update student profile and user in transaction
            await prisma.$transaction(async (tx) => {
                await tx.studentProfile.update({
                    where: { id: student.id },
                    data: {
                        temporaryUsn,
                        rollNumber: temporaryUsn,
                    },
                });

                await tx.user.update({
                    where: { id: student.userId },
                    data: {
                        email,
                        passwordHash,
                        isActive: true, // Activate student account
                    },
                });
            });

            allocatedStudents.push({
                studentName: student.user.name,
                temporaryUsn,
                email,
            });

            // NO email sent to students — they use branch+batch password (e.g. CSE2023)
            // Students receive their password offline/verbally
        }

        // Mark department admissions as closed
        await prisma.department.update({
            where: { id: departmentId },
            data: {
                isAdmissionOpen: false,
                admissionClosedAt: new Date(),
            },
        });

        await auditLogRepository.create({
            actorId: adminId,
            action: 'CLOSE_DEPARTMENT_ADMISSIONS',
            entityType: 'Department',
            entityId: departmentId,
            newValue: {
                departmentName: department.name,
                studentsAllocated: allocatedStudents.length,
                closedAt: new Date().toISOString(),
            } as Prisma.JsonValue,
        });

        return {
            message: `Admissions closed for ${department.name}. Allocated temporary USNs to ${allocatedStudents.length} students.`,
            department: department.name,
            allocatedCount: allocatedStudents.length,
            students: allocatedStudents,
        };
    }

    // Reopen admissions for a department (for late entries)
    async reopenAdmissionsForDepartment(departmentId: number, adminId: number) {
        const department = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!department) throw new Error('Department not found');
        if (department.isAdmissionOpen) {
            throw new Error('Admissions are already open for this department');
        }

        await prisma.department.update({
            where: { id: departmentId },
            data: {
                isAdmissionOpen: true,
                admissionClosedAt: null,
            },
        });

        await auditLogRepository.create({
            actorId: adminId,
            action: 'REOPEN_DEPARTMENT_ADMISSIONS',
            entityType: 'Department',
            entityId: departmentId,
            newValue: {
                departmentName: department.name,
                reopenedAt: new Date().toISOString(),
            } as Prisma.JsonValue,
        });

        return {
            message: `Admissions reopened for ${department.name}`,
            department: department.name,
        };
    }

    // Get department admission status
    async getDepartmentAdmissionStatus() {
        const departments = await prisma.department.findMany({
            where: {
                isCycleDepartment: false, // Exclude cycle departments (PHY/CHEM)
            },
            select: {
                id: true,
                name: true,
                code: true,
                isAdmissionOpen: true,
                admissionClosedAt: true,
            },
        });

        const statusList = await Promise.all(
            departments.map(async (dept) => {
                const pendingCount = await prisma.studentProfile.count({
                    where: {
                        optedDepartmentId: dept.id,
                        temporaryUsn: null,
                    },
                });

                return {
                    ...dept,
                    studentsAwaitingUsn: pendingCount,
                };
            })
        );

        return statusList;
    }

    // Assign Permanent USN (Admissions Admin only)
    async assignPermanentUsn(studentProfileId: number, permanentUsn: string, adminId: number) {
        const profile = await prisma.studentProfile.findUnique({
            where: { id: studentProfileId },
            include: { user: true },
        });
        if (!profile) throw new Error('Student profile not found');
        if (profile.isPermanentUsnLocked) {
            throw new Error('Permanent USN is already locked and cannot be changed');
        }

        // Check USN uniqueness
        const existing = await prisma.studentProfile.findFirst({
            where: { permanentUsn, id: { not: studentProfileId } },
        });
        if (existing) throw new Error(`Permanent USN ${permanentUsn} is already assigned to another student`);

        // Update the login identifier without changing the existing password.
        await prisma.studentProfile.update({
            where: { id: studentProfileId },
            data: {
                permanentUsn,
                isPermanentUsnLocked: true,
                rollNumber: permanentUsn,
            },
        });

        await auditLogRepository.create({
            actorId: adminId,
            action: 'ASSIGN_PERMANENT_USN',
            entityType: 'StudentProfile',
            entityId: studentProfileId,
            oldValue: { temporaryUsn: profile.temporaryUsn, rollNumber: profile.rollNumber } as Prisma.JsonValue,
            newValue: { permanentUsn, rollNumber: permanentUsn } as Prisma.JsonValue,
        });

        return { permanentUsn, studentProfileId };
    }

    // List admissions with filters
    async getAdmissions(filters: {
        status?: AdmissionStatus;
        search?: string;
        skip?: number;
        take?: number;
        enteredBy?: number;
    }) {
        const where: Prisma.AdmissionDataWhereInput = {};

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

    // Get single admission by ID
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

    // Create Admin Clerk (Admissions Admin creates clerks)
    async createAdminClerk(data: { email: string; name: string }, adminId: number, tenantId: number = 1) {
        const existing = await prisma.user.findFirst({ where: { email: data.email, tenantId } });
        if (existing) throw new Error('Email already registered');

        const password = this.generatePassword();
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

        // Look up tenant slug for login URL
        const tenantForClerk = await prisma.tenant.findUnique({
            where: { id: clerk.tenantId },
            select: { slug: true },
        });

        // Send welcome email in background (non-blocking)
        emailService.sendWelcomeEmail(data.email, data.name, 'Admin Clerk', password, tenantForClerk?.slug)
            .catch(err => console.error('Clerk welcome email failed:', err));

        return { user: clerkWithoutPassword, password };
    }

    // Get admin clerks
    async getAdminClerks() {
        return prisma.user.findMany({
            where: { role: 'ADMIN_CLERK' },
            select: { id: true, email: true, name: true, isActive: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    // Get dashboard stats
    async getDashboardStats() {
        const [totalAdmissions, draft, submitted, approved, rejected, totalStudents, pendingUsn] = await Promise.all([
            prisma.admissionData.count(),
            prisma.admissionData.count({ where: { status: 'DRAFT' } }),
            prisma.admissionData.count({ where: { status: 'SUBMITTED' } }),
            prisma.admissionData.count({ where: { status: 'APPROVED' } }),
            prisma.admissionData.count({ where: { status: 'REJECTED' } }),
            prisma.studentProfile.count(),
            prisma.uSNRequest.count({ where: { status: 'PENDING' } }),
        ]);

        return { totalAdmissions, draft, submitted, approved, rejected, totalStudents, pendingUsn };
    }

    private generatePassword(length = 12): string {
        const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I, O
        const lowercase = 'abcdefghjkmnpqrstuvwxyz';   // Exclude i, l, o
        const numbers = '23456789';                    // Exclude 0, 1
        const allChars = uppercase + lowercase + numbers;

        const chars: string[] = [];
        // Ensure at least one of each type
        chars.push(uppercase[randomInt(uppercase.length)]);
        chars.push(lowercase[randomInt(lowercase.length)]);
        chars.push(numbers[randomInt(numbers.length)]);

        // Fill the rest with random characters
        for (let i = chars.length; i < length; i++) {
            chars.push(allChars[randomInt(allChars.length)]);
        }

        // Fisher-Yates shuffle
        for (let i = chars.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }

        return chars.join('');
    }

    // ============================================
    // Student Info Edit (Post-Approval)
    // ============================================

    // Admin/Super Admin directly updates student info
    async updateStudentInfo(userId: number, data: any, editedBy?: number, reason?: string) {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
            include: { admissionData: true },
        });

        if (!profile) throw new Error('Student profile not found');

        // Update user name if provided
        if (data.name) {
            await prisma.user.update({ where: { id: userId }, data: { name: data.name } });
        }

        // Update admission data
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

        // Log the edit for audit trail
        log.info({ userId, editedBy, reason }, 'Student info edited');

        return { message: 'Student info updated successfully' };
    }

    // Clerk creates an edit request
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

    // Get edit requests
    async getEditRequests(status: string = 'PENDING') {
        return prisma.studentEditRequest.findMany({
            where: { status },
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
        });
    }

    // Approve edit request — applies the proposed changes
    async approveEditRequest(id: number, adminId: number, reviewNote?: string) {
        const request = await prisma.studentEditRequest.findUnique({
            where: { id },
            include: { studentProfile: { include: { admissionData: true } } },
        });

        if (!request) throw new Error('Edit request not found');
        if (request.status !== 'PENDING') throw new Error('Edit request already reviewed');

        const changes = request.proposedChanges as Record<string, unknown>;

        // Apply changes to user and admission data
        await this.updateStudentInfo(request.studentProfile.userId, changes);

        // Mark request as approved
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

    // Reject edit request
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

    // ============================================
    // Branch Change
    // ============================================

    async changeBranch(userId: number, newBranch: string, adminId: number) {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
            include: { admissionData: true },
        });

        if (!profile) throw new Error('Student profile not found');

        // Resolve new department from branch name
        const newDept = await prisma.department.findFirst({
            where: {
                OR: [
                    { code: newBranch },
                    { name: { contains: newBranch, mode: 'insensitive' as Prisma.QueryMode } },
                ],
            },
        });

        if (!newDept) throw new Error(`Cannot resolve department for branch: ${newBranch}`);

        const oldBranch = profile.admissionData?.branchSelection || 'Unknown';

        // Update student profile department
        await prisma.studentProfile.update({
            where: { id: profile.id },
            data: { optedDepartmentId: newDept.id },
        });

        // Update user department
        await prisma.user.update({
            where: { id: userId },
            data: { departmentId: newDept.id },
        });

        // Update admission data branch selection
        if (profile.admissionData) {
            await prisma.admissionData.update({
                where: { id: profile.admissionData.id },
                data: { branchSelection: newBranch },
            });
        }

        // If permanent USN exists, generate a new one for new dept
        let newUsn: string | undefined;
        if (profile.permanentUsn) {
            const newTempUsn = await generateTemporaryUsn(newDept.code || 'GEN');
            await prisma.studentProfile.update({
                where: { id: profile.id },
                data: {
                    rollNumber: newTempUsn,
                    permanentUsn: null,  // Reset — admin will need to assign a new permanent USN
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
}

export const admissionsService = new AdmissionsService();
