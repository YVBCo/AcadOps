
import { UploadStatus } from '@prisma/client';
import prisma from '../data-access/prisma.js';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { excelParserService, type MarksEntry } from './excel-parser.service.js';

const log = logger.child({ module: 'semester-marks' });

interface ValidationError {
    usn: string;
    error: string;
}

interface ValidationResult {
    valid: MarksEntry[];
    invalid: ValidationError[];
}

interface UploadContext {
    batchId: number;
    departmentId: number;
    semesterNumber: number;
    courseId: number;
}

class SemesterMarksService {
    /**
     * Upload and parse Excel file
     */
    async uploadMarks(
        fileBuffer: Buffer,
        fileName: string,
        context: UploadContext,
        uploadedBy: number
    ) {
        // Parse Excel file
        const parsed = await excelParserService.parseMarksSheet(fileBuffer);

        // Validate context (if metadata found in Excel, compare with selected context)
        if (parsed.metadata) {
            await this.validateContext(parsed.metadata, context);
        }

        // Validate entries
        const { valid, invalid, studentIdMap } = await this.validateEntries(parsed.entries, context);

        log.info({ fileName, total: parsed.entries.length, valid: valid.length, invalid: invalid.length }, 'Upload parsed');
        if (invalid.length > 0) {
            log.debug({ sample: invalid.slice(0, 5) }, 'Invalid entries');
        }

        // Create upload record
        const upload = await prisma.semesterMarkUpload.create({
            data: {
                batchId: context.batchId,
                departmentId: context.departmentId,
                semesterNumber: context.semesterNumber,
                courseId: context.courseId,
                uploadedBy,
                fileName,
                status: 'PENDING',
                marks: {
                    create: valid.map(entry => ({
                        studentUsn: entry.usn,
                        studentId: studentIdMap[entry.usn],  // Resolved student ID
                        courseId: context.courseId,
                        externalMarksRaw: entry.marks,
                        externalMarks: entry.convertedMarks,
                    })),
                },
            },
            include: {
                marks: true,
                batch: true,
                department: true,
                course: true,
            },
        });

        return {
            upload,
            validCount: valid.length,
            invalidCount: invalid.length,
            errors: invalid,
            columnMapping: parsed.columnMapping,
            sampleRows: parsed.sampleRows,
        };
    }

    /**
     * Validate that Excel metadata matches selected context
     */
    private async validateContext(metadata: any, context: UploadContext): Promise<void> {
        const errors: string[] = [];

        // Fetch context details
        const batch = await prisma.batch.findUnique({ where: { id: context.batchId } });
        const department = await prisma.department.findUnique({ where: { id: context.departmentId } });

        if (metadata.batch && batch && metadata.batch !== batch.name) {
            errors.push(`Excel shows Batch ${metadata.batch} but you selected Batch ${batch.name} `);
        }

        if (metadata.department && department && metadata.department !== department.code) {
            errors.push(`Excel shows Department ${metadata.department} but you selected ${department.code} `);
        }

        if (metadata.semester && metadata.semester !== context.semesterNumber) {
            errors.push(`Excel shows Semester ${metadata.semester} but you selected Semester ${context.semesterNumber} `);
        }

        if (errors.length > 0) {
            throw new Error(`Context mismatch: \n${errors.join('\n')} `);
        }
    }

    /**
     * Validate individual mark entries — OPTIMIZED with batch lookup
     */
    private async validateEntries(
        entries: MarksEntry[],
        context: UploadContext
    ): Promise<ValidationResult & { studentIdMap: Record<string, number> }> {
        const valid: MarksEntry[] = [];
        const invalid: ValidationError[] = [];
        const studentIdMap: Record<string, number> = {};

        // ── Pre-fetch department name once (for error messages) ──────
        const dept = await prisma.department.findUnique({ where: { id: context.departmentId }, select: { code: true } });

        // ── Batch-fetch all students by USN in a single query ────────
        const allUsns = entries.map(e => e.usn);
        const students = await prisma.user.findMany({
            where: {
                OR: [
                    { studentProfile: { temporaryUsn: { in: allUsns } } },
                    { studentProfile: { permanentUsn: { in: allUsns } } },
                    { studentProfile: { rollNumber: { in: allUsns } } },
                ],
            },
            include: { studentProfile: true },
        });

        // ── Build USN → student map for O(1) lookup ─────────────────
        const studentByUsn = new Map<string, typeof students[0]>();
        for (const s of students) {
            if (s.studentProfile) {
                if (s.studentProfile.temporaryUsn) studentByUsn.set(s.studentProfile.temporaryUsn, s);
                if (s.studentProfile.permanentUsn) studentByUsn.set(s.studentProfile.permanentUsn, s);
                if (s.studentProfile.rollNumber) studentByUsn.set(s.studentProfile.rollNumber, s);
            }
        }

        // ── Validate entries in-memory (no DB calls) ─────────────────
        for (const entry of entries) {
            // 1. Check if USN exists
            const student = studentByUsn.get(entry.usn);

            if (!student || !student.studentProfile) {
                invalid.push({ usn: entry.usn, error: 'USN not found in database' });
                continue;
            }

            // 2. Check if student belongs to the department
            if (student.departmentId !== context.departmentId) {
                invalid.push({
                    usn: entry.usn,
                    error: `Student belongs to different department, not ${dept?.code} `
                });
                continue;
            }

            // 3. Check if student belongs to the batch
            if (student.studentProfile.batchId !== context.batchId) {
                invalid.push({ usn: entry.usn, error: 'Student not in selected batch' });
                continue;
            }

            // 4. Check marks validity (should be 0-100)
            if (entry.marks < 0 || entry.marks > 100) {
                invalid.push({ usn: entry.usn, error: `Marks ${entry.marks} out of valid range(0 - 100)` });
                continue;
            }

            // All validations passed
            valid.push(entry);
            studentIdMap[entry.usn] = student.id;
        }

        return { valid, invalid, studentIdMap };
    }

    /**
     * Get all uploads for COE review
     */
    async getUploadsForReview(status?: UploadStatus) {
        return prisma.semesterMarkUpload.findMany({
            where: status ? { status } : undefined,
            include: {
                batch: true,
                department: true,
                course: true,
                uploader: { select: { name: true, email: true } },
                marks: {
                    take: 5,  // Preview first 5 entries
                },
                _count: {
                    select: { marks: true },
                },
            },
            orderBy: { uploadedAt: 'desc' },
        });
    }

    /**
     * Get upload details by ID
     */
    async getUploadById(id: number) {
        return prisma.semesterMarkUpload.findUnique({
            where: { id },
            include: {
                batch: true,
                department: true,
                course: true,
                uploader: { select: { name: true, email: true } },
                reviewer: { select: { name: true, email: true } },
                poster: { select: { name: true, email: true } },
                marks: true,
            },
        });
    }

    /**
     * COE approves marks upload
     */
    async approveUpload(uploadId: number, reviewedBy: number, reviewNotes?: string) {
        return prisma.semesterMarkUpload.update({
            where: { id: uploadId },
            data: {
                status: 'APPROVED',
                reviewedBy,
                reviewedAt: new Date(),
                reviewNotes,
            },
        });
    }

    /**
     * COE rejects marks upload
     */
    async rejectUpload(uploadId: number, reviewedBy: number, reviewNotes: string) {
        return prisma.semesterMarkUpload.update({
            where: { id: uploadId },
            data: {
                status: 'REJECTED',
                reviewedBy,
                reviewedAt: new Date(),
                reviewNotes,
            },
        });
    }

    /**
     * COE posts results (makes visible to students)
     */
    async postResults(uploadId: number, postedBy: number) {
        return prisma.semesterMarkUpload.update({
            where: { id: uploadId },
            data: {
                status: 'POSTED',
                postedBy,
                postedAt: new Date(),
            },
        });
    }

    /**
     * Edit marks for a specific student in an upload
     */
    async editMarks(entryId: number, newMarks: number) {
        const converted = excelParserService.convertMarks(newMarks);

        return prisma.semesterMarkEntry.update({
            where: { id: entryId },
            data: {
                externalMarksRaw: newMarks,
                externalMarks: converted,
            },
        });
    }

    /**
     * Save parsing correction to improve auto-detection
     */
    async saveCorrectionCorrection(
        uploadId: number,
        fieldType: string,
        originalValue: string,
        correctedValue: string,
        excelPattern: string,
        correctedBy: number
    ) {
        return prisma.parsingCorrection.create({
            data: {
                uploadId,
                fieldType,
                originalValue,
                correctedValue,
                excelPattern,
                correctedBy,
            },
        });
    }
}

export const semesterMarksService = new SemesterMarksService();
