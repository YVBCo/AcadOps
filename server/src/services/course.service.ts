import { Course, Prisma } from '@prisma/client';
import { courseRepository, auditLogRepository, sectionRepository, CreateCourseData, UpdateCourseData } from '../data-access/index.js';
import { courseAllocationRepository } from '../data-access/course-allocation.repository.js';
import { prisma } from '../data-access/prisma.js';
import { logger as rootLogger } from '../utils/logger.js';

const logger = rootLogger.child({ service: 'CourseService' });

// Tenant types where internal marks default to 20 (not 50)
const REDUCED_INTERNAL_MARKS_TYPES = ['DEGREE', 'MBA', 'MCA', 'LAW'];

class CourseService {
    // Tenant type config for max semesters
    private readonly REDUCED_SEM_TYPES = ['DEGREE', 'MBA', 'MCA', 'LAW'];
    private readonly DEFAULT_MAX_SEM = 8;
    private readonly REDUCED_MAX_SEM = 6;

    // Get max semesters configuration for a tenant
    async getMaxSemestersConfig(tenantId: number): Promise<{ maxSemesters: number; tenantType: string | null }> {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { type: true },
        });
        const maxSemesters = tenant && this.REDUCED_SEM_TYPES.includes(tenant.type)
            ? this.REDUCED_MAX_SEM
            : this.DEFAULT_MAX_SEM;
        return { maxSemesters, tenantType: tenant?.type ?? null };
    }

    // Create course
    async create(data: CreateCourseData, actorId: number): Promise<Course> {
        // Check if code already exists
        const existing = await courseRepository.findByCode(data.code);
        if (existing) {
            throw new Error(`Course with code "${data.code}" already exists`);
        }

        // Auto-set internal marks based on tenant type if not explicitly provided
        if (data.internalMarks === undefined) {
            const tenant = await prisma.tenant.findUnique({
                where: { id: data.tenantId },
                select: { type: true },
            });
            if (tenant && REDUCED_INTERNAL_MARKS_TYPES.includes(tenant.type)) {
                data.internalMarks = 20;
                // External marks = 80 for degree (total = 100)
                if (data.externalMarks === undefined) {
                    data.externalMarks = 80;
                }
            }
        }

        const course = await courseRepository.create(data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'CREATE_COURSE',
            entityType: 'Course',
            entityId: course.id,
            newValue: { name: data.name, code: data.code, credits: data.credits, targetBatchId: data.targetBatchId } as Prisma.JsonValue,
        });

        return course;
    }

    // Update course
    async update(id: number, data: UpdateCourseData, actorId: number): Promise<Course> {
        const existing = await courseRepository.findById(id);
        if (!existing) {
            throw new Error('Course not found');
        }

        // If updating code, check for duplicates
        if (data.code && data.code !== existing.code) {
            const codeExists = await courseRepository.findByCode(data.code);
            if (codeExists) {
                throw new Error(`Course with code "${data.code}" already exists`);
            }
        }

        const course = await courseRepository.update(id, data);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'UPDATE_COURSE',
            entityType: 'Course',
            entityId: id,
            oldValue: { name: existing.name, code: existing.code, credits: existing.credits } as Prisma.JsonValue,
            newValue: data as unknown as Prisma.JsonValue,
        });

        return course;
    }

    // Delete course
    async delete(id: number, actorId: number): Promise<void> {
        const existing = await courseRepository.findById(id);
        if (!existing) {
            throw new Error('Course not found');
        }

        await courseRepository.delete(id);

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'DELETE_COURSE',
            entityType: 'Course',
            entityId: id,
            oldValue: { name: existing.name, code: existing.code } as Prisma.JsonValue,
        });
    }

    // Get course by ID
    async getById(id: number): Promise<Course | null> {
        return courseRepository.findById(id);
    }

    // Get courses by department
    async getByDepartment(departmentId: number): Promise<Course[]> {
        return courseRepository.findByDepartment(departmentId);
    }

    // Get all courses
    async getAll(options?: { departmentId?: number; programId?: number; tenantId?: number }): Promise<Course[]> {
        return courseRepository.findAll(options);
    }

    // Lock course (prevents further edits)
    // When a course has a targetBatchId, auto-assigns to all students in that batch
    async lock(id: number, actorId: number): Promise<Course> {
        const existing = await courseRepository.findById(id);
        if (!existing) {
            throw new Error('Course not found');
        }

        if (existing.isLocked) {
            throw new Error('Course is already locked');
        }

        const course = await courseRepository.lock(id);

        // Auto-assign to batch students if targetBatchId is set
        if (existing.targetBatchId && existing.semesterNumber) {
            try {
                await this.autoAssignToBatch(
                    existing.id,
                    existing.departmentId,
                    existing.targetBatchId,
                    existing.semesterNumber,
                    existing.tenantId,
                    actorId
                );
            } catch (err) {
                logger.error({ err, courseId: id }, 'Auto-assign failed for course — lock succeeded but assignment is best-effort');
                // Don't fail the lock — course is locked, auto-assign is best-effort
            }
        }

        // Audit log
        await auditLogRepository.create({
            actorId,
            action: 'LOCK_COURSE',
            entityType: 'Course',
            entityId: id,
            newValue: {
                isLocked: true,
                lockedAt: new Date().toISOString(),
                targetBatchId: existing.targetBatchId,
                autoAssigned: !!existing.targetBatchId,
            } as Prisma.JsonValue,
        });

        return course;
    }

    /**
     * Auto-assign a locked course to all sections in a batch:
     * 1. Create CourseAllocation for each section
     * 2. Create Subject instances (one per section) if active semester exists
     * 3. Enroll all students in those sections into their respective subjects
     */
    private async autoAssignToBatch(
        courseId: number,
        departmentId: number,
        batchId: number,
        semesterNumber: number,
        tenantId: number,
        actorId: number
    ): Promise<void> {
        // Get all sections for this batch in this department
        const sections = await sectionRepository.findByDepartmentAndBatch(departmentId, batchId);
        if (sections.length === 0) {
            logger.warn(`No sections found for batch ${batchId} in department ${departmentId}`);
            return;
        }

        // Find active semester for this tenant
        const activeSemester = await prisma.semester.findFirst({
            where: { tenantId, status: 'ACTIVE' },
        });

        let totalAllocations = 0;
        let totalSubjects = 0;
        let totalEnrollments = 0;

        for (const section of sections) {
            // 1. Create CourseAllocation
            await courseAllocationRepository.upsert({
                courseId,
                sectionId: section.id,
                semesterNumber,
                teacherId: null,
            });
            totalAllocations++;

            // 2. Create Subject if active semester exists
            if (activeSemester) {
                const existingSubject = await prisma.subject.findUnique({
                    where: {
                        courseId_semesterId_section: {
                            courseId,
                            semesterId: activeSemester.id,
                            section: section.name,
                        },
                    },
                });

                const subject = existingSubject || await prisma.subject.create({
                    data: {
                        courseId,
                        semesterId: activeSemester.id,
                        section: section.name,
                    },
                });

                if (!existingSubject) totalSubjects++;

                // 3. Enroll all students in this section
                const students = await prisma.studentProfile.findMany({
                    where: {
                        sectionId: section.id,
                        currentSemester: semesterNumber,
                    },
                    select: { id: true },
                });

                for (const student of students) {
                    try {
                        await prisma.enrollment.create({
                            data: {
                                subjectId: subject.id,
                                studentId: student.id,
                            },
                        });
                        totalEnrollments++;
                    } catch (err) {
                        // Skip duplicate enrollments (unique constraint)
                        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
                        throw err;
                    }
                }
            }
        }

        logger.info(
            `Auto-assigned course ${courseId} to batch ${batchId}: ` +
            `${totalAllocations} allocations, ${totalSubjects} subjects, ${totalEnrollments} enrollments`
        );

        // Audit log the auto-assignment
        await auditLogRepository.create({
            actorId,
            action: 'AUTO_ASSIGN_COURSE_TO_BATCH',
            entityType: 'Course',
            entityId: courseId,
            newValue: {
                batchId,
                departmentId,
                semesterNumber,
                totalAllocations,
                totalSubjects,
                totalEnrollments,
            } as Prisma.JsonValue,
        });
    }
}

export const courseService = new CourseService();

