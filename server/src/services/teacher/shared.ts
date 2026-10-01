/**
 * Teacher — Shared utilities
 * Extracted from teacher.service.ts
 */
import prisma from '../../data-access/prisma.js';

/**
 * Get teacher profile from user ID (returns null for non-teachers)
 */
export async function getTeacherProfile(userId: number) {
    const teacher = await prisma.teacherProfile.findUnique({
        where: { userId },
        include: {
            user: {
                select: { id: true, name: true, email: true, departmentId: true, role: true }
            }
        }
    });
    return teacher; // Can be null for admin users
}

/**
 * Verify teacher has access to a specific allocation
 */
export async function verifyAllocationAccess(userId: number, allocationId: number) {
    const teacher = await getTeacherProfile(userId);

    if (!teacher) {
        throw new Error('Teacher profile not found. Only teachers can perform this action.');
    }

    const allocation = await prisma.courseAllocation.findUnique({
        where: { id: allocationId },
        include: {
            course: true,
            section: {
                include: {
                    department: true,
                    batch: true
                }
            }
        }
    });

    if (!allocation) {
        throw new Error('Course allocation not found');
    }

    if (allocation.teacherId !== teacher.id) {
        throw new Error('You do not have access to this course allocation');
    }

    return { teacher, allocation };
}

/**
 * Verify teacher has access to section/course combination
 */
export async function verifySectionCourseAccess(userId: number, sectionId: number, courseId: number) {
    const teacher = await getTeacherProfile(userId);

    if (!teacher) {
        throw new Error('Teacher profile not found. Only teachers can perform this action.');
    }

    const section = await prisma.section.findUnique({
        where: { id: sectionId },
        include: { batch: true }
    });

    if (!section) {
        throw new Error('Section not found');
    }

    const allocation = await prisma.courseAllocation.findFirst({
        where: {
            sectionId,
            courseId,
            teacherId: teacher.id
        },
        include: {
            course: true,
            section: {
                include: {
                    department: true,
                    batch: true
                }
            }
        }
    });

    if (!allocation) {
        throw new Error('You do not have access to this section/course');
    }

    return { teacher, allocation };
}

/**
 * Resolve the active semester for a given tenant (auto-creates if none exists)
 */
export async function getOrCreateActiveSemester(tenantId: number) {
    const existing = await prisma.semester.findFirst({
        where: { tenantId, status: 'ACTIVE' }
    });
    if (existing) return existing;

    const now = new Date();
    try {
        return await prisma.semester.create({
            data: {
                tenantId,
                name: `${now.getFullYear()} Semester`,
                startDate: new Date(now.getFullYear(), 0, 1),
                endDate: new Date(now.getFullYear(), 11, 31),
                status: 'ACTIVE',
            }
        });
    } catch (err: unknown) {
        if ((err as { code?: string }).code === 'P2002') {
            return prisma.semester.findFirst({
                where: { tenantId, status: 'ACTIVE' }
            });
        }
        throw err;
    }
}
