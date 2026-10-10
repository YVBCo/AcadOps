import { User, UserRole, Prisma } from '@prisma/client';
import { userRepository, auditLogRepository, departmentRepository, batchRepository, UpdateUserData } from '../data-access/index.js';
import { prisma } from '../data-access/prisma.js';
import { authService } from './auth.service.js';
import { emailService } from './email.service.js';
import cacheService from './cache.service.js';
import { logger } from '../utils/logger.js';
import { randomInt } from 'crypto';

const log = logger.child({ module: 'user' });

interface CreateUserInput {
    email: string;
    password: string;
    name: string;
    role: UserRole;
    departmentId?: number;
    tenantId: number;
}

class UserService {
    /** Create a company login and link its placement profile atomically. */
    async createPlacementCompanyAccount(
        data: { email: string; name: string; companyName: string; phone?: string; website?: string; industry?: string; description?: string; address?: string; tenantId: number },
        actorId: number,
    ): Promise<{ user: User; company: Awaited<ReturnType<typeof prisma.placementCompany.create>>; emailSent: boolean }> {
        const email = data.email.trim().toLowerCase();
        const existingUser = await userRepository.findByTenantEmail(email, data.tenantId);
        if (existingUser) throw new Error('Email already registered in this institution');

        const password = this.generateSecurePassword();
        const passwordHash = await authService.hashPassword(password);
        const { user, company } = await prisma.$transaction(async (tx) => {
            const createdUser = await tx.user.create({
                data: { email, passwordHash, name: data.name.trim(), role: 'PLACEMENT_COMPANY', tenantId: data.tenantId },
            });
            const existingProfile = await tx.placementCompany.findUnique({
                where: { tenantId_email: { tenantId: data.tenantId, email } },
            });
            if (existingProfile?.userId) throw new Error('A company account is already linked to this email');

            const profileData = {
                name: data.companyName.trim(), email, phone: data.phone?.trim() || null,
                website: data.website?.trim() || null, industry: data.industry?.trim() || null,
                description: data.description?.trim() || null, address: data.address?.trim() || null,
                userId: createdUser.id,
            };
            const createdCompany = existingProfile
                ? await tx.placementCompany.update({ where: { id: existingProfile.id }, data: profileData })
                : await tx.placementCompany.create({ data: { ...profileData, tenantId: data.tenantId } });
            return { user: createdUser, company: createdCompany };
        });

        await auditLogRepository.create({
            actorId,
            action: 'CREATE_USER',
            entityType: 'User',
            entityId: user.id,
            newValue: { email: user.email, name: user.name, role: user.role, companyId: company.id } as Prisma.JsonValue,
        });

        const tenant = await prisma.tenant.findUnique({ where: { id: data.tenantId }, select: { slug: true } });
        let emailSent = true;
        await emailService.sendWelcomeEmail(
            email, user.name, this.getRoleLabel(user.role), password, tenant?.slug,
            { tenantId: data.tenantId, userId: user.id },
        ).catch((err) => {
            emailSent = false;
            log.error({ err, email }, 'Placement company welcome email failed');
        });

        return { user, company, emailSent };
    }

    // Create user (Admin only)
    async create(data: CreateUserInput, actorId: number): Promise<User> {
        // Check if email already exists within this tenant
        const existing = await userRepository.findByTenantEmail(data.email, data.tenantId);
        if (existing) {
            throw new Error('Email already registered in this institution');
        }

        // Tenant type restriction: COE and FYC roles are only for ENGINEERING-type tenants
        const RESTRICTED_ROLES: UserRole[] = ['COE', 'FIRST_YEAR_COORDINATOR'];
        const NON_COE_TENANT_TYPES = ['DEGREE', 'MBA', 'MCA', 'LAW'];
        if (RESTRICTED_ROLES.includes(data.role)) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: data.tenantId },
                select: { type: true },
            });
            if (tenant && NON_COE_TENANT_TYPES.includes(tenant.type)) {
                const roleLabel = data.role === 'COE' ? 'Controller of Examinations (COE)' : 'First Year Coordinator';
                throw new Error(`${roleLabel} role is not available for ${tenant.type.toLowerCase()} colleges.`);
            }
        }

        // COE Singleton Check — only one active COE per tenant
        if (data.role === 'COE') {
            const existingCOE = await prisma.user.findFirst({
                where: { role: 'COE', tenantId: data.tenantId },
            });
            // Soft deleted users have email starting with 'deleted_' — exclude them
            if (existingCOE && !existingCOE.email.startsWith('deleted_')) {
                throw new Error('A Controller of Examinations (COE) account already exists. Only one is allowed.');
            }
        }

        // Hash password
        const passwordHash = await authService.hashPassword(data.password);

        const user = await userRepository.create({
            email: data.email,
            passwordHash,
            name: data.name,
            role: data.role,
            departmentId: data.departmentId,
            tenantId: data.tenantId,
        });

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'CREATE_USER',
            entityType: 'User',
            entityId: user.id,
            newValue: { email: user.email, name: user.name, role: user.role } as Prisma.JsonValue,
        });

        return user;
    }

    // Update user
    async update(id: number, data: UpdateUserData, actorId: number): Promise<User> {
        const existing = await userRepository.findById(id);
        if (!existing) {
            throw new Error('User not found');
        }

        // If updating email, check for duplicates
        if (data.email && data.email !== existing.email) {
            const emailExists = await userRepository.findByTenantEmail(data.email, existing.tenantId);
            if (emailExists) {
                throw new Error('Email already in use in this institution');
            }
        }

        const user = await userRepository.update(id, data);

        // If role was changed, revoke existing tokens
        if (data.role && data.role !== existing.role) {
            await prisma.user.update({
                where: { id },
                data: { tokenVersion: { increment: 1 } },
            });
            await cacheService.delete(`user:tokenver:${id}`);
        }

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'UPDATE_USER',
            entityType: 'User',
            entityId: id,
            oldValue: { email: existing.email, name: existing.name, role: existing.role } as Prisma.JsonValue,
            newValue: data as unknown as Prisma.JsonValue,
        });

        return user;
    }

    // Toggle user activation (Admin/COE only)
    async toggleActivation(id: number, isActive: boolean, actorId: number): Promise<User> {
        const existing = await userRepository.findById(id);
        if (!existing) {
            throw new Error('User not found');
        }

        if (id === actorId) {
            throw new Error('Cannot change your own activation status');
        }

        const user = await userRepository.toggleActivation(id, isActive);

        // Invalidate tokens when deactivating
        if (!isActive) {
            await prisma.user.update({
                where: { id },
                data: { tokenVersion: { increment: 1 } },
            });
            // Clear cached token version to force re-check
            await cacheService.delete(`user:tokenver:${id}`);
        }

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'UPDATE_USER', // Or a new action 'TOGGLE_ACTIVATION'
            entityType: 'User',
            entityId: id,
            oldValue: { isActive: existing.isActive } as Prisma.JsonValue,
            newValue: { isActive: user.isActive } as Prisma.JsonValue,
        });

        return user;
    }

    // Delete user
    async delete(id: number, actorId: number): Promise<void> {
        const existing = await userRepository.findById(id);
        if (!existing) {
            throw new Error('User not found');
        }

        // Cannot delete self
        if (id === actorId) {
            throw new Error('Cannot delete your own account');
        }

        await userRepository.delete(id);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'DELETE_USER',
            entityType: 'User',
            entityId: id,
            oldValue: { email: existing.email, name: existing.name, role: existing.role } as Prisma.JsonValue,
        });
    }

    // Get user by ID
    async getById(id: number): Promise<User | null> {
        return userRepository.findById(id);
    }

    // Get users by department
    async getByDepartment(departmentId: number): Promise<User[]> {
        return userRepository.findByDepartment(departmentId);
    }

    // Get users by role (filtered by tenant)
    async getByRole(role: UserRole, tenantId: number): Promise<User[]> {
        return userRepository.findByRole(role, tenantId);
    }

    // Get all users with pagination and filters (filtered by tenant)
    async getAll(options: {
        skip?: number;
        take?: number;
        role?: UserRole;
        departmentId?: number;
        tenantId: number;
    } = {} as { tenantId: number }): Promise<{ users: User[]; total: number }> {
        return userRepository.findAll(options);
    }

    // Change user role
    async changeRole(id: number, newRole: UserRole, actorId: number): Promise<User> {
        const existing = await userRepository.findById(id);
        if (!existing) {
            throw new Error('User not found');
        }

        const user = await userRepository.update(id, { role: newRole });

        // Audit log - role changes are critical
        await auditLogRepository.create({
            actorId,
            action: 'CHANGE_USER_ROLE',
            entityType: 'User',
            entityId: id,
            oldValue: { role: existing.role } as Prisma.JsonValue,
            newValue: { role: newRole } as Prisma.JsonValue,
        });

        return user;
    }

    // Create user with auto-generated password and email notification
    async createWithEmailNotification(
        data: Omit<CreateUserInput, 'password'>,
        actorId: number
    ): Promise<{ user: User; password: string }> {
        // Generate random password
        const password = this.generateSecurePassword();

        // Create user
        const user = await this.create(
            { ...data, password },
            actorId
        );

        // Import email service dynamically to avoid circular dependency


        // Look up tenant slug for the login URL
        const tenant = await prisma.tenant.findUnique({
            where: { id: user.tenantId },
            select: { slug: true },
        });

        // Send welcome email (blocking — ensures delivery before response)
        await emailService.sendWelcomeEmail(
            user.email,
            user.name,
            this.getRoleLabel(user.role),
            password,
            tenant?.slug,
            { tenantId: user.tenantId, userId: user.id }
        ).catch(err => log.error({ err, email: user.email }, 'Welcome email failed'));

        return { user, password };
    }

    // Generate a cryptographically secure random password
    private generateSecurePassword(length: number = 12): string {
        const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I, O
        const lowercase = 'abcdefghjkmnpqrstuvwxyz';   // Exclude i, l, o
        const numbers = '23456789';                    // Exclude 0, 1
        const allChars = uppercase + lowercase + numbers;

        const chars: string[] = [];
        // Ensure at least one of each type (CSPRNG)
        chars.push(uppercase[randomInt(uppercase.length)]);
        chars.push(lowercase[randomInt(lowercase.length)]);
        chars.push(numbers[randomInt(numbers.length)]);

        // Fill the rest with cryptographically random chars
        for (let i = chars.length; i < length; i++) {
            chars.push(allChars[randomInt(allChars.length)]);
        }

        // Fisher-Yates shuffle with CSPRNG
        for (let i = chars.length - 1; i > 0; i--) {
            const j = randomInt(i + 1);
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }

        return chars.join('');
    }

    // Get human-readable role label
    private getRoleLabel(role: UserRole): string {
        const labels: Record<UserRole, string> = {
            STUDENT: 'Student',
            TEACHER: 'Teacher',
            DEPARTMENT_ADMIN: 'Department Administrator',
            SUPER_ADMIN: 'Super Administrator',
            COE: 'Controller of Examinations',
            CLERK: 'Clerk',
            ADMISSIONS_ADMIN: 'Admissions Administrator',
            ADMIN_CLERK: 'Administration Clerk',
            FIRST_YEAR_COORDINATOR: 'First Year Coordinator',
            PARENT: 'Parent',
    LIBRARIAN: 'Librarian',
    PRINCIPAL: 'Principal',
    ACCOUNTS_STAFF: 'Accounts Staff',
    PLACEMENT_COMPANY: 'Placement Company',
        };
        return labels[role];
    }

    // Bulk create students with auto-generated roll numbers
    async createBulkStudents(
        options: {
            rollNumberPrefix: string;  // e.g., "4MH23CS"
            startNumber: number;       // e.g., 1
            endNumber: number;         // e.g., 215
            programId?: number;        // Optional - resolved from department
            admissionYear: number;     // Required - also used to find/resolve batch
            departmentId: number;
            emailDomain?: string;      // e.g., "college.edu"
            currentSemester: number;
            cycle?: 'PHYSICS' | 'CHEMISTRY';
            tenantId: number;
        },
        actorId: number
    ): Promise<{ created: number; skipped: string[]; students: User[] }> {
        const {
            rollNumberPrefix,
            startNumber,
            endNumber,
            programId,
            admissionYear,
            departmentId,
            emailDomain = 'student.edu',
        } = options;

        let targetDepartmentId = departmentId;
        let deptCode = ''; // Will fetch from DB

        // Fetch department code for password generation

        const dept = await departmentRepository.findById(departmentId);
        if (dept) {
            deptCode = dept.code.toUpperCase();
        }

        // If cycle is specified, find the corresponding department logic
        // The main department stays as the opted department (CSE, ECE, etc.)
        // The cycle department (Physics/Chemistry) is stored in StudentProfile.cycleDepartmentId
        let cycleDepartmentId: number | undefined = undefined;
        if (options.cycle) {
            const cycleDeptName = options.cycle === 'PHYSICS' ? 'Physics' : 'Chemistry';
            const cycleDept = await departmentRepository.findByName(cycleDeptName);

            if (!cycleDept) {
                throw new Error(`Cycle Department ${cycleDeptName} not found`);
            }
            // Store cycle department ID separately, don't change the main department
            cycleDepartmentId = cycleDept.id;
        }

        // Note: programId is optional and will be assigned by Department Admin later

        // Resolve batchId from admissionYear - auto-create batch if it doesn't exist

        // Batch names (admission years) are only unique within a tenant.
        // Looking up by name alone can attach this tenant's students to a
        // similarly named batch belonging to another institution.
        let batch = await batchRepository.findByName(String(admissionYear), options.tenantId);
        if (!batch) {
            // Auto-create batch for the admission year with the correct semester
            batch = await batchRepository.create({
                name: String(admissionYear),
                startYear: admissionYear,
                currentSemester: options.currentSemester,
                tenantId: options.tenantId,
            });
        } else if (batch.currentSemester !== options.currentSemester) {
            // Update existing batch's semester if it differs
            batch = await batchRepository.update(batch.id, {
                currentSemester: options.currentSemester,
            });
        }
        const resolvedBatchId = batch.id;

        const created: User[] = [];
        const skipped: string[] = [];

        // ─── Pre-compute password hashes OUTSIDE the transaction ──────
        // Argon2 is intentionally slow (~100ms per hash). Doing it inside
        // a DB transaction would hold a connection for N × 100ms, causing
        // pool starvation and P2028 timeout errors on large batches.
        const studentData: { rollNumber: string; email: string; name: string; passwordHash: string }[] = [];
        for (let i = startNumber; i <= endNumber; i++) {
            const rollNumber = `${rollNumberPrefix}${i.toString().padStart(3, '0')}`;
            const email = `${rollNumber.toLowerCase()}@${emailDomain}`;
            const name = `Student ${rollNumber}`;
            const rollSuffix = i.toString().padStart(3, '0');
            const password = `${deptCode}${admissionYear}${rollSuffix}`;
            const passwordHash = await authService.hashPassword(password);
            studentData.push({ rollNumber, email, name, passwordHash });
        }

        // ─── Transaction: only fast DB writes ─────────────────────────
        // Prevents partial creates (orphaned Users without StudentProfiles)
        await prisma.$transaction(async (tx) => {
            for (const student of studentData) {
                try {
                    // Check for existing students (use tx for consistency within transaction)
                    const existing = await tx.studentProfile.findFirst({
                        where: { rollNumber: student.rollNumber },
                    });
                    if (existing) { skipped.push(student.rollNumber); continue; }

                    const emailExists = await tx.user.findFirst({
                        where: {
                            email: { equals: student.email, mode: 'insensitive' },
                            tenantId: options.tenantId,
                            NOT: { email: { startsWith: 'deleted_' } },
                        },
                    });
                    if (emailExists) { skipped.push(student.rollNumber); continue; }

                    // Create user + profile atomically within the same transaction
                    const createdStudent = await tx.user.create({
                        data: {
                            email: student.email,
                            passwordHash: student.passwordHash,
                            name: student.name,
                            role: 'STUDENT',
                            departmentId: targetDepartmentId,
                            tenantId: options.tenantId,
                            studentProfile: {
                                create: {
                                    rollNumber: student.rollNumber,
                                    admissionYear,
                                    batchId: resolvedBatchId,
                                    currentSemester: options.currentSemester,
                                    cycleDepartmentId: cycleDepartmentId,
                                    optedDepartmentId: targetDepartmentId,
                                },
                            },
                        },
                    });
                    created.push(createdStudent);
                } catch (error) {
                    skipped.push(student.rollNumber);
                }
            }
        }, {
            maxWait: 30000,   // 30s max wait for transaction slot
            timeout: 120000,  // 2min timeout for large batches
        });

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'BULK_CREATE_STUDENTS',
            entityType: 'User',
            entityId: undefined,
            newValue: {
                rollNumberPrefix,
                startNumber,
                endNumber,
                created: created.length,
                skipped: skipped.length,
            } as Prisma.JsonValue,
        });

        return {
            created: created.length,
            skipped,
            students: created,
        };
    }

    // Get students with profiles for section assignment (filtered by tenant)
    async getStudentsForSectionAssignment(options: {
        departmentId?: number;
        programId?: number;
        sectionId?: number;
        batchId?: number;
        unassignedOnly?: boolean;
        skip?: number;
        take?: number;
        tenantId: number;
    }): Promise<{ users: User[]; total: number }> {
        return userRepository.findStudentsWithProfiles({
            departmentId: options.departmentId,
            programId: options.programId,
            batchId: options.batchId,
            sectionId: options.sectionId,
            unassignedOnly: options.unassignedOnly,
            skip: options.skip,
            take: options.take,
            tenantId: options.tenantId,
        });
    }

    // Get student counts per department for a batch (filtered by tenant)
    async getStudentCountsByBatch(batchId: number, tenantId: number): Promise<{ departmentId: number; count: number }[]> {
        return userRepository.getStudentCountsByBatch(batchId, tenantId);
    }

    // Get comprehensive student academic history
    async getStudentAcademicHistory(userId: number): Promise<{
        student: {
            id: number;
            name: string;
            email: string;
            rollNumber: string;
            department: string;
            program: string | null;
            batch: string | null;
            admissionYear: number;
            currentSemester: number;
        };
        semesters: {
            semesterNumber: number;
            courses: {
                courseId: number;
                courseName: string;
                courseCode: string;
                credits: number;
                internalMarks: number | null;
                internalMaxMarks: number;
                semesterMarks: number | null;
                semesterMaxMarks: number;
                totalMarks: number | null;
                totalMaxMarks: number;
                status: string;
            }[];
        }[];
    } | null> {
        // Get user with student profile
        const user = await userRepository.findById(userId) as (User & { studentProfile?: { rollNumber: string } }) | null;
        if (!user || user.role !== 'STUDENT' || !user.studentProfile) {
            return null;
        }



        // Get student with full details
        const studentProfile = await prisma.studentProfile.findUnique({
            where: { userId },
            include: {
                user: { include: { department: true } },
                program: true,
                batch: true,
            },
        });

        if (!studentProfile) return null;

        // Get all results for this student (by USN)
        const results = await prisma.result.findMany({
            where: { studentUsn: studentProfile.rollNumber },
            include: {
                course: true,
            },
            orderBy: [
                { course: { semesterNumber: 'asc' } },
                { course: { name: 'asc' } },
            ],
        });

        // Group courses by semester (1-8)
        const semesterMap = new Map<number, {
            courseId: number;
            courseName: string;
            courseCode: string;
            credits: number;
            internalMarks: number | null;
            internalMaxMarks: number;
            semesterMarks: number | null;
            semesterMaxMarks: number;
            totalMarks: number | null;
            totalMaxMarks: number;
            status: string;
        }[]>();

        // Initialize all 8 semesters
        for (let i = 1; i <= 8; i++) {
            semesterMap.set(i, []);
        }

        // Populate with results
        results.forEach(result => {
            const semNum = result.course.semesterNumber || 1;
            const courses = semesterMap.get(semNum) || [];
            courses.push({
                courseId: result.course.id,
                courseName: result.course.name,
                courseCode: result.course.code,
                credits: result.course.credits,
                internalMarks: result.internalMarks,
                internalMaxMarks: result.course.internalMarks,
                semesterMarks: result.semesterMarks,
                semesterMaxMarks: result.course.externalMarks,
                totalMarks: result.totalMarks,
                totalMaxMarks: result.course.internalMarks + result.course.externalMarks,
                status: result.status,
            });
            semesterMap.set(semNum, courses);
        });

        // Convert to array format
        const semesters = Array.from(semesterMap.entries()).map(([semNum, courses]) => ({
            semesterNumber: semNum,
            courses,
        }));

        return {
            student: {
                id: user.id,
                name: user.name,
                email: user.email,
                rollNumber: studentProfile.rollNumber,
                department: studentProfile.user.department?.name || 'N/A',
                program: studentProfile.program?.name || null,
                batch: studentProfile.batch?.name || null,
                admissionYear: studentProfile.admissionYear,
                currentSemester: studentProfile.currentSemester,
            },
            semesters,
        };
    }

    /**
     * Get teacher profile ID by user ID
     */
    async getTeacherProfileId(userId: number): Promise<number | null> {

        const profile = await prisma.teacherProfile.findUnique({ where: { userId } });
        return profile?.id ?? null;
    }

    /**
     * Get student profile ID by user ID
     */
    async getStudentProfileId(userId: number): Promise<number | null> {

        const profile = await prisma.studentProfile.findUnique({ where: { userId } });
        return profile?.id ?? null;
    }

    /**
     * Verify teacher has access to a subject
     */
    async verifyTeacherSubjectAccess(userId: number, subjectId: number): Promise<boolean> {

        const profile = await prisma.teacherProfile.findUnique({ where: { userId } });
        if (!profile) return false;

        const assignment = await prisma.subjectTeacher.findUnique({
            where: { subjectId_teacherId: { subjectId, teacherId: profile.id } },
        });
        return !!assignment;
    }

    /**
     * Create a single student with profile (used by the admin create-user route).
     * Validates duplicate roll number and email within tenant.
     */
    async createStudentWithProfile(data: {
        email: string;
        password: string;
        name: string;
        rollNumber: string;
        admissionYear: number;
        departmentId: number;
        currentSemester?: number;
        tenantId: number;
    }) {
        const semester = data.currentSemester || 1;



        // Resolve batchId from admissionYear — auto-create batch if needed
        // Batch names (admission years) are only unique within a tenant.
        let batch = await batchRepository.findByName(String(data.admissionYear), data.tenantId);
        if (!batch) {
            batch = await batchRepository.create({
                name: String(data.admissionYear),
                startYear: data.admissionYear,
                currentSemester: semester,
                tenantId: data.tenantId,
            });
        }

        // Check for duplicate roll number
        const existingProfile = await prisma.studentProfile.findFirst({
            where: { rollNumber: data.rollNumber },
        });
        if (existingProfile) {
            throw new Error(`A student with roll number ${data.rollNumber} already exists`);
        }

        // Check for duplicate email in tenant (case-insensitive)
        const existingEmail = await prisma.user.findFirst({
            where: {
                email: { equals: data.email, mode: 'insensitive' },
                tenantId: data.tenantId,
                NOT: { email: { startsWith: 'deleted_' } },
            },
        });
        if (existingEmail) {
            throw new Error('Email already registered in this institution');
        }

        const passwordHash = await authService.hashPassword(data.password);

        return prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                name: data.name,
                role: 'STUDENT',
                departmentId: data.departmentId,
                tenantId: data.tenantId,
                studentProfile: {
                    create: {
                        rollNumber: data.rollNumber,
                        admissionYear: data.admissionYear,
                        batchId: batch.id,
                        currentSemester: semester,
                        optedDepartmentId: data.departmentId,
                    },
                },
            },
            include: {
                department: true,
                studentProfile: true,
            },
        });
    }
}

export const userService = new UserService();
