import { Marks, ExamType, Prisma } from '@prisma/client';
import { marksRepository, CreateMarksData, UpdateMarksData } from '../data-access/marks.repository.js';
import { subjectRepository } from '../data-access/subject.repository.js';
import { semesterRepository } from '../data-access/semester.repository.js';
import { auditLogRepository } from '../data-access/audit-log.repository.js';
import { prisma } from '../data-access/prisma.js';

export const marksService = {
    // Record marks for a student
    async recordMarks(
        data: CreateMarksData,
        actorId: number
    ): Promise<Marks> {
        // Verify subject exists
        const subject = await subjectRepository.findById(data.subjectId);
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(subject.semesterId);
        if (!isActive) {
            throw new Error('Cannot record marks in a closed semester');
        }

        // Verify student is enrolled
        const enrollment = await prisma.enrollment.findUnique({
            where: {
                studentId_subjectId: {
                    studentId: data.studentId,
                    subjectId: data.subjectId,
                },
            },
        });
        if (!enrollment) {
            throw new Error('Student is not enrolled in this subject');
        }

        // Validate score
        const maxScore = data.maxScore || 100;
        if (data.score < 0 || data.score > maxScore) {
            throw new Error(`Score must be between 0 and ${maxScore}`);
        }

        const marks = await marksRepository.upsert(data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'RECORD_MARKS',
            entityType: 'Marks',
            entityId: marks.id,
            newValue: {
                studentId: data.studentId,
                subjectId: data.subjectId,
                examType: data.examType,
                score: data.score
            } as unknown as Prisma.JsonValue,
        });

        return marks;
    },

    // Bulk record marks for an exam type
    async bulkRecordMarks(
        subjectId: number,
        examType: ExamType,
        entries: Array<{ studentId: number; score: number; remarks?: string }>,
        maxScore: number,
        actorId: number
    ): Promise<{ created: number; updated: number }> {
        // Verify subject exists
        const subject = await subjectRepository.findById(subjectId);
        if (!subject) {
            throw new Error('Subject not found');
        }

        // Check semester is ACTIVE
        const isActive = await semesterRepository.isActive(subject.semesterId);
        if (!isActive) {
            throw new Error('Cannot record marks in a closed semester');
        }

        let created = 0;
        let updated = 0;

        for (const entry of entries) {
            // Validate score
            if (entry.score < 0 || entry.score > maxScore) {
                throw new Error(`Score for student ${entry.studentId} must be between 0 and ${maxScore}`);
            }

            const existing = await prisma.marks.findUnique({
                where: {
                    studentId_subjectId_examType: {
                        studentId: entry.studentId,
                        subjectId,
                        examType,
                    },
                },
            });

            await marksRepository.upsert({
                studentId: entry.studentId,
                subjectId,
                examType,
                score: entry.score,
                maxScore,
                remarks: entry.remarks,
            });

            if (existing) {
                updated++;
            } else {
                created++;
            }
        }

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'BULK_RECORD_MARKS',
            entityType: 'Marks',
            entityId: subjectId,
            newValue: { subjectId, examType, count: entries.length } as unknown as Prisma.JsonValue,
        });

        return { created, updated };
    },

    // Get marks by subject
    async getMarksBySubject(subjectId: number): Promise<Marks[]> {
        return marksRepository.findBySubject(subjectId);
    },

    // Get marks by subject and exam type
    async getMarksBySubjectAndExamType(subjectId: number, examType: ExamType): Promise<Marks[]> {
        return marksRepository.findBySubjectAndExamType(subjectId, examType);
    },

    // Get student's marks
    async getStudentMarks(studentId: number, subjectId?: number): Promise<Marks[]> {
        if (subjectId) {
            return marksRepository.findByStudentAndSubject(studentId, subjectId);
        }
        return marksRepository.findByStudent(studentId);
    },

    // Get subject grade summary
    async getSubjectGradeSummary(subjectId: number) {
        return marksRepository.getSubjectGradeSummary(subjectId);
    },

    // Get student grade report
    async getStudentGradeReport(studentId: number, subjectId?: number) {
        return marksRepository.getStudentGradeReport(studentId, subjectId);
    },

    // Get enrolled students for grading
    async getEnrolledStudentsForGrading(subjectId: number, examType: ExamType) {
        // Get enrolled students
        const enrollments = await prisma.enrollment.findMany({
            where: { subjectId },
            include: {
                student: {
                    include: {
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
            },
            orderBy: { student: { user: { name: 'asc' } } },
        });

        // Get existing marks for this exam type
        const existingMarks = await marksRepository.findBySubjectAndExamType(subjectId, examType);
        const marksMap = new Map(
            existingMarks.map((m) => [m.studentId, m])
        );

        // Merge data
        return enrollments.map((enrollment) => ({
            studentId: enrollment.studentId,
            studentName: enrollment.student.user.name,
            email: enrollment.student.user.email,
            rollNumber: enrollment.student.rollNumber,
            marks: marksMap.get(enrollment.studentId) || null,
        }));
    },

    // Update marks
    async updateMarks(id: number, data: UpdateMarksData, actorId: number): Promise<Marks> {
        const existing = await marksRepository.findById(id);
        if (!existing) {
            throw new Error('Marks not found');
        }

        const marks = await marksRepository.update(id, data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'UPDATE_MARKS',
            entityType: 'Marks',
            entityId: id,
            oldValue: { score: existing.score } as Prisma.JsonValue,
            newValue: data as unknown as Prisma.JsonValue,
        });

        return marks;
    },

    // Delete marks
    async deleteMarks(id: number, actorId: number): Promise<void> {
        const existing = await marksRepository.findById(id);
        if (!existing) {
            throw new Error('Marks not found');
        }

        await marksRepository.delete(id);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'DELETE_MARKS',
            entityType: 'Marks',
            entityId: id,
            oldValue: { studentId: existing.studentId, score: existing.score } as Prisma.JsonValue,
        });
    },
};
