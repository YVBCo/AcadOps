import { prisma } from './prisma.js';
import { Batch, StudentProfile } from '@prisma/client';

export interface CreateBatchData {
    name: string;
    startYear: number;
    currentSemester?: number;
    tenantId: number;
}

export interface UpdateBatchData {
    name?: string;
    startYear?: number;
    currentSemester?: number;
    isGraduated?: boolean;
    graduatedAt?: Date;
}


export const batchRepository = {
    // Find by ID
    async findById(id: number, tenantId?: number): Promise<Batch | null> {
        return prisma.batch.findFirst({
            where: { id, ...(tenantId ? { tenantId } : {}) },
            include: {
                _count: {
                    select: {
                        students: tenantId ? {
                            where: {
                                user: {
                                    tenantId,
                                    role: 'STUDENT',
                                    NOT: { email: { startsWith: 'deleted_' } },
                                },
                            },
                        } : true,
                    },
                },
            },
        });
    },

    // Find by name (optionally tenant-scoped)
    async findByName(name: string, tenantId?: number): Promise<Batch | null> {
        return prisma.batch.findFirst({
            where: { name, ...(tenantId && { tenantId }) },
        });
    },

    // Create batch
    async create(data: CreateBatchData): Promise<Batch> {
        return prisma.batch.create({
            data,
        });
    },

    // Update batch
    async update(id: number, data: UpdateBatchData): Promise<Batch> {
        return prisma.batch.update({
            where: { id },
            data,
        });
    },

    // Delete batch
    async delete(id: number): Promise<Batch> {
        return prisma.batch.delete({
            where: { id },
        });
    },

    // Find all batches (optionally tenant-scoped)
    async findAll(tenantId?: number): Promise<Batch[]> {
        return prisma.batch.findMany({
            where: tenantId ? { tenantId } : undefined,
            include: {
                _count: {
                    select: {
                        // A profile can reference a batch created by another tenant
                        // if it was imported before tenant validation. Never expose
                        // those students in this tenant's batch totals.
                        students: tenantId ? {
                            where: {
                                user: {
                                    tenantId,
                                    role: 'STUDENT',
                                    NOT: { email: { startsWith: 'deleted_' } },
                                },
                            },
                        } : true,
                    },
                },
            },
            orderBy: { startYear: 'desc' },
        });
    },

    // Get students in a batch
    async getStudents(batchId: number, tenantId?: number): Promise<StudentProfile[]> {
        return prisma.studentProfile.findMany({
            where: {
                batchId,
                ...(tenantId ? {
                    user: {
                        tenantId,
                        role: 'STUDENT',
                        NOT: { email: { startsWith: 'deleted_' } },
                    },
                } : {}),
            },
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
                program: {
                    include: {
                        departments: true
                    }
                },
                section: true,
            },
        });
    },

    // Assign students to a department (bulk update)
    async assignStudentsToDepartment(batchId: number, departmentId: number): Promise<number> {
        // Update all users associated with students in this batch
        const students = await prisma.studentProfile.findMany({
            where: { batchId },
            select: { userId: true },
        });

        const userIds = students.map((s) => s.userId);

        const result = await prisma.user.updateMany({
            where: { id: { in: userIds } },
            data: { departmentId },
        });

        return result.count;
    },

    // Migrate students to their branch programs based on USN
    async migrateStudentsToBranches(batchId: number): Promise<{ migrated: number; failed: string[] }> {
        const students = await prisma.studentProfile.findMany({
            where: { batchId },
            include: {
                user: true,
                program: true,
            },
        });

        const failed: string[] = [];
        let migrated = 0;

        for (const student of students) {
            // Parse branch code from USN (e.g., "4MH24CS001" -> "CS")
            const usn = student.rollNumber;
            const branchCodeMatch = usn.match(/^[A-Z0-9]{4}(\d{2})([A-Z]{2,3})\d+$/i);

            if (!branchCodeMatch) {
                failed.push(`${usn}: Invalid USN format`);
                continue;
            }

            const branchCode = branchCodeMatch[2].toUpperCase();

            // Find program matching the branch code
            const targetProgram = await prisma.program.findFirst({
                where: {
                    code: { contains: branchCode, mode: 'insensitive' },
                },
                include: { departments: true },
            });

            if (!targetProgram) {
                failed.push(`${usn}: No program found for branch code ${branchCode}`);
                continue;
            }

            // Update student's program and user's department
            await prisma.$transaction([
                prisma.studentProfile.update({
                    where: { id: student.id },
                    data: { programId: targetProgram.id },
                }),
                prisma.user.update({
                    where: { id: student.userId },
                    data: { departmentId: targetProgram.departments[0]?.id },
                }),
            ]);

            migrated++;
        }

        return { migrated, failed };
    },
};

export type BatchRepository = typeof batchRepository;
