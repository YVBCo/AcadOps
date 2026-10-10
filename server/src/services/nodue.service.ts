import prisma from '../data-access/prisma.js';
import { NodueClearanceStage, NodueDueStatus, NoduePaymentStatus, NodueDueType } from '@prisma/client';

class NodueService {
    async logActivity(tenantId: number, userId: number, userRole: string, action: string, details?: string, targetId?: number) {
        return prisma.nodueActivityLog.create({
            data: {
                tenantId,
                userId,
                userRole,
                action,
                details,
                targetId,
            },
        });
    }

    async getActivityLogs(tenantId: number, limit: number = 50) {
        return prisma.nodueActivityLog.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                user: { select: { name: true, email: true } },
            },
        });
    }

    async getClearanceRequest(tenantId: number, studentId: number) {
        let request = await prisma.nodueClearanceRequest.findFirst({
            where: { tenantId, studentId },
            include: { template: true },
        });

        if (!request) {
            request = await prisma.nodueClearanceRequest.create({
                data: {
                    tenantId,
                    studentId,
                    currentStage: NodueClearanceStage.STUDENT_APPLICATION,
                    status: NodueDueStatus.PENDING,
                },
                include: { template: true },
            });
        }
        return request;
    }

    async applyClearance(tenantId: number, studentId: number) {
        const enrollments = await prisma.nodueSubjectEnrollment.findMany({
            where: { tenantId, studentId },
            select: { id: true },
        });
        if (enrollments.length === 0) {
            throw new Error('You must be enrolled in at least one subject before applying for clearance');
        }

        const request = await this.getClearanceRequest(tenantId, studentId);
        
        if (request.currentStage !== NodueClearanceStage.STUDENT_APPLICATION) {
            throw new Error('Clearance already applied or in progress');
        }

        const updated = await prisma.nodueClearanceRequest.update({
            where: { id: request.id },
            data: { currentStage: NodueClearanceStage.FACULTY_REVIEW },
        });

        await this.evaluateClearanceStage(tenantId, studentId);
        return updated;
    }

    async getEnrollmentsForFaculty(tenantId: number, teacherId?: number) {
        return prisma.nodueSubjectEnrollment.findMany({
            where: { tenantId, ...(teacherId !== undefined ? { teacherId } : {}) },
            include: {
                student: { include: { studentProfile: { select: { rollNumber: true } } } },
                subject: { select: { id: true, course: { select: { name: true, code: true } } } }
            }
        });
    }

    async clearSubject(tenantId: number, enrollmentId: number, teacherId: number | undefined, data: { status: NodueDueStatus, remarks?: string }) {
        const enrollment = await prisma.nodueSubjectEnrollment.findFirst({
            where: { id: enrollmentId, tenantId, ...(teacherId !== undefined ? { teacherId } : {}) },
        });

        if (!enrollment) throw new Error('Enrollment not found or unauthorized');

        const updated = await prisma.nodueSubjectEnrollment.update({
            where: { id: enrollmentId },
            data: {
                status: data.status,
                isFacultyCleared: data.status === NodueDueStatus.COMPLETED,
                remarks: data.remarks,
            },
        });

        await this.evaluateClearanceStage(tenantId, enrollment.studentId);
        return updated;
    }

    async getStudentDues(tenantId: number, studentId: number) {
        return prisma.nodueStudentDue.findMany({
            where: { tenantId, studentId },
        });
    }

    async updateStudentDue(tenantId: number, dueId: number, data: { status?: NodueDueStatus, paidAmount?: number, remarks?: string }) {
        const due = await prisma.nodueStudentDue.findFirst({
            where: { id: dueId, tenantId },
        });
        if (!due) throw new Error('Due not found');

        const updated = await prisma.nodueStudentDue.update({
            where: { id: dueId },
            data: {
                ...data,
                hasDues: data.status === NodueDueStatus.COMPLETED ? false : due.hasDues,
            },
        });

        await this.evaluateClearanceStage(tenantId, due.studentId);
        return updated;
    }

    async getLibraryDues(tenantId: number, studentId?: number) {
        const where: any = { tenantId };
        if (studentId) where.studentId = studentId;

        return prisma.nodueLibraryDue.findMany({
            where,
            include: {
                student: { include: { studentProfile: { select: { rollNumber: true } } } }
            }
        });
    }

    async updateLibraryDue(tenantId: number, dueId: number, data: { status?: NodueDueStatus, paidAmount?: number, remarks?: string }) {
        const due = await prisma.nodueLibraryDue.findFirst({
            where: { id: dueId, tenantId },
        });
        if (!due) throw new Error('Library due not found');

        const updated = await prisma.nodueLibraryDue.update({
            where: { id: dueId },
            data: {
                ...data,
                hasDues: data.status === NodueDueStatus.COMPLETED ? false : due.hasDues,
            },
        });

        await this.evaluateClearanceStage(tenantId, due.studentId);
        return updated;
    }

    async hodApprove(tenantId: number, studentId: number, hodId: number) {
        const request = await this.getClearanceRequest(tenantId, studentId);
        if (request.currentStage !== NodueClearanceStage.HOD_REVIEW) {
            throw new Error('Request not at HOD_REVIEW stage');
        }

        const updated = await prisma.nodueClearanceRequest.update({
            where: { id: request.id },
            data: { currentStage: NodueClearanceStage.PRINCIPAL_REVIEW },
        });
        await this.logActivity(tenantId, hodId, 'HOD', 'HOD_APPROVED', 'HOD approved clearance', request.id);
        return updated;
    }

    async principalApprove(tenantId: number, studentId: number, principalId: number) {
        const request = await this.getClearanceRequest(tenantId, studentId);
        if (request.currentStage !== NodueClearanceStage.PRINCIPAL_REVIEW) {
            throw new Error('Request not at PRINCIPAL_REVIEW stage');
        }

        const updated = await prisma.nodueClearanceRequest.update({
            where: { id: request.id },
            data: { 
                currentStage: NodueClearanceStage.CLEARED,
                status: NodueDueStatus.COMPLETED,
                clearedAt: new Date(),
            },
        });
        await this.logActivity(tenantId, principalId, 'PRINCIPAL', 'PRINCIPAL_APPROVED', 'Principal approved clearance', request.id);
        return updated;
    }

    async getAttendanceCategories(tenantId: number) {
        return prisma.nodueAttendanceCategory.findMany({
            where: { tenantId },
            include: { department: true },
        });
    }

    async createAttendanceCategory(tenantId: number, data: any) {
        return prisma.nodueAttendanceCategory.create({
            data: {
                tenantId,
                ...data,
            },
        });
    }

    async calculateMassFines(tenantId: number, semesterId: number) {
        // Mock implementation for mass fines
        // Real implementation would calculate based on categories
        return { message: 'Mass fines calculated successfully' };
    }

    async getClearanceStats(tenantId: number) {
        const [total, cleared, pendingHod, pendingPrincipal] = await Promise.all([
            prisma.nodueClearanceRequest.count({ where: { tenantId } }),
            prisma.nodueClearanceRequest.count({ where: { tenantId, currentStage: NodueClearanceStage.CLEARED } }),
            prisma.nodueClearanceRequest.count({ where: { tenantId, currentStage: NodueClearanceStage.HOD_REVIEW } }),
            prisma.nodueClearanceRequest.count({ where: { tenantId, currentStage: NodueClearanceStage.PRINCIPAL_REVIEW } }),
        ]);
        const pending = total - cleared;

        return { total, cleared, pending, pendingHod, pendingPrincipal };
    }

    async evaluateClearanceStage(tenantId: number, studentId: number) {
        const request = await this.getClearanceRequest(tenantId, studentId);
        
        if (request.currentStage === NodueClearanceStage.CLEARED || request.currentStage === NodueClearanceStage.STUDENT_APPLICATION) {
            return request;
        }

        let stage = request.currentStage;

        if (stage === NodueClearanceStage.FACULTY_REVIEW) {
            const enrollments = await prisma.nodueSubjectEnrollment.findMany({ where: { tenantId, studentId } });
            const allCleared = enrollments.length > 0 && enrollments.every(e => e.isFacultyCleared || e.status === NodueDueStatus.COMPLETED);
            if (allCleared) stage = NodueClearanceStage.LIBRARY_REVIEW;
        }

        if (stage === NodueClearanceStage.LIBRARY_REVIEW) {
            const libraryDues = await prisma.nodueLibraryDue.findMany({ where: { tenantId, studentId, hasDues: true, status: NodueDueStatus.PENDING } });
            if (libraryDues.length === 0) stage = NodueClearanceStage.DEPARTMENT_REVIEW;
        }

        if (stage === NodueClearanceStage.DEPARTMENT_REVIEW) {
            const studentDues = await prisma.nodueStudentDue.findMany({ where: { tenantId, studentId, hasDues: true, status: NodueDueStatus.PENDING } });
            if (studentDues.length === 0) stage = NodueClearanceStage.HOD_REVIEW;
        }

        if (stage !== request.currentStage) {
            return prisma.nodueClearanceRequest.update({
                where: { id: request.id },
                data: { currentStage: stage },
            });
        }
        
        return request;
    }
}

export const nodueService = new NodueService();
