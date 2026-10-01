import { prisma } from '../data-access/prisma.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'semester-progression' });

/**
 * Service to handle semester progression with PHY/CHEM cycle system.
 * 
 * Semester 1-2: Students are in PHY or CHEM department (cycle departments)
 * - After Sem 1 ends: PHY students swap to CHEM and vice versa
 * Semester 3+: Students move to their opted department (CS, EC, etc.)
 */
export const semesterProgressionService = {
    /**
     * Get all cycle departments (PHY and CHEM)
     */
    async getCycleDepartments() {
        return prisma.department.findMany({
            where: { isCycleDepartment: true },
        });
    },

    /**
     * Get the swapped cycle department (PHY -> CHEM, CHEM -> PHY)
     */
    async getSwappedCycleDepartment(currentCycleDeptId: number): Promise<number | null> {
        const cycleDepts = await this.getCycleDepartments();
        if (cycleDepts.length !== 2) {
            log.warn({ count: cycleDepts.length }, 'Expected exactly 2 cycle departments (PHY/CHEM)');
            return null;
        }

        // Find the other cycle department
        const otherDept = cycleDepts.find(dept => dept.id !== currentCycleDeptId);
        return otherDept?.id || null;
    },

    /**
     * End the current semester for a batch.
     * This triggers student progression:
     * - Sem 1 -> 2: Swap PHY <-> CHEM
     * - Sem 2 -> 3: Move to opted department
     * - Sem 3+ -> Next: Normal progression
     */
    async endSemester(batchId: number, adminId: number): Promise<{
        batchId: number;
        previousSemester: number;
        newSemester: number;
        studentsProgressed: number;
        swapInfo?: { phyToChem: number; chemToPhy: number };
        isGraduation?: boolean;
    }> {
        // Get batch info
        const batch = await prisma.batch.findUnique({
            where: { id: batchId },
        });

        if (!batch) {
            throw new Error('Batch not found');
        }

        const currentSem = batch.currentSemester;
        const newSem = currentSem + 1;

        if (currentSem > 8) {
            throw new Error('Batch has already graduated');
        }

        // Special handling for graduation (Semester 8 -> Graduated)
        if (currentSem === 8) {
            // Get all students in this batch
            const students = await prisma.studentProfile.findMany({
                where: { batchId },
            });

            // Mark all students as graduated
            await prisma.studentProfile.updateMany({
                where: { batchId },
                data: {
                    currentSemester: 9, // Mark as graduated
                    // Note: We don't delete students, just mark them as graduated
                },
            });

            // Mark batch as graduated
            await prisma.batch.update({
                where: { id: batchId },
                data: {
                    currentSemester: 9,
                    isGraduated: true,
                    graduatedAt: new Date(),
                },
            });

            return {
                batchId,
                previousSemester: 8,
                newSemester: 9,
                studentsProgressed: students.length,
                isGraduation: true,
            };
        }

        // Normal semester progression (1-7)
        if (currentSem >= 9) {
            throw new Error('Cannot progress beyond graduation');
        }

        // Get all students in this batch
        const students = await prisma.studentProfile.findMany({
            where: { batchId },
            include: {
                user: true,
                cycleDepartment: true,
                optedDepartment: true,
            },
        });

        let studentsProgressed = students.length;
        let phyToChem = 0;
        let chemToPhy = 0;

        const cycleDepts = await this.getCycleDepartments();
        const phyDept = cycleDepts.find(d => d.code === 'PHY');
        const chemDept = cycleDepts.find(d => d.code === 'CHEM');

        const updates: any[] = [];

        if (currentSem === 1 && phyDept && chemDept) {
            // Semester 1 -> 2: Swap cycle departments
            const phyUserIds = students.filter(s => s.cycleDepartmentId === phyDept.id).map(s => s.userId);
            const chemUserIds = students.filter(s => s.cycleDepartmentId === chemDept.id).map(s => s.userId);

            phyToChem = phyUserIds.length;
            chemToPhy = chemUserIds.length;

            if (phyUserIds.length > 0) {
                updates.push(prisma.studentProfile.updateMany({
                    where: { userId: { in: phyUserIds } },
                    data: { currentSemester: 2, cycleDepartmentId: chemDept.id },
                }));
                updates.push(prisma.user.updateMany({
                    where: { id: { in: phyUserIds } },
                    data: { departmentId: chemDept.id },
                }));
            }

            if (chemUserIds.length > 0) {
                updates.push(prisma.studentProfile.updateMany({
                    where: { userId: { in: chemUserIds } },
                    data: { currentSemester: 2, cycleDepartmentId: phyDept.id },
                }));
                updates.push(prisma.user.updateMany({
                    where: { id: { in: chemUserIds } },
                    data: { departmentId: phyDept.id },
                }));
            }
        } else if (currentSem === 2) {
            // Semester 2 -> 3: Move to opted department
            // Group students by opted department to minimize queries
            const groupedByDept = students.reduce((acc, student) => {
                const deptId = student.optedDepartmentId;
                if (deptId) {
                    if (!acc[deptId]) acc[deptId] = [];
                    acc[deptId].push(student.userId);
                }
                return acc;
            }, {} as Record<number, number[]>);

            for (const [deptIdStr, userIds] of Object.entries(groupedByDept)) {
                const deptId = parseInt(deptIdStr, 10);
                updates.push(prisma.studentProfile.updateMany({
                    where: { userId: { in: userIds } },
                    data: { currentSemester: 3, cycleDepartmentId: null },
                }));
                updates.push(prisma.user.updateMany({
                    where: { id: { in: userIds } },
                    data: { departmentId: deptId },
                }));
            }
        } else {
            // Semester 3+: Just update semester number
            updates.push(prisma.studentProfile.updateMany({
                where: { batchId },
                data: { currentSemester: newSem },
            }));
        }

        // Update batch semester
        updates.push(prisma.batch.update({
            where: { id: batchId },
            data: { currentSemester: newSem },
        }));

        // Execute all updates in a single transaction
        await prisma.$transaction(updates);

        return {
            batchId,
            previousSemester: currentSem,
            newSemester: newSem,
            studentsProgressed,
            ...(currentSem === 1 && { swapInfo: { phyToChem, chemToPhy } }),
        };
    },

    /**
     * Get the effective department for a student based on their current semester.
     * Used for department-based visibility filtering.
     */
    getEffectiveDepartmentId(student: {
        currentSemester: number;
        cycleDepartmentId?: number | null;
        optedDepartmentId?: number | null;
    }): number | null {
        if (student.currentSemester <= 2) {
            return student.cycleDepartmentId || null;
        }
        return student.optedDepartmentId || null;
    },
};
