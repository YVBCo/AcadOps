import { prisma } from '../data-access/prisma.js';

/**
 * Semester Lock Utility
 * 
 * Checks if data for a specific semester is locked (read-only) based on batch progression.
 * Data becomes locked when batch.currentSemester > dataSemester
 * 
 * Exceptions: MAKEUP, REVALUATION, REWRITE operations bypass the lock
 */

export type EditType = 'REGULAR' | 'MAKEUP' | 'REVALUATION' | 'REWRITE';

/**
 * Check if semester data is locked for a batch
 * @param batchId - The batch ID to check
 * @param semesterNumber - The semester number of the data being modified
 * @returns true if data is locked (read-only), false if editable
 */
export async function isSemesterLocked(
    batchId: number,
    semesterNumber: number
): Promise<boolean> {
    const batch = await prisma.batch.findUnique({
        where: { id: batchId },
        select: { currentSemester: true, isGraduated: true }
    });

    if (!batch) {
        throw new Error(`Batch ${batchId} not found`);
    }

    // If graduated, all semesters are locked
    if (batch.isGraduated) {
        return true;
    }

    // Data is locked if current semester is ahead of the data's semester
    return batch.currentSemester > semesterNumber;
}

/**
 * Validate that data can be modified (throws error if locked)
 * @param batchId - The batch ID
 * @param semesterNumber - The semester number of the data
 * @param operation - Description of the operation (for error message)
 * @param editType - Type of edit (REGULAR ops are blocked, MAKEUP/REVALUATION/REWRITE allowed)
 */
export async function validateNotLocked(
    batchId: number,
    semesterNumber: number,
    operation: string,
    editType: EditType = 'REGULAR'
): Promise<void> {
    // Exception: Makeup, Revaluation, and Rewrite operations bypass semester lock
    if (editType !== 'REGULAR') {
        return; // Allow modification
    }

    const locked = await isSemesterLocked(batchId, semesterNumber);

    if (locked) {
        throw new Error(
            `Cannot ${operation}: Semester ${semesterNumber} data is locked. ` +
            `The batch has progressed to a later semester. ` +
            `Only makeup, revaluation, or rewrite operations are allowed.`
        );
    }
}

/**
 * Get the current semester for a batch
 */
export async function getBatchCurrentSemester(batchId: number): Promise<number> {
    const batch = await prisma.batch.findUnique({
        where: { id: batchId },
        select: { currentSemester: true }
    });

    if (!batch) {
        throw new Error(`Batch ${batchId} not found`);
    }

    return batch.currentSemester;
}
