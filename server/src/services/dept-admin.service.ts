import { User, UserRole, Prisma, AttendanceStatus } from '@prisma/client';
import { prisma, ExtendedTransactionClient } from '../data-access/prisma.js';
import { auditLogRepository, sectionRepository, courseRepository } from '../data-access/index.js';
import { courseAllocationRepository } from '../data-access/course-allocation.repository.js';
import { userService } from './user.service.js';
import { emailService } from './email.service.js';
import { syncNoDueSubjectEnrollments } from './nodue-enrollment.sync.js';

class DeptAdminService {
    /**
     * Get students for a department grouped by batch
     */
    async getStudentsByDepartment(
        departmentId: number,
        options: {
            batchId?: number;
            sectionId?: number;
            unassignedOnly?: boolean;
            skip?: number;
            take?: number;
        } = {}
    ) {
        // Students have department stored in StudentProfile (optedDepartmentId for sem 3+, 
        // cycleDepartmentId for sem 1-2), NOT in User.departmentId
        const studentProfileWhere: Prisma.StudentProfileWhereInput = {
            OR: [
                { optedDepartmentId: departmentId },
                {
                    cycleDepartmentId: departmentId,
                    currentSemester: { lte: 2 } // Only for sem 1-2
                },
            ],
        };

        if (options.batchId) {
            studentProfileWhere.batchId = options.batchId;
        }

        if (options.sectionId) {
            studentProfileWhere.sectionId = options.sectionId;
        }

        // Filter for students not assigned to any section
        if (options.unassignedOnly) {
            studentProfileWhere.sectionId = null;
        }

        const where: Prisma.UserWhereInput = {
            role: 'STUDENT',
            studentProfile: studentProfileWhere,
        };

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                include: {
                    studentProfile: {
                        include: {
                            program: true,
                            section: true,
                            batch: true,
                        },
                    },
                },
                skip: options.skip,
                take: options.take,
                orderBy: [
                    { studentProfile: { batch: { name: 'desc' } } },
                    { studentProfile: { rollNumber: 'asc' } },
                ],
            }),
            prisma.user.count({ where }),
        ]);

        return { users, total };
    }

    /**
     * Get courses for a department
     * Department admins can see all courses regardless of lock status
     */
    async getCourses(departmentId: number) {
        return prisma.course.findMany({
            where: {
                departmentId,
                // Note: Showing all courses, lock status displayed in UI
            },
            include: {
                department: true,
                program: true,
            },
            orderBy: [
                { semesterNumber: 'asc' },
                { name: 'asc' },
            ],
        });
    }

    /**
     * Get all courses for department (including unlocked for display)
     */
    async getAllDepartmentCourses(departmentId: number) {
        return prisma.course.findMany({
            where: { departmentId },
            include: {
                department: true,
                program: true,
            },
            orderBy: [
                { semesterNumber: 'asc' },
                { name: 'asc' },
            ],
        });
    }

    /**
     * Allocate course to section with optional teacher
     */
    async allocateCourseToSection(
        courseId: number,
        sectionId: number,
        semesterNumber: number,
        teacherId: number | null,
        actorId: number
    ) {
        // Verify course exists and is locked
        const course = await courseRepository.findById(courseId);
        if (!course) {
            throw new Error('Course not found');
        }
        if (!course.isLocked) {
            throw new Error('Cannot allocate unlocked course. Course must be approved by COE first.');
        }

        // Verify section exists
        const section = await sectionRepository.findById(sectionId);
        if (!section) {
            throw new Error('Section not found');
        }

        const allocation = await courseAllocationRepository.upsert({
            courseId,
            sectionId,
            semesterNumber,
            teacherId,
        });

        await auditLogRepository.create({
            actorId,
            action: 'ALLOCATE_COURSE_TO_SECTION',
            entityType: 'CourseAllocation',
            entityId: allocation.id,
            newValue: { courseId, sectionId, semesterNumber, teacherId } as Prisma.JsonValue,
        });

        return allocation;
    }

    /**
     * Allocate course to ALL sections of a batch (batch-level allocation)
     * All sections will have the same courses but can have different teachers assigned later
     */
    async allocateCourseToAllSections(
        courseId: number,
        batchId: number,
        semesterNumber: number,
        departmentId: number,
        actorId: number
    ) {
        // Verify course exists and is locked
        const course = await courseRepository.findById(courseId);
        if (!course) {
            throw new Error('Course not found');
        }
        if (!course.isLocked) {
            throw new Error('Cannot allocate unlocked course. Course must be approved by COE first.');
        }

        // Get all sections for this batch and department
        const sections = await sectionRepository.findByDepartmentAndBatch(departmentId, batchId);
        if (sections.length === 0) {
            throw new Error('No sections found for this batch');
        }

        // Create allocation for each section
        const allocations = [];
        for (const section of sections) {
            const allocation = await courseAllocationRepository.upsert({
                courseId,
                sectionId: section.id,
                semesterNumber,
                teacherId: null,  // Teacher assigned separately per section
            });
            allocations.push(allocation);
        }

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'ALLOCATE_COURSE_TO_BATCH',
            entityType: 'CourseAllocation',
            entityId: allocations[0]?.id || 0,
            newValue: {
                courseId,
                batchId,
                semesterNumber,
                sectionIds: sections.map(s => s.id)
            } as Prisma.JsonValue,
        });

        return {
            allocations,
            sectionCount: sections.length,
            courseName: course.name
        };
    }

    /**
     * Get course allocations for a batch (grouped by course)
     */
    async getCourseAllocationsByBatch(batchId: number, departmentId: number, semesterNumber: number) {
        const sections = await sectionRepository.findByDepartmentAndBatch(departmentId, batchId);
        if (sections.length === 0) {
            return { sections: [], allocations: [] };
        }

        // Get all allocations for these sections
        const allAllocations = [];
        for (const section of sections) {
            const sectionAllocations = await courseAllocationRepository.findBySectionAndSemester(
                section.id,
                semesterNumber
            );
            allAllocations.push(...sectionAllocations.map(a => ({ ...a, section })));
        }

        return { sections, allocations: allAllocations };
    }

    /**
     * Get course allocations for a section
     */
    async getCourseAllocations(sectionId: number, semesterNumber?: number) {
        if (semesterNumber) {
            return courseAllocationRepository.findBySectionAndSemester(sectionId, semesterNumber);
        }
        return courseAllocationRepository.findBySection(sectionId);
    }

    /**
     * Create teacher with email notification
     */
    async createTeacher(
        data: {
            email: string;
            name: string;
            departmentId: number;
            employeeId: string;
            designation?: string;
            tenantId: number;
        },
        actorId: number
    ) {
        // Use the existing createWithEmailNotification method
        const result = await userService.createWithEmailNotification(
            {
                email: data.email,
                name: data.name,
                role: 'TEACHER',
                departmentId: data.departmentId,
                tenantId: data.tenantId,
            },
            actorId
        );

        // Create teacher profile
        await prisma.teacherProfile.create({
            data: {
                userId: result.user.id,
                employeeId: data.employeeId,
                designation: data.designation,
            },
        });

        await auditLogRepository.create({
            actorId,
            action: 'CREATE_TEACHER',
            entityType: 'User',
            entityId: result.user.id,
            newValue: {
                email: data.email,
                name: data.name,
                departmentId: data.departmentId,
                employeeId: data.employeeId,
            } as Prisma.JsonValue,
        });

        return result;
    }

    /**
     * Get teachers for a department
     */
    async getTeachers(departmentId: number) {
        return prisma.user.findMany({
            where: {
                role: 'TEACHER',
                departmentId,
            },
            include: {
                teacherProfile: {
                    include: {
                        subjectAssignments: {
                            include: {
                                subject: {
                                    include: {
                                        course: true,
                                    },
                                },
                            },
                        },
                        courseAllocations: {
                            include: {
                                course: true,
                                section: true,
                            },
                        },
                    },
                },
            },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Assign teacher to course/section allocation
     */
    async assignTeacher(
        allocationId: number,
        teacherId: number,
        actorId: number,
        departmentId: number
    ) {
        const allocation = await courseAllocationRepository.findById(allocationId);
        if (!allocation) {
            throw new Error('Course allocation not found');
        }

        // Verify teacher belongs to the same department
        const teacher = await prisma.user.findFirst({
            where: {
                id: teacherId,
                role: 'TEACHER',
                departmentId,
            },
            include: { teacherProfile: true },
        });

        if (!teacher || !teacher.teacherProfile) {
            throw new Error('Teacher not found in this department');
        }

        const updated = await courseAllocationRepository.assignTeacher(
            allocationId,
            teacher.teacherProfile.id
        );

        const [course, section] = await Promise.all([
            prisma.course.findUnique({ where: { id: allocation.courseId }, select: { tenantId: true } }),
            prisma.section.findUnique({ where: { id: allocation.sectionId }, select: { name: true } }),
        ]);
        if (!course || !section) throw new Error('Course allocation references missing course or section');

        const subjects = await prisma.subject.findMany({
            where: {
                courseId: allocation.courseId,
                section: section.name,
                semester: { tenantId: course.tenantId, status: 'ACTIVE' },
            },
            include: { enrollments: { select: { studentId: true } } },
        });
        for (const subject of subjects) {
            await syncNoDueSubjectEnrollments(prisma, {
                tenantId: course.tenantId,
                subjectId: subject.id,
                studentProfileIds: subject.enrollments.map(enrollment => enrollment.studentId),
                teacherUserId: teacher.id,
            });
        }

        await auditLogRepository.create({
            actorId,
            action: 'ASSIGN_TEACHER_TO_COURSE',
            entityType: 'CourseAllocation',
            entityId: allocationId,
            oldValue: { teacherId: allocation.teacherId } as Prisma.JsonValue,
            newValue: { teacherId: teacher.teacherProfile.id } as Prisma.JsonValue,
        });

        return updated;
    }

    /**
     * Edit attendance with reason (Department Admin override)
     */
    async editAttendance(
        attendanceId: number,
        newStatus: AttendanceStatus,
        reason: string,
        actorId: number
    ) {
        if (!reason || reason.trim().length === 0) {
            throw new Error('Edit reason is required');
        }

        const existing = await prisma.attendance.findUnique({
            where: { id: attendanceId },
        });

        if (!existing) {
            throw new Error('Attendance record not found');
        }

        if (existing.isLocked) {
            throw new Error('Attendance is locked and cannot be edited');
        }

        const updated = await prisma.attendance.update({
            where: { id: attendanceId },
            data: {
                status: newStatus,
                editReason: reason,
            },
        });

        await auditLogRepository.create({
            actorId,
            action: 'EDIT_ATTENDANCE',
            entityType: 'Attendance',
            entityId: attendanceId,
            oldValue: { status: existing.status } as Prisma.JsonValue,
            newValue: { status: newStatus, reason } as Prisma.JsonValue,
        });

        return updated;
    }

    /**
     * Lock attendance for a date
     */
    async lockAttendanceByDate(
        subjectId: number,
        date: Date,
        actorId: number
    ) {
        const result = await prisma.attendance.updateMany({
            where: {
                subjectId,
                date,
                isLocked: false,
            },
            data: { isLocked: true },
        });

        await auditLogRepository.create({
            actorId,
            action: 'LOCK_ATTENDANCE',
            entityType: 'Attendance',
            entityId: subjectId,
            newValue: { subjectId, date: date.toISOString(), count: result.count } as Prisma.JsonValue,
        });

        return { locked: result.count };
    }

    /**
     * Get department-scoped audit logs
     */
    async getAuditLogs(
        departmentId: number,
        options: {
            skip?: number;
            take?: number;
            action?: string;
            startDate?: Date;
            endDate?: Date;
        } = {}
    ) {
        // Get users in this department to filter logs
        const departmentUsers = await prisma.user.findMany({
            where: { departmentId },
            select: { id: true },
        });
        const userIds = departmentUsers.map(u => u.id);

        const where: Prisma.AuditLogWhereInput = {
            actorId: { in: userIds },
            action: options.action,
            timestamp: {
                gte: options.startDate,
                lte: options.endDate,
            },
        };

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    actor: {
                        select: { id: true, name: true, email: true, role: true },
                    },
                },
                orderBy: { timestamp: 'desc' },
                skip: options.skip,
                take: options.take || 50,
            }),
            prisma.auditLog.count({ where }),
        ]);

        return { logs, total };
    }

    /**
     * Create section within a batch (batch-scoped)
     */
    async createSection(
        data: {
            name: string;
            departmentId: number;
            batchId: number;
            tenantId: number;
        },
        actorId: number
    ) {
        const section = await prisma.section.create({
            data: {
                name: data.name,
                departmentId: data.departmentId,
                batchId: data.batchId,
                tenantId: data.tenantId,
            },
            include: {
                department: true,
                batch: true,
            },
        });

        await auditLogRepository.create({
            actorId,
            action: 'CREATE_SECTION',
            entityType: 'Section',
            entityId: section.id,
            newValue: data as Prisma.JsonValue,
        });

        return section;
    }

    /**
     * Lock a section (no more student assignments allowed)
     */
    async lockSection(sectionId: number, actorId: number) {
        const section = await prisma.section.update({
            where: { id: sectionId },
            data: { isLocked: true },
        });

        await auditLogRepository.create({
            actorId,
            action: 'LOCK_SECTION',
            entityType: 'Section',
            entityId: sectionId,
            newValue: { isLocked: true } as Prisma.JsonValue,
        });

        return section;
    }

    /**
     * Get sections for a department and batch
     */
    async getSections(departmentId: number, batchId?: number) {
        return prisma.section.findMany({
            where: {
                departmentId,
                batchId: batchId || undefined,
            },
            include: {
                department: true,
                batch: true,
                courseAllocations: {
                    include: {
                        course: { select: { id: true, name: true, code: true } },
                    },
                },
                _count: {
                    select: { students: true },
                },
            },
            orderBy: [
                { batch: { name: 'desc' } },
                { name: 'asc' },
            ],
        });
    }

    /**
     * Assign students to section
     * Also auto-enrolls them into subjects of locked courses targeting this batch
     */
    async assignStudentsToSection(
        sectionId: number,
        studentProfileIds: number[],
        actorId: number
    ) {
        const section = await prisma.section.findUnique({
            where: { id: sectionId },
            include: { batch: true },
        });

        if (!section) {
            throw new Error('Section not found');
        }

        if (section.isLocked) {
            throw new Error('Section is locked. Cannot assign more students.');
        }

        // Wrap section assignment + auto-enrollment in a single transaction
        const result = await prisma.$transaction(async (tx) => {
            const updated = await tx.studentProfile.updateMany({
                where: { id: { in: studentProfileIds } },
                data: { sectionId },
            });

            // Auto-enroll into subjects of locked courses targeting this batch
            await this.autoEnrollStudentsInLockedCourses(
                tx,
                sectionId,
                section.name,
                section.batchId,
                section.departmentId,
                studentProfileIds
            );

            return updated;
        }, { timeout: 20000 });

        // Audit log (outside transaction — non-critical)
        await auditLogRepository.create({
            actorId,
            action: 'ASSIGN_STUDENTS_TO_SECTION',
            entityType: 'Section',
            entityId: sectionId,
            newValue: { studentProfileIds, count: result.count } as Prisma.JsonValue,
        });

        return { updated: result.count };
    }

    /**
     * Remove a student from section (set sectionId to null)
     */
    async removeStudentFromSection(
        sectionId: number,
        studentProfileId: number,
        actorId: number
    ) {
        const section = await prisma.section.findUnique({
            where: { id: sectionId },
        });

        if (!section) {
            throw new Error('Section not found');
        }

        if (section.isLocked) {
            throw new Error('Section is locked. Cannot remove students.');
        }

        // Verify student is in this section
        const studentProfile = await prisma.studentProfile.findFirst({
            where: {
                id: studentProfileId,
                sectionId: sectionId,
            },
        });

        if (!studentProfile) {
            throw new Error('Student not found in this section');
        }

        await prisma.studentProfile.update({
            where: { id: studentProfileId },
            data: { sectionId: null },
        });

        await auditLogRepository.create({
            actorId,
            action: 'REMOVE_STUDENT_FROM_SECTION',
            entityType: 'Section',
            entityId: sectionId,
            newValue: { studentProfileId } as Prisma.JsonValue,
        });

        return { removed: true };
    }

    /**
     * Auto-enroll students into subjects of locked courses that target a given batch.
     * Called when students are assigned to a section after courses are already locked.
     * Accepts a transaction client for atomicity with the parent operation.
     */
    private async autoEnrollStudentsInLockedCourses(
        tx: ExtendedTransactionClient,
        sectionId: number,
        sectionName: string,
        batchId: number,
        departmentId: number,
        studentProfileIds: number[]
    ): Promise<void> {
        // Find locked courses that target this batch
        const lockedCourses = await tx.course.findMany({
            where: {
                targetBatchId: batchId,
                departmentId,
                isLocked: true,
            },
        });

        if (lockedCourses.length === 0) return;

        // Find active semester
        const firstCourse = lockedCourses[0];
        const activeSemester = await tx.semester.findFirst({
            where: {
                tenantId: firstCourse.tenantId,
                status: 'ACTIVE',
            },
        });

        if (!activeSemester) return;

        for (const course of lockedCourses) {
            // Find the subject for this course + section + semester
            const subject = await tx.subject.findUnique({
                where: {
                    courseId_semesterId_section: {
                        courseId: course.id,
                        semesterId: activeSemester.id,
                        section: sectionName,
                    },
                },
            });

            if (!subject) continue;

            // Batch enroll all students at once (skip duplicates)
            await tx.enrollment.createMany({
                data: studentProfileIds.map(studentId => ({
                    subjectId: subject.id,
                    studentId,
                })),
                skipDuplicates: true,
            });

            const allocation = await tx.courseAllocation.findUnique({
                where: {
                    courseId_sectionId_semesterNumber: {
                        courseId: course.id,
                        sectionId,
                        semesterNumber: course.semesterNumber || 1,
                    },
                },
                select: { teacher: { select: { userId: true } } },
            });
            await syncNoDueSubjectEnrollments(tx as unknown as Parameters<typeof syncNoDueSubjectEnrollments>[0], {
                tenantId: course.tenantId,
                subjectId: subject.id,
                studentProfileIds,
                teacherUserId: allocation?.teacher?.userId,
            });
        }
    }

    // ── Semester Marks (read-only for dept admin) ─────────────────

    /**
     * Get semester marks for a department (paginated).
     */
    async getSemesterMarks(
        departmentId: number,
        filters: { batchId?: number; courseId?: number; skip?: number; take?: number } = {}
    ) {
        const where: Record<string, unknown> = { departmentId };
        if (filters.batchId) where.batchId = filters.batchId;
        if (filters.courseId) where.courseId = filters.courseId;

        const safeTake = Math.min(filters.take ?? 50, 200);
        const safeSkip = filters.skip ?? 0;

        const [semesterMarks, total] = await Promise.all([
            prisma.semesterEndMarks.findMany({
                where,
                select: {
                    id: true,
                    studentUsn: true,
                    marks: true,
                    status: true,
                    enteredAt: true,
                    approvedAt: true,
                },
                orderBy: { studentUsn: 'asc' },
                skip: safeSkip,
                take: safeTake,
            }),
            prisma.semesterEndMarks.count({ where }),
        ]);

        return { semesterMarks, total };
    }

    // ── Attendance Queries ────────────────────────────────────────

    /**
     * Get attendance records for a section/course/date (tenant-scoped).
     */
    async getAttendanceForSection(
        tenantId: number,
        sectionId: number,
        courseId: number,
        date?: string,
        skip = 0,
        take = 200
    ) {
        const semester = await prisma.semester.findFirst({
            where: { status: 'ACTIVE', ...(tenantId ? { tenantId } : {}) },
        });

        if (!semester) {
            return { attendance: [], dates: [], error: 'No active semester found' };
        }

        // Resolve section name so we find the correct Subject record
        // (each section has its own Subject for the same course/semester)
        const section = await prisma.section.findUnique({
            where: { id: sectionId },
            select: { name: true },
        });

        if (!section) {
            return { attendance: [], dates: [], error: 'Section not found' };
        }

        const subject = await prisma.subject.findFirst({
            where: { courseId, semesterId: semester.id, section: section.name },
        });

        if (!subject) {
            return { attendance: [], dates: [] };
        }

        const where: Record<string, unknown> = {
            subjectId: subject.id,
            student: { sectionId },
        };

        if (date) {
            where.date = new Date(date);
        }

        const safeTake = Math.min(take, 500);
        const safeSkip = Math.max(0, skip);

        const [attendance, allAttendance] = await Promise.all([
            prisma.attendance.findMany({
                where,
                include: {
                    student: {
                        include: {
                            user: { select: { name: true } },
                        },
                    },
                },
                orderBy: [
                    { date: 'desc' },
                    { student: { rollNumber: 'asc' } },
                ],
                skip: safeSkip,
                take: safeTake,
            }),
            prisma.attendance.findMany({
                where: {
                    subjectId: subject.id,
                    student: { sectionId },
                },
                select: { date: true },
                distinct: ['date'],
                orderBy: { date: 'desc' },
            }),
        ]);

        const dates = allAttendance.map(a => a.date.toISOString().split('T')[0]);

        return { attendance, dates };
    }

    // ── Edit Request Management ──────────────────────────────────

    /**
     * Get edit requests for a department (paginated, tenant-verified).
     */
    async getEditRequests(
        departmentId: number,
        status: string = 'PENDING',
        skip = 0,
        take = 50
    ) {
        const safeTake = Math.min(take, 200);
        const safeSkip = Math.max(0, skip);

        return prisma.editRequest.findMany({
            where: {
                status: status as Prisma.EnumEditRequestStatusFilter,
                requester: { departmentId },
            },
            include: {
                requester: { select: { name: true, email: true } },
                reviewer: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: safeSkip,
            take: safeTake,
        });
    }

    /**
     * Approve an edit request with tenant verification.
     * Verifies the requester belongs to the admin's department.
     */
    async approveEditRequest(
        requestId: number,
        reviewerId: number,
        departmentId: number,
        reviewNote?: string
    ) {
        const editRequest = await prisma.editRequest.findUnique({
            where: { id: requestId },
            include: { requester: { select: { departmentId: true } } },
        });

        if (!editRequest) throw new Error('Edit request not found');
        if (editRequest.status !== 'PENDING') throw new Error('Edit request is not pending');
        // Tenant/department isolation: verify the requester is from the admin's department
        if (editRequest.requester.departmentId !== departmentId) {
            throw new Error('Edit request does not belong to your department');
        }

        // Apply the edit based on entity type
        const newValue = editRequest.newValue as Record<string, unknown>;

        if (editRequest.entityType === 'InternalMarksDetail') {
            const existingMarks = await prisma.internalMarksDetail.findUnique({
                where: { id: editRequest.entityId },
                include: { course: { select: { semesterNumber: true } } },
            });

            if (!existingMarks) throw new Error('Internal marks record not found');

            const finalInternal1 = (newValue.internal1 !== undefined ? newValue.internal1 : existingMarks.internal1) as number | null;
            const finalInternal2 = (newValue.internal2 !== undefined ? newValue.internal2 : existingMarks.internal2) as number | null;
            const finalInternal3 = (newValue.internal3 !== undefined ? newValue.internal3 : existingMarks.internal3) as number | null;
            const finalAssignment = (newValue.assignmentMarks !== undefined ? newValue.assignmentMarks : existingMarks.assignmentMarks) as number | null;

            // Lazy-import to avoid circular dependency
            const { internalAssessmentService } = await import('./internal-assessment.service.js');
            let recalculatedTotal = existingMarks.calculatedTotal;
            const semesterNumber = existingMarks.course?.semesterNumber || 1;
            const iaConfig = await internalAssessmentService.getConfig(existingMarks.courseId, semesterNumber);

            if (iaConfig) {
                recalculatedTotal = internalAssessmentService.calculateFinalInternal(
                    finalInternal1, finalInternal2, finalInternal3, finalAssignment, iaConfig
                );
            }

            await prisma.internalMarksDetail.update({
                where: { id: editRequest.entityId },
                data: {
                    internal1: finalInternal1,
                    internal2: finalInternal2,
                    internal3: finalInternal3,
                    assignmentMarks: finalAssignment,
                    calculatedTotal: recalculatedTotal,
                    isFinalized: true,
                    editReason: editRequest.reason || 'Admin approved edit',
                    updatedBy: reviewerId,
                },
            });

            await auditLogRepository.create({
                actorId: reviewerId,
                action: 'RECALCULATE_FINALIZED_MARKS',
                entityType: 'InternalMarksDetail',
                entityId: editRequest.entityId,
                oldValue: {
                    internal1: existingMarks.internal1,
                    internal2: existingMarks.internal2,
                    internal3: existingMarks.internal3,
                    assignmentMarks: existingMarks.assignmentMarks,
                    calculatedTotal: existingMarks.calculatedTotal,
                } as Prisma.JsonValue,
                newValue: {
                    internal1: finalInternal1,
                    internal2: finalInternal2,
                    internal3: finalInternal3,
                    assignmentMarks: finalAssignment,
                    calculatedTotal: recalculatedTotal,
                } as Prisma.JsonValue,
            });
        } else if (editRequest.entityType === 'Attendance') {
            await prisma.attendance.update({
                where: { id: editRequest.entityId },
                data: {
                    status: newValue.status as AttendanceStatus,
                    editReason: editRequest.reason || 'Admin approved edit',
                },
            });
        }

        return prisma.editRequest.update({
            where: { id: requestId },
            data: {
                status: 'APPROVED',
                reviewerId,
                reviewNote,
                reviewedAt: new Date(),
            },
        });
    }

    /**
     * Reject an edit request with tenant verification.
     */
    async rejectEditRequest(
        requestId: number,
        reviewerId: number,
        departmentId: number,
        reviewNote: string
    ) {
        const editRequest = await prisma.editRequest.findUnique({
            where: { id: requestId },
            include: { requester: { select: { departmentId: true } } },
        });

        if (!editRequest) throw new Error('Edit request not found');
        if (editRequest.status !== 'PENDING') throw new Error('Edit request is not pending');
        if (editRequest.requester.departmentId !== departmentId) {
            throw new Error('Edit request does not belong to your department');
        }

        return prisma.editRequest.update({
            where: { id: requestId },
            data: {
                status: 'REJECTED',
                reviewerId,
                reviewNote,
                reviewedAt: new Date(),
            },
        });
    }

    // ── Mentor — Student Resolution ──────────────────────────────

    /**
     * Resolve student USNs to profile IDs (for mentor assignment).
     */
    async resolveStudentProfilesByUsn(usns: string[]) {
        return prisma.studentProfile.findMany({
            where: { rollNumber: { in: usns } },
            select: { id: true, batchId: true, sectionId: true },
        });
    }

    /**
     * Get a student profile by ID (for batch/section fallback).
     */
    async getStudentProfileById(profileId: number) {
        return prisma.studentProfile.findFirst({
            where: { id: profileId },
            select: { batchId: true, sectionId: true },
        });
    }
}

export const deptAdminService = new DeptAdminService();
