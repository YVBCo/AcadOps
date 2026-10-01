import { prisma } from './prisma.js';
import { Subject } from '@prisma/client';

export interface CreateSubjectData {
    courseId: number;
    semesterId: number;
    section: string;
}

export interface UpdateSubjectData {
    section?: string;
}

export const subjectRepository = {
    async create(data: CreateSubjectData): Promise<Subject> {
        return prisma.subject.create({
            data,
            include: {
                course: { include: { department: true } },
                semester: true,
                teachers: { include: { teacher: { include: { user: true } } } },
            },
        });
    },

    async findById(id: number): Promise<Subject | null> {
        return prisma.subject.findUnique({
            where: { id },
            include: {
                course: { include: { department: true, program: true } },
                semester: true,
                teachers: { include: { teacher: { include: { user: true } } } },
                enrollments: { include: { student: { include: { user: true } } } },
                _count: { select: { enrollments: true, attendances: true, assignments: true } },
            },
        });
    },

    async findBySemester(semesterId: number): Promise<Subject[]> {
        return prisma.subject.findMany({
            where: { semesterId },
            include: {
                course: { include: { department: true } },
                teachers: { include: { teacher: { include: { user: true } } } },
                _count: { select: { enrollments: true } },
            },
            orderBy: [{ course: { code: 'asc' } }, { section: 'asc' }],
        });
    },

    async findByDepartmentAndSemester(departmentId: number, semesterId: number): Promise<Subject[]> {
        return prisma.subject.findMany({
            where: {
                semesterId,
                course: { departmentId },
            },
            include: {
                course: true,
                teachers: { include: { teacher: { include: { user: true } } } },
                _count: { select: { enrollments: true } },
            },
            orderBy: [{ course: { code: 'asc' } }, { section: 'asc' }],
        });
    },

    async findByTeacher(teacherProfileId: number): Promise<Subject[]> {
        return prisma.subject.findMany({
            where: {
                teachers: { some: { teacherId: teacherProfileId } },
            },
            include: {
                course: { include: { department: true } },
                semester: true,
                _count: { select: { enrollments: true } },
            },
            orderBy: [{ semester: { startDate: 'desc' } }, { course: { code: 'asc' } }],
        });
    },

    async findByStudent(studentProfileId: number): Promise<Subject[]> {
        return prisma.subject.findMany({
            where: {
                enrollments: { some: { studentId: studentProfileId } },
            },
            include: {
                course: { include: { department: true } },
                semester: true,
                teachers: { include: { teacher: { include: { user: true } } } },
            },
            orderBy: [{ semester: { startDate: 'desc' } }, { course: { code: 'asc' } }],
        });
    },

    async findUnique(courseId: number, semesterId: number, section: string): Promise<Subject | null> {
        return prisma.subject.findUnique({
            where: {
                courseId_semesterId_section: { courseId, semesterId, section },
            },
        });
    },

    async update(id: number, data: UpdateSubjectData): Promise<Subject> {
        return prisma.subject.update({
            where: { id },
            data,
            include: {
                course: { include: { department: true } },
                semester: true,
            },
        });
    },

    async delete(id: number): Promise<void> {
        await prisma.subject.delete({ where: { id } });
    },

    // Teacher assignment
    async assignTeacher(subjectId: number, teacherId: number, isPrimary: boolean = false): Promise<void> {
        await prisma.subjectTeacher.create({
            data: { subjectId, teacherId, isPrimary },
        });
    },

    async removeTeacher(subjectId: number, teacherId: number): Promise<void> {
        await prisma.subjectTeacher.delete({
            where: { subjectId_teacherId: { subjectId, teacherId } },
        });
    },

    // Student enrollment
    async enrollStudent(subjectId: number, studentId: number): Promise<void> {
        await prisma.enrollment.create({
            data: { subjectId, studentId },
        });
    },

    async unenrollStudent(subjectId: number, studentId: number): Promise<void> {
        await prisma.enrollment.delete({
            where: { studentId_subjectId: { subjectId, studentId } },
        });
    },
};

export type SubjectRepository = typeof subjectRepository;
