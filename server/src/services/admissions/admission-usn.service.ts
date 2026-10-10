/**
 * Admission USN Service
 * ──────────────────────────────────────
 * Handles department admission closure, USN allocation (temporary + permanent),
 * department admission status, and reopening.
 *
 * Extracted from admissions.service.ts (lines 605-1060)
 */
import { Prisma } from '@prisma/client';
import prisma from '../../data-access/prisma.js';
import { auditLogRepository } from '../../data-access/index.js';
import { authService } from '../auth.service.js';
import { parentService } from '../parent.service.js';
import {
    log,
    generateStudentPassword,
} from './shared.js';

class AdmissionUsnService {
    /**
     * Close admissions for a department and allocate temporary USNs alphabetically.
     * Optimized: batch USN generation, batch email checks, pre-hashed passwords.
     */
    async closeAdmissionsForDepartment(departmentId: number, adminId: number, tenantId?: number) {
        const department = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!department) throw new Error('Department not found');
        if (tenantId && department.tenantId !== tenantId) throw new Error('Department does not belong to your tenant');
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
                user: { name: 'asc' },
            },
        });

        const regularStudents = studentsWithoutUsn.filter(s => !s.isLateralEntry);
        const lateralStudents = studentsWithoutUsn.filter(s => s.isLateralEntry);

        if (studentsWithoutUsn.length === 0) {
            log.info({ departmentId, departmentName: department.name }, 'No students pending USN allocation, closing admissions anyway');
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
                    studentsAllocated: 0,
                    closedAt: new Date().toISOString(),
                } as Prisma.JsonValue,
            });

            return {
                message: `Admissions closed for ${department.name}. No students were pending USN allocation.`,
                department: department.name,
                allocatedCount: 0,
                students: [],
            };
        }

        const deptCode = department.code || 'GEN';

        // ═══════════════════════════════════════════════════════════════
        // PERFORMANCE: Pre-compute everything ONCE before the loops
        // ═══════════════════════════════════════════════════════════════

        // 1. Pre-hash passwords ONCE (student + parent)
        const sampleBatchYear = regularStudents[0]?.admissionYear || lateralStudents[0]?.admissionYear || new Date().getFullYear();
        const sharedStudentPassword = generateStudentPassword(deptCode, sampleBatchYear);
        const [sharedPasswordHash, parentPasswordHash] = await Promise.all([
            authService.hashPassword(sharedStudentPassword),
            authService.hashPassword('Parent@123'),
        ]);

        // 2. Tenant slug (single query)
        const tenantForEmail = await prisma.tenant.findUnique({
            where: { id: department.tenantId },
            select: { slug: true },
        });

        // 3. Batch USN generation: find highest existing USN numbers in one query each
        const prefix = deptCode.toUpperCase();
        const lateralPrefix = `L${prefix}`;

        const [existingRegularUsns, existingLateralUsns] = await Promise.all([
            prisma.studentProfile.findMany({
                where: {
                    temporaryUsn: { startsWith: prefix },
                    user: { tenantId: department.tenantId },
                },
                select: { temporaryUsn: true },
            }),
            prisma.studentProfile.findMany({
                where: {
                    temporaryUsn: { startsWith: lateralPrefix },
                    user: { tenantId: department.tenantId },
                },
                select: { temporaryUsn: true },
            }),
        ]);

        // Build sets for O(1) collision checks
        const usedRegularUsns = new Set(existingRegularUsns.map(u => u.temporaryUsn).filter(Boolean));
        const usedLateralUsns = new Set(existingLateralUsns.map(u => u.temporaryUsn).filter(Boolean));

        // Find max existing number for each prefix
        let nextRegularNum = 1;
        for (const usn of usedRegularUsns) {
            const match = usn!.match(new RegExp(`^${prefix}(\\d+)$`));
            if (match) nextRegularNum = Math.max(nextRegularNum, parseInt(match[1]) + 1);
        }

        let nextLateralNum = 1;
        for (const usn of usedLateralUsns) {
            const match = usn!.match(new RegExp(`^${lateralPrefix}(\\d+)$`));
            if (match) nextLateralNum = Math.max(nextLateralNum, parseInt(match[1]) + 1);
        }

        // 4. Batch email resolution: fetch ALL existing emails in this tenant once
        const existingEmails = await prisma.user.findMany({
            where: { tenantId: department.tenantId },
            select: { id: true, email: true },
        });
        const emailSet = new Set(existingEmails.map(u => u.email.toLowerCase()));
        const emailIdMap = new Map(existingEmails.map(u => [u.email.toLowerCase(), u.id]));

        // In-memory unique email resolver (no DB calls)
        function resolveEmailInMemory(
            admissionEmail: string | undefined | null,
            tempUsn: string,
            studentUserId: number,
        ): string {
            const candidate = admissionEmail?.trim()?.toLowerCase();
            if (candidate) {
                const existingId = emailIdMap.get(candidate);
                if (!existingId || existingId === studentUserId) {
                    emailSet.add(candidate);
                    emailIdMap.set(candidate, studentUserId);
                    return candidate;
                }
            }
            const usnEmail = `${tempUsn.toLowerCase()}@noreply.internal`;
            const existingUsnId = emailIdMap.get(usnEmail);
            if (!existingUsnId || existingUsnId === studentUserId) {
                emailSet.add(usnEmail);
                emailIdMap.set(usnEmail, studentUserId);
                return usnEmail;
            }
            const fallback = `${tempUsn.toLowerCase()}.${Date.now()}@noreply.internal`;
            emailSet.add(fallback);
            emailIdMap.set(fallback, studentUserId);
            return fallback;
        }

        // In-memory USN generator (no DB calls per student)
        function getNextRegularUsn(): string {
            let candidate = `${prefix}${nextRegularNum.toString().padStart(3, '0')}`;
            while (usedRegularUsns.has(candidate)) {
                nextRegularNum++;
                candidate = `${prefix}${nextRegularNum.toString().padStart(3, '0')}`;
            }
            usedRegularUsns.add(candidate);
            nextRegularNum++;
            return candidate;
        }

        function getNextLateralUsn(): string {
            let candidate = `${lateralPrefix}${nextLateralNum.toString().padStart(3, '0')}`;
            while (usedLateralUsns.has(candidate)) {
                nextLateralNum++;
                candidate = `${lateralPrefix}${nextLateralNum.toString().padStart(3, '0')}`;
            }
            usedLateralUsns.add(candidate);
            nextLateralNum++;
            return candidate;
        }

        // ═══════════════════════════════════════════════════════════════
        // PROCESS STUDENTS (no per-row DB lookups needed now)
        // ═══════════════════════════════════════════════════════════════

        const allocatedStudents: any[] = [];
        const failedStudents: { studentName: string; error: string }[] = [];

        // Helper to process a single student (shared by regular + lateral)
        const processStudent = async (
            student: typeof studentsWithoutUsn[0],
            isLateral: boolean,
        ) => {
            const temporaryUsn = isLateral ? getNextLateralUsn() : getNextRegularUsn();
            const tempPassword = generateStudentPassword(deptCode, student.admissionYear || sampleBatchYear);
            const passwordHash = (student.admissionYear === sampleBatchYear)
                ? sharedPasswordHash
                : await authService.hashPassword(tempPassword);

            // Resolve email in-memory
            let studentEmail = student.admissionData?.emailId;
            if (!studentEmail && student.admissionData?.formData) {
                const fd = student.admissionData.formData as Record<string, unknown>;
                studentEmail = (fd.emailId || fd.email || fd.studentEmail) as string | undefined;
            }
            let email = resolveEmailInMemory(studentEmail, temporaryUsn, student.userId);

            // Update student profile and user in transaction with P2002 retry
            let retries = 3;
            let currentUsn = temporaryUsn;
            while (retries >= 0) {
                try {
                    await prisma.$transaction(async (tx) => {
                        await tx.studentProfile.update({
                            where: { id: student.id },
                            data: {
                                temporaryUsn: currentUsn,
                                rollNumber: currentUsn,
                            },
                        });

                        await tx.user.update({
                            where: { id: student.userId },
                            data: {
                                email,
                                passwordHash,
                                isActive: true,
                            },
                        });
                    });
                    break;
                } catch (txError) {
                    if (txError instanceof Prisma.PrismaClientKnownRequestError && txError.code === 'P2002' && retries > 0) {
                        const target = txError.meta?.target as string[] | undefined;
                        const field = target?.[0] || '';
                        log.warn({ field, target, studentId: student.id, retries }, 'P2002 during close admissions, retrying');

                        if (field === 'email' || target?.includes('tenantId_email') || field.includes('email')) {
                            email = `${currentUsn.toLowerCase()}.${Date.now()}@noreply.internal`;
                        } else if (field === 'roll_number' || field === 'temporary_usn' || field.includes('usn') || field.includes('roll')) {
                            currentUsn = isLateral ? getNextLateralUsn() : getNextRegularUsn();
                        } else {
                            email = `${currentUsn.toLowerCase()}.${Date.now()}@noreply.internal`;
                            currentUsn = `${isLateral ? 'L' : ''}${deptCode.toUpperCase()}${Date.now().toString().slice(-6)}`;
                        }
                        retries--;
                    } else {
                        throw txError;
                    }
                }
            }

            allocatedStudents.push({
                studentName: student.user.name,
                temporaryUsn: currentUsn,
                email,
                tempPassword,
                ...(isLateral ? { isLateralEntry: true } : {}),
            });
        };

        // Process regular students
        for (const student of regularStudents) {
            try {
                await processStudent(student, false);
            } catch (studentError) {
                const errMsg = studentError instanceof Error ? studentError.message : String(studentError);
                log.error({ studentId: student.id, studentName: student.user.name, error: errMsg }, 'Failed to process student during close admissions (continuing)');
                failedStudents.push({ studentName: student.user.name, error: errMsg });
            }
        }

        // Process lateral students
        for (const student of lateralStudents) {
            try {
                await processStudent(student, true);
            } catch (studentError) {
                const errMsg = studentError instanceof Error ? studentError.message : String(studentError);
                log.error({ studentId: student.id, studentName: student.user.name, error: errMsg }, 'Failed to process lateral student during close admissions (continuing)');
                failedStudents.push({ studentName: student.user.name, error: errMsg });
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // PARENT ACCOUNT CREATION (password pre-hashed, no per-row hash)
        // ═══════════════════════════════════════════════════════════════
        let parentsCreated = 0;
        const tenantSlug = tenantForEmail?.slug || 'hub';

        for (const student of studentsWithoutUsn) {
            try {
                const admission = student.admissionData;
                if (!admission) continue;

                const fDetails = (admission.fatherDetails || {}) as Record<string, string>;
                const mDetails = (admission.motherDetails || {}) as Record<string, string>;

                const fatherMobile = fDetails.mobile || '';
                const motherMobile = mDetails.mobile || '';

                let parentPhone: string;
                let parentName: string;
                let parentRealEmail: string;
                let relationship: string;

                if (fatherMobile && motherMobile) {
                    parentPhone = fatherMobile;
                    parentName = fDetails.name || `Parent of ${student.user.name}`;
                    parentRealEmail = fDetails.email || '';
                    relationship = 'FATHER';
                } else {
                    parentPhone = fatherMobile || motherMobile;
                    parentName = fatherMobile
                        ? (fDetails.name || `Parent of ${student.user.name}`)
                        : (mDetails.name || `Parent of ${student.user.name}`);
                    parentRealEmail = fatherMobile
                        ? (fDetails.email || '')
                        : (mDetails.email || '');
                    relationship = fatherMobile ? 'FATHER' : 'MOTHER';
                }

                if (parentPhone) {
                    const admissionId = student.admissionId || student.rollNumber || `STU${student.id}`;
                    const parentResult = await parentService.createParentAccount({
                        studentProfileId: student.id,
                        studentAdmissionId: admissionId,
                        tenantId: department.tenantId,
                        parentName,
                        parentPhone,
                        parentEmail: parentRealEmail,
                        relationship,
                        tenantSlug,
                        preHashedPassword: parentPasswordHash, // Pre-computed — no per-parent hashing
                    });
                    if (parentResult) {
                        parentsCreated++;
                        log.info({ parentEmail: parentResult.email, studentName: student.user.name }, 'Parent account created during close admission');
                    }
                }
            } catch (parentErr) {
                log.warn({
                    studentId: student.id,
                    studentName: student.user.name,
                    error: parentErr instanceof Error ? parentErr.message : String(parentErr),
                }, 'Parent account creation failed during close admission (non-blocking)');
            }
        }

        // No emails sent — student passwords are shared offline, parent credentials are viewed by mentors
        log.info({ deptCode, sharedPassword: sharedStudentPassword, studentCount: allocatedStudents.length },
            'Students assigned branch+batch password. Parent accounts created with default password. No emails sent.');

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
                studentsFailed: failedStudents.length,
                parentsCreated,
                closedAt: new Date().toISOString(),
            } as Prisma.JsonValue,
        });

        const failedMsg = failedStudents.length > 0
            ? ` WARNING: ${failedStudents.length} student(s) failed to process.`
            : '';

        return {
            message: `Admissions closed for ${department.name}. Allocated temporary USNs to ${allocatedStudents.length} students. Created ${parentsCreated} parent accounts.${failedMsg}`,
            department: department.name,
            allocatedCount: allocatedStudents.length,
            failedCount: failedStudents.length,
            failedStudents,
            parentsCreated,
            students: allocatedStudents,
        };
    }

    /**
     * Reopen admissions for a department (for late entries)
     */
    async reopenAdmissionsForDepartment(departmentId: number, adminId: number, tenantId?: number) {
        const department = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!department) throw new Error('Department not found');
        if (tenantId && department.tenantId !== tenantId) throw new Error('Department does not belong to your tenant');
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

    /**
     * Get department admission status — tenant-scoped
     */
    async getDepartmentAdmissionStatus(tenantId: number) {
        const departments = await prisma.department.findMany({
            where: {
                tenantId,
                isCycleDepartment: false,
            },
            select: {
                id: true,
                name: true,
                code: true,
                isAdmissionOpen: true,
                admissionClosedAt: true,
            },
        });

        // Single aggregate query instead of N+1 individual counts per department
        const deptIds = departments.map(d => d.id);
        const pendingCounts = await prisma.studentProfile.groupBy({
            by: ['optedDepartmentId'],
            where: {
                optedDepartmentId: { in: deptIds },
                temporaryUsn: null,
            },
            _count: { id: true },
        });

        // Build lookup map for O(1) access
        const countMap = new Map(
            pendingCounts.map(c => [c.optedDepartmentId, c._count.id])
        );

        return departments.map(dept => ({
            ...dept,
            studentsAwaitingUsn: countMap.get(dept.id) ?? 0,
        }));
    }

    /**
     * Assign permanent USN — tenant-scoped
     */
    async assignPermanentUsn(studentProfileId: number, permanentUsn: string, adminId: number, tenantId?: number) {
        const profile = await prisma.studentProfile.findUnique({
            where: { id: studentProfileId },
            include: { user: true },
        });
        if (!profile) throw new Error('Student profile not found');
        if (tenantId && profile.user.tenantId !== tenantId) throw new Error('Student does not belong to your tenant');
        if (profile.isPermanentUsnLocked) {
            throw new Error('Permanent USN is already locked and cannot be changed');
        }

        // Check USN uniqueness within tenant
        const existing = await prisma.studentProfile.findFirst({
            where: { permanentUsn, id: { not: studentProfileId }, user: { tenantId: tenantId || profile.user.tenantId } },
        });
        if (existing) throw new Error(`Permanent USN ${permanentUsn} is already assigned to another student`);

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
}

export const admissionUsnService = new AdmissionUsnService();
