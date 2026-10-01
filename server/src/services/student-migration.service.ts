import { prisma } from '../data-access/prisma.js';
import { auditLogRepository } from '../data-access/audit-log.repository.js';
import { Prisma } from '@prisma/client';
import { ExtendedTransactionClient } from '../data-access/prisma.js';

class StudentMigrationService {
    /**
     * Physics Department Code/Name
     * Ensure these match your seed data or DB constants
     */
    private PHYSICS_DEPT_CODE = 'PHY';
    private CHEMISTRY_DEPT_CODE = 'CHE';

    /**
     * Assigns First Year Cycle (Physics or Chemistry) to students in a batch
     * This updates the User.departmentId, NOT the StudentProfile.programId
     */
    async assignFirstYearCycles(
        batchId: number,
        cycleType: 'PHYSICS' | 'CHEMISTRY',
        actorId: number
    ): Promise<number> {
        // Find the target department
        const targetDeptCode = cycleType === 'PHYSICS' ? this.PHYSICS_DEPT_CODE : this.CHEMISTRY_DEPT_CODE;
        const department = await prisma.department.findFirst({
            where: { code: targetDeptCode }
        });

        if (!department) {
            throw new Error(`Department with code ${targetDeptCode} not found. Please ensure Physics/Chemistry departments check seeded.`);
        }

        // Update User.departmentId for all students in this batch
        // We only touch User.departmentId, preserving StudentProfile.programId (Home Branch)
        const result = await prisma.user.updateMany({
            where: {
                studentProfile: {
                    batchId: batchId
                }
            },
            data: {
                departmentId: department.id
            }
        });

        await auditLogRepository.create({
            actorId,
            action: 'ASSIGN_BATCH_CYCLE',
            entityType: 'Batch',
            entityId: batchId,
            newValue: { cycle: cycleType, departmentId: department.id, count: result.count } as Prisma.JsonValue
        });

        return result.count;
    }

    /**
     * Rotates students between Physics and Chemistry departments.
     * Physics -> Chemistry
     * Chemistry -> Physics
     */
    async rotateFirstYearCycles(batchId: number, actorId: number): Promise<{ physicsToChem: number, chemToPhysics: number }> {
        const physicsDept = await prisma.department.findFirst({ where: { code: this.PHYSICS_DEPT_CODE } });
        const chemistryDept = await prisma.department.findFirst({ where: { code: this.CHEMISTRY_DEPT_CODE } });

        if (!physicsDept || !chemistryDept) {
            throw new Error('Physics or Chemistry department not found');
        }

        // 1. Move Physics -> Temp (or handle with transaction to swap)
        // Since we can't swap in one go easily without complex SQL, we'll do:
        // Phy -> Null (marker) -> Chem
        // This is risky if it fails midway. 
        // Better approach: Fetch IDs and update in transaction.

        return await prisma.$transaction(async (tx) => {
            // Find students currently in Physics (User.departmentId)
            const physicsStudentsVals = await tx.user.findMany({
                where: {
                    studentProfile: { batchId },
                    departmentId: physicsDept.id
                },
                select: { id: true }
            });
            const physicsStudentIds = physicsStudentsVals.map((u: { id: number }) => u.id);

            // Find students currently in Chemistry
            const chemStudentsVals = await tx.user.findMany({
                where: {
                    studentProfile: { batchId },
                    departmentId: chemistryDept.id
                },
                select: { id: true }
            });
            const chemStudentIds = chemStudentsVals.map((u: { id: number }) => u.id);

            // Update Physics -> Chemistry
            const p2c = await tx.user.updateMany({
                where: { id: { in: physicsStudentIds } },
                data: { departmentId: chemistryDept.id }
            });

            // Update Chemistry -> Physics
            const c2p = await tx.user.updateMany({
                where: { id: { in: chemStudentIds } },
                data: { departmentId: physicsDept.id }
            });

            await auditLogRepository.create({
                actorId,
                action: 'ROTATE_BATCH_CYCLES',
                entityType: 'Batch',
                entityId: batchId,
                newValue: {
                    physicsToChem: p2c.count,
                    chemToPhysics: c2p.count
                } as Prisma.JsonValue
            }, tx); // Pass transaction context if auditRepo supports it, otherwise await after

            return { physicsToChem: p2c.count, chemToPhysics: c2p.count };
        });
    }

    /**
     * Restores students to their Home Branch (Program Department).
     * Used after Year 1 is complete (Sem 2 Close).
     * Updates User.departmentId to match the first department from StudentProfile.program.departments
     */
    async restoreToBranch(batchId: number, actorId: number): Promise<number> {
        // Fetch all students in the batch with their Program Department info
        const students = await prisma.studentProfile.findMany({
            where: { batchId },
            include: {
                program: {
                    include: { departments: true } // Many-to-Many relation
                },
                user: true
            }
        });

        let updatedCount = 0;

        // Perform updates in a transaction for safety
        await prisma.$transaction(async (tx) => {
            for (const student of students) {
                // Get the first department from the program's departments array
                const programDeptId = student.program?.departments?.[0]?.id;
                // If Program Dept ID differs from Current User Dept ID, sync it
                if (programDeptId && programDeptId !== student.user.departmentId) {
                    await tx.user.update({
                        where: { id: student.userId },
                        data: { departmentId: programDeptId }
                    });
                    updatedCount++;
                }
            }

            await auditLogRepository.create({
                actorId,
                action: 'RESTORE_BATCH_TO_BRANCH',
                entityType: 'Batch',
                entityId: batchId,
                newValue: { updatedCount } as Prisma.JsonValue
            }, tx);
        });

        return updatedCount;
    }
}

export const studentMigrationService = new StudentMigrationService();
