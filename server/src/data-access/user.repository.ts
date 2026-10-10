import { prisma } from './prisma.js';
import { User, UserRole, Prisma } from '@prisma/client';

export interface CreateUserData {
    email: string;
    passwordHash: string;
    name: string;
    role: UserRole;
    departmentId?: number;
    tenantId: number;
}

export interface UpdateUserData {
    email?: string;
    name?: string;
    role?: UserRole;
    departmentId?: number;
    isActive?: boolean;
}

export const userRepository = {
    // Find user by ID
    async findById(id: number): Promise<User | null> {
        return prisma.user.findUnique({
            where: { id },
            include: {
                department: true,
                studentProfile: {
                    include: {
                        batch: true,
                        program: true,
                        section: true,
                        optedDepartment: true,
                        admissionData: true,
                    },
                },
                teacherProfile: true,
            },
        });
    },

    // Find user by email (optionally scoped by tenant for per-tenant uniqueness)
    async findByEmail(email: string, tenantId?: number): Promise<User | null> {
        return prisma.user.findFirst({
            where: {
                email: { equals: email, mode: 'insensitive' },
                NOT: { email: { startsWith: 'deleted_' } },
                ...(tenantId ? { tenantId } : {}),
            },
            include: {
                department: true,
                studentProfile: true,
                teacherProfile: true,
            },
        });
    },

    // Find user by email within a specific tenant (for uniqueness checks)
    async findByTenantEmail(email: string, tenantId: number): Promise<User | null> {
        // Use findFirst with case-insensitive matching for reliable uniqueness
        return prisma.user.findFirst({
            where: {
                tenantId,
                email: { equals: email, mode: 'insensitive' },
                NOT: { email: { startsWith: 'deleted_' } },
            },
            include: {
                department: true,
                studentProfile: true,
                teacherProfile: true,
            },
        });
    },

    // Create new user
    async create(data: CreateUserData): Promise<User> {
        return prisma.user.create({
            data: {
                email: data.email,
                passwordHash: data.passwordHash,
                name: data.name,
                role: data.role,
                departmentId: data.departmentId,
                tenantId: data.tenantId,
            },
        });
    },

    // Update user
    async update(id: number, data: UpdateUserData): Promise<User> {
        return prisma.user.update({
            where: { id },
            data,
        });
    },

    // Delete user (Soft Delete - Obfuscate credentials)
    async delete(id: number): Promise<User> {
        const timestamp = Date.now();
        const user = await this.findById(id);
        if (!user) throw new Error('User not found');

        return prisma.user.update({
            where: { id },
            data: {
                email: `deleted_${timestamp}_${user.email}`,
                passwordHash: 'DELETED_USER_CREDENTIALS',
                isActive: false, // Ensure they are marked inactive too
            },
        });
    },

    // Toggle user activation status
    async toggleActivation(id: number, isActive: boolean): Promise<User> {
        return prisma.user.update({
            where: { id },
            data: { isActive },
        });
    },

    // Find users by department
    async findByDepartment(departmentId: number): Promise<User[]> {
        return prisma.user.findMany({
            where: {
                departmentId,
                NOT: { email: { startsWith: 'deleted_' } }
            },
            include: {
                studentProfile: true,
                teacherProfile: true,
            },
        });
    },

    // Find users by role (filtered by tenant)
    async findByRole(role: UserRole, tenantId: number): Promise<User[]> {
        return prisma.user.findMany({
            where: {
                role,
                tenantId,
                NOT: { email: { startsWith: 'deleted_' } }
            },
        });
    },

    // Find all users with pagination (filtered by tenant)
    async findAll(options: {
        skip?: number;
        take?: number;
        role?: UserRole;
        departmentId?: number;
        batchId?: number;
        tenantId: number;
    }): Promise<{ users: User[]; total: number }> {
        const where: Prisma.UserWhereInput = {
            tenantId: options.tenantId,
            NOT: {
                email: { startsWith: 'deleted_' }
            }
        };

        if (options.role) where.role = options.role;

        // For STUDENT role with department filter, use StudentProfile.optedDepartmentId
        // (canonical student department) instead of User.departmentId to match dept-admin view
        if (options.departmentId && options.role === 'STUDENT') {
            where.studentProfile = {
                OR: [
                    { optedDepartmentId: options.departmentId },
                    {
                        cycleDepartmentId: options.departmentId,
                        currentSemester: { lte: 2 },
                    },
                ],
                ...(options.batchId ? { batchId: options.batchId } : {}),
            };
        } else {
            if (options.departmentId) where.departmentId = options.departmentId;
            if (options.batchId) {
                where.studentProfile = {
                    batchId: options.batchId,
                };
            }
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip: options.skip,
                take: options.take,
                include: {
                    department: true,
                    studentProfile: {
                        include: {
                            section: true,
                            program: true,
                            batch: true,
                        },
                    },
                    teacherProfile: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);

        return { users, total };
    },

    // Get student counts grouped by department for a given batch (filtered by tenant)
    async getStudentCountsByBatch(batchId: number, tenantId: number): Promise<{ departmentId: number; count: number }[]> {
        // Match the student list: opted department first, cycle department only
        // for semesters 1-2, then the tenant-scoped user department when no
        // applicable profile assignment exists.
        const counts = await prisma.$queryRaw<{ department_id: number; count: bigint }[]>`
            SELECT COALESCE(
                       sp.opted_department_id,
                       CASE WHEN sp.current_semester <= 2 THEN sp.cycle_department_id END,
                       u.department_id
                   ) as department_id,
                   COUNT(*) as count
            FROM student_profiles sp
            INNER JOIN users u ON u.id = sp.user_id
            WHERE sp.batch_id = ${batchId}
              AND u.tenant_id = ${tenantId}
              AND u.role = 'STUDENT'
              AND LEFT(LOWER(u.email), 8) <> 'deleted_'
              AND COALESCE(
                      sp.opted_department_id,
                      CASE WHEN sp.current_semester <= 2 THEN sp.cycle_department_id END,
                      u.department_id
                  ) IS NOT NULL
            GROUP BY COALESCE(
                         sp.opted_department_id,
                         CASE WHEN sp.current_semester <= 2 THEN sp.cycle_department_id END,
                         u.department_id
                     )
        `;

        return counts.map(c => ({ departmentId: Number(c.department_id), count: Number(c.count) }));
    },

    // ... (createStudentWithProfile remains same) ...

    // Get students with their profiles and sections (filtered by tenant)
    async findStudentsWithProfiles(options: {
        departmentId?: number;
        programId?: number;
        sectionId?: number;
        batchId?: number;
        unassignedOnly?: boolean;
        skip?: number;
        take?: number;
        tenantId: number;
    }): Promise<{ users: User[]; total: number }> {
        const where: Prisma.UserWhereInput = {
            role: 'STUDENT',
            tenantId: options.tenantId,
            NOT: {
                email: { startsWith: 'deleted_' }
            }
        };

        // Build studentProfile filter conditions
        // StudentProfile is authoritative when present. Some older/admissions-created
        // profiles have neither department link, so fall back to the tenant-scoped
        // user's department only in that case.
        const profileConditions: Prisma.StudentProfileWhereInput = {};

        if (options.departmentId) {
            // Filter by optedDepartmentId OR cycleDepartmentId (for sem 1-2)
            profileConditions.OR = [
                { optedDepartmentId: options.departmentId },
                {
                    cycleDepartmentId: options.departmentId,
                    currentSemester: { lte: 2 }
                },
                {
                    optedDepartmentId: null,
                    OR: [
                        { cycleDepartmentId: null },
                        { currentSemester: { gt: 2 } },
                    ],
                    user: { departmentId: options.departmentId },
                },
            ];
        }
        if (options.programId) profileConditions.programId = options.programId;
        if (options.sectionId) profileConditions.sectionId = options.sectionId;
        if (options.batchId) profileConditions.batchId = options.batchId;

        // Filter for unassigned students (those without a section)
        if (options.unassignedOnly) {
            profileConditions.sectionId = null;
        }

        // Apply profile conditions if any exist
        if (Object.keys(profileConditions).length > 0) {
            where.studentProfile = profileConditions;
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip: options.skip,
                take: options.take,
                include: {
                    department: true,
                    studentProfile: {
                        include: {
                            section: true,
                            program: true,
                            batch: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.count({ where }),
        ]);

        return { users, total };
    },

    // Create student with profile in a transaction
    async createStudentWithProfile(data: {
        email: string;
        passwordHash: string;
        name: string;
        departmentId: number;
        tenantId: number;
        rollNumber: string;
        programId?: number;
        admissionYear: number;
        batchId?: number;
        currentSemester: number;
        cycleDepartmentId?: number;
        optedDepartmentId?: number;
    }): Promise<User> {
        return prisma.user.create({
            data: {
                email: data.email,
                passwordHash: data.passwordHash,
                name: data.name,
                role: 'STUDENT',
                departmentId: data.departmentId,
                tenantId: data.tenantId,
                studentProfile: {
                    create: {
                        rollNumber: data.rollNumber,
                        ...(data.programId && { programId: data.programId }),
                        admissionYear: data.admissionYear,
                        ...(data.batchId && { batchId: data.batchId }),
                        currentSemester: data.currentSemester,
                        ...(data.cycleDepartmentId && { cycleDepartmentId: data.cycleDepartmentId }),
                        ...(data.optedDepartmentId && { optedDepartmentId: data.optedDepartmentId }),
                    },
                },
            },
            include: {
                studentProfile: true,
            },
        });
    },

    // Find student by roll number, temporary USN, or admission ID (tenant-scoped)
    // Searches in priority order: rollNumber → temporaryUsn → admissionId
    async findStudentByRollNumber(identifier: string, tenantId?: number): Promise<User | null> {
        const upperIdentifier = identifier.toUpperCase();

        // Build tenant filter for user relation
        const userFilter = tenantId ? { tenantId } : {};

        // 1. Try exact match on rollNumber (primary login identifier)
        let profile = await prisma.studentProfile.findFirst({
            where: {
                rollNumber: { equals: upperIdentifier, mode: 'insensitive' },
                user: userFilter,
            },
            include: {
                user: {
                    include: {
                        department: true,
                        studentProfile: true,
                    },
                },
            },
        });
        if (profile?.user) return profile.user;

        // 2. Try by temporaryUsn (students are told to use this as login)
        profile = await prisma.studentProfile.findFirst({
            where: {
                temporaryUsn: { equals: upperIdentifier, mode: 'insensitive' },
                user: userFilter,
            },
            include: {
                user: {
                    include: {
                        department: true,
                        studentProfile: true,
                    },
                },
            },
        });
        if (profile?.user) return profile.user;

        // 3. Try by admissionId (fallback for pre-closure logins)
        profile = await prisma.studentProfile.findFirst({
            where: {
                admissionId: { equals: upperIdentifier, mode: 'insensitive' },
                user: userFilter,
            },
            include: {
                user: {
                    include: {
                        department: true,
                        studentProfile: true,
                    },
                },
            },
        });
        return profile?.user || null;
    },

    // Find parent by phone number (for phone-based login)
    async findParentByPhone(phone: string, tenantId?: number): Promise<User | null> {
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        const parentProfile = await prisma.parentProfile.findFirst({
            where: {
                phoneNumber: cleanPhone,
                user: {
                    role: 'PARENT',
                    ...(tenantId ? { tenantId } : {}),
                    NOT: { email: { startsWith: 'deleted_' } },
                },
            },
            include: {
                user: {
                    include: {
                        department: true,
                        studentProfile: true,
                        teacherProfile: true,
                    },
                },
            },
        });
        return parentProfile?.user || null;
    },

};

export type UserRepository = typeof userRepository;

