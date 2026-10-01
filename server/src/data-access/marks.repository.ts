import { prisma } from './prisma.js';
import { Marks, ExamType, Prisma } from '@prisma/client';

export interface CreateMarksData {
    studentId: number;
    subjectId: number;
    examType: ExamType;
    score: number;
    maxScore?: number;
    remarks?: string;
}

export interface UpdateMarksData {
    score?: number;
    maxScore?: number;
    remarks?: string;
}

export const marksRepository = {
    async create(data: CreateMarksData): Promise<Marks> {
        return prisma.marks.create({
            data,
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
                subject: {
                    include: { course: { select: { id: true, name: true, code: true } } },
                },
            },
        });
    },

    async upsert(data: CreateMarksData): Promise<Marks> {
        return prisma.marks.upsert({
            where: {
                studentId_subjectId_examType: {
                    studentId: data.studentId,
                    subjectId: data.subjectId,
                    examType: data.examType,
                },
            },
            update: {
                score: data.score,
                maxScore: data.maxScore,
                remarks: data.remarks,
                gradedAt: new Date(),
            },
            create: data,
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
                subject: {
                    include: { course: { select: { id: true, name: true, code: true } } },
                },
            },
        });
    },

    async findById(id: number): Promise<Marks | null> {
        return prisma.marks.findUnique({
            where: { id },
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
                subject: {
                    include: { course: { select: { id: true, name: true, code: true } } },
                },
            },
        });
    },

    async findByStudentAndSubject(studentId: number, subjectId: number): Promise<Marks[]> {
        return prisma.marks.findMany({
            where: { studentId, subjectId },
            orderBy: { gradedAt: 'desc' },
        });
    },

    async findBySubject(subjectId: number): Promise<Marks[]> {
        return prisma.marks.findMany({
            where: { subjectId },
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
            orderBy: [{ examType: 'asc' }, { student: { user: { name: 'asc' } } }],
        });
    },

    async findBySubjectAndExamType(subjectId: number, examType: ExamType): Promise<Marks[]> {
        return prisma.marks.findMany({
            where: { subjectId, examType },
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
            orderBy: { student: { user: { name: 'asc' } } },
        });
    },

    async findByStudent(studentId: number): Promise<Marks[]> {
        return prisma.marks.findMany({
            where: { studentId },
            include: {
                subject: {
                    include: { course: { select: { id: true, name: true, code: true } } },
                },
            },
            orderBy: [{ subject: { course: { name: 'asc' } } }, { examType: 'asc' }],
        });
    },

    async update(id: number, data: UpdateMarksData): Promise<Marks> {
        return prisma.marks.update({
            where: { id },
            data: {
                ...data,
                gradedAt: new Date(),
            },
            include: {
                student: {
                    include: { user: { select: { id: true, name: true, email: true } } },
                },
            },
        });
    },

    async delete(id: number): Promise<void> {
        await prisma.marks.delete({ where: { id } });
    },

    // Get grade summary for a subject
    async getSubjectGradeSummary(subjectId: number): Promise<{
        examType: ExamType;
        avgScore: number;
        maxScore: number;
        minScore: number;
        count: number;
    }[]> {
        const result = await prisma.marks.groupBy({
            by: ['examType'],
            where: { subjectId },
            _avg: { score: true },
            _max: { score: true },
            _min: { score: true },
            _count: { score: true },
        });

        return result.map((r) => ({
            examType: r.examType,
            avgScore: r._avg.score || 0,
            maxScore: r._max.score || 0,
            minScore: r._min.score || 0,
            count: r._count.score,
        }));
    },

    // Get student's grade report
    async getStudentGradeReport(studentId: number, subjectId?: number): Promise<{
        subjectId: number;
        subjectName: string;
        courseCode: string;
        marks: { examType: ExamType; score: number; maxScore: number; percentage: number }[];
        totalScore: number;
        totalMaxScore: number;
        percentage: number;
    }[]> {
        const whereClause: Prisma.MarksWhereInput = { studentId };
        if (subjectId) whereClause.subjectId = subjectId;

        const marks = await prisma.marks.findMany({
            where: whereClause,
            include: {
                subject: {
                    include: { course: { select: { id: true, name: true, code: true } } },
                },
            },
            orderBy: { examType: 'asc' },
        });

        // Group by subject
        const subjectMap = new Map<number, {
            subjectId: number;
            subjectName: string;
            courseCode: string;
            marks: { examType: ExamType; score: number; maxScore: number; percentage: number }[];
        }>();

        marks.forEach((m) => {
            if (!subjectMap.has(m.subjectId)) {
                subjectMap.set(m.subjectId, {
                    subjectId: m.subjectId,
                    subjectName: m.subject.course.name,
                    courseCode: m.subject.course.code,
                    marks: [],
                });
            }
            const entry = subjectMap.get(m.subjectId)!;
            entry.marks.push({
                examType: m.examType,
                score: m.score,
                maxScore: m.maxScore,
                percentage: (m.score / m.maxScore) * 100,
            });
        });

        // Calculate totals
        return Array.from(subjectMap.values()).map((entry) => ({
            ...entry,
            totalScore: entry.marks.reduce((acc, m) => acc + m.score, 0),
            totalMaxScore: entry.marks.reduce((acc, m) => acc + m.maxScore, 0),
            percentage: entry.marks.length > 0
                ? (entry.marks.reduce((acc, m) => acc + m.score, 0) /
                    entry.marks.reduce((acc, m) => acc + m.maxScore, 0)) * 100
                : 0,
        }));
    },
};
