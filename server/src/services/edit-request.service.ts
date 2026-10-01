import { EditRequest, EditRequestStatus, EditRequestType, Prisma } from '@prisma/client';
import { editRequestRepository, auditLogRepository } from '../data-access/index.js';
import { prisma } from '../data-access/prisma.js';
import { emailService } from './email.service.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'edit-request' });

interface CreateEditRequestInput {
    type: 'ATTENDANCE' | 'MARKS';
    requesterId: number;
    subjectId: number;
    entityType: string;
    entityId: number;
    oldValue: object;
    newValue: object;
    reason?: string;
}

class EditRequestService {
    // Create an edit request (Teacher)
    async create(data: CreateEditRequestInput, actorId: number): Promise<EditRequest> {
        const request = await editRequestRepository.create({
            type: data.type as EditRequestType,
            requesterId: data.requesterId,
            subjectId: data.subjectId,
            entityType: data.entityType,
            entityId: data.entityId,
            oldValue: data.oldValue as Prisma.InputJsonValue,
            newValue: data.newValue as Prisma.InputJsonValue,
            reason: data.reason,
        });

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'CREATE_EDIT_REQUEST',
            entityType: 'EditRequest',
            entityId: request.id,
            newValue: { type: data.type, entityType: data.entityType, entityId: data.entityId } as Prisma.JsonValue,
        });

        // TODO: Notify admin via email (if configured)

        return request;
    }

    // Get all pending requests (Admin)
    async getPending(): Promise<EditRequest[]> {
        return editRequestRepository.findByStatus('PENDING');
    }

    // Get pending requests for a specific department (Dept Admin)
    async getPendingByDepartment(departmentId: number): Promise<EditRequest[]> {
        return editRequestRepository.findPendingByDepartment(departmentId);
    }

    // Get requests by requester (Teacher views their own)
    async getByRequester(requesterId: number): Promise<EditRequest[]> {
        return editRequestRepository.findByRequester(requesterId);
    }

    // Get all with pagination
    async getAll(options: {
        skip?: number;
        take?: number;
        status?: EditRequestStatus;
        type?: EditRequestType;
    } = {}): Promise<{ requests: EditRequest[]; total: number }> {
        return editRequestRepository.findAll(options);
    }

    // Approve edit request (Admin)
    async approve(id: number, reviewerId: number, reviewNote?: string): Promise<EditRequest> {
        const request = await editRequestRepository.findById(id);
        if (!request) {
            throw new Error('Edit request not found');
        }

        if (request.status !== 'PENDING') {
            throw new Error('Request has already been processed');
        }

        // Apply the changes based on type
        if (request.type === 'ATTENDANCE') {
            await this.applyAttendanceEdit(request);
        } else if (request.type === 'MARKS') {
            await this.applyMarksEdit(request);
        }

        const updated = await editRequestRepository.approve(id, reviewerId, reviewNote);

        // Audit log
        await auditLogRepository.create({
            actorId: reviewerId,
            action: 'APPROVE_EDIT_REQUEST',
            entityType: 'EditRequest',
            entityId: id,
            newValue: { reviewNote } as Prisma.JsonValue,
        });

        // Notify requester (blocking — ensures instant delivery)
        const requester = await prisma.user.findUnique({ where: { id: request.requesterId } });
        if (requester) {
            await emailService.sendEditDecisionNotification(
                requester.email,
                requester.name,
                request.type,
                true,
                reviewNote,
                { tenantId: requester.tenantId }
            ).catch(err => log.error({ err, requestId: id }, 'Edit approval email failed'));
        }

        return updated;
    }

    // Reject edit request (Admin)
    async reject(id: number, reviewerId: number, reviewNote?: string): Promise<EditRequest> {
        const request = await editRequestRepository.findById(id);
        if (!request) {
            throw new Error('Edit request not found');
        }

        if (request.status !== 'PENDING') {
            throw new Error('Request has already been processed');
        }

        const updated = await editRequestRepository.reject(id, reviewerId, reviewNote);

        // Audit log
        await auditLogRepository.create({
            actorId: reviewerId,
            action: 'REJECT_EDIT_REQUEST',
            entityType: 'EditRequest',
            entityId: id,
            newValue: { reviewNote } as Prisma.JsonValue,
        });

        // Notify requester (blocking — ensures instant delivery)
        const requester = await prisma.user.findUnique({ where: { id: request.requesterId } });
        if (requester) {
            await emailService.sendEditDecisionNotification(
                requester.email,
                requester.name,
                request.type,
                false,
                reviewNote,
                { tenantId: requester.tenantId }
            ).catch(err => log.error({ err, requestId: id }, 'Edit rejection email failed'));
        }

        return updated;
    }

    // Apply attendance edit
    private async applyAttendanceEdit(request: EditRequest): Promise<void> {
        const newValue = request.newValue as { status?: string };
        if (newValue.status) {
            await prisma.attendance.update({
                where: { id: request.entityId },
                data: { status: newValue.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' },
            });
        }
    }

    // Apply marks edit (recalculate total with IA config)
    private async applyMarksEdit(request: EditRequest): Promise<void> {
        const newValue = request.newValue as Record<string, unknown>;

        // Fetch the existing marks record
        const existingMarks = await prisma.internalMarksDetail.findUnique({
            where: { id: request.entityId },
            include: { course: { select: { semesterNumber: true } } },
        });

        if (!existingMarks) {
            throw new Error(`InternalMarksDetail record ${request.entityId} not found`);
        }

        // Merge new values with existing (new overrides, else keep existing)
        const finalInternal1 = (newValue.internal1 !== undefined ? newValue.internal1 : existingMarks.internal1) as number | null;
        const finalInternal2 = (newValue.internal2 !== undefined ? newValue.internal2 : existingMarks.internal2) as number | null;
        const finalInternal3 = (newValue.internal3 !== undefined ? newValue.internal3 : existingMarks.internal3) as number | null;
        const finalAssignment = (newValue.assignmentMarks !== undefined ? newValue.assignmentMarks : existingMarks.assignmentMarks) as number | null;

        // Re-calculate total using IA config
        let recalculatedTotal = existingMarks.calculatedTotal;
        const semesterNumber = existingMarks.course?.semesterNumber || 1;

        const { internalAssessmentService } = await import('./internal-assessment.service.js');
        const iaConfig = await internalAssessmentService.getConfig(existingMarks.courseId, semesterNumber);

        if (iaConfig) {
            recalculatedTotal = internalAssessmentService.calculateFinalInternal(
                finalInternal1,
                finalInternal2,
                finalInternal3,
                finalAssignment,
                iaConfig
            );
        }

        await prisma.internalMarksDetail.update({
            where: { id: request.entityId },
            data: {
                internal1: finalInternal1,
                internal2: finalInternal2,
                internal3: finalInternal3,
                assignmentMarks: finalAssignment,
                calculatedTotal: recalculatedTotal,
                isFinalized: true, // Keep marks visible to students
                editReason: request.reason || 'Admin approved edit',
            },
        });
    }

    // Get by ID
    async getById(id: number): Promise<EditRequest | null> {
        return editRequestRepository.findById(id);
    }

    // Count pending
    async countPending(): Promise<number> {
        return editRequestRepository.countPending();
    }

    // Count pending by department
    async countPendingByDepartment(departmentId: number): Promise<number> {
        return editRequestRepository.countPendingByDepartment(departmentId);
    }
}

export const editRequestService = new EditRequestService();
