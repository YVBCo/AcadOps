import { prisma } from '../data-access/prisma.js';
import { auditLogRepository } from '../data-access/audit-log.repository.js';
import { Prisma } from '@prisma/client';
import { cacheService } from './cache.service.js';
import { CacheTTL, CachePrefix } from './cache.service.js';

export const studentService = {
    /**
     * Get student's academic profile
     * @param tenantId - Defense-in-depth: ensures user belongs to the caller's tenant
     */
    async getProfile(userId: number, tenantId?: number) {
        const cacheKey = `${CachePrefix.STUDENT}profile:${userId}`;
        const cached = await cacheService.get<any>(cacheKey);
        if (cached) return cached;

        const user = await prisma.user.findUnique({
            where: { id: userId, ...(tenantId ? { tenantId } : {}) },
            include: {
                studentProfile: {
                    include: {
                        program: true,
                        batch: true,
                        section: true,
                        cycleDepartment: true,
                        optedDepartment: true,
                        admissionData: true,
                    },
                },
                department: true,
            },
        });

        if (!user || !user.studentProfile) {
            throw new Error('Student profile not found');
        }

        const profile = user.studentProfile;

        // Determine the effective department based on semester
        const effectiveDepartment = profile.currentSemester <= 2
            ? profile.cycleDepartment
            : profile.optedDepartment || user.department;

        const result = {
            id: user.id,
            name: user.name,
            email: user.email,
            usn: profile.rollNumber,
            department: effectiveDepartment ? {
                id: effectiveDepartment.id,
                name: effectiveDepartment.name,
                code: effectiveDepartment.code,
            } : null,
            batch: profile.batch ? {
                id: profile.batch.id,
                name: profile.batch.name,
                startYear: profile.batch.startYear,
            } : null,
            section: profile.section ? {
                id: profile.section.id,
                name: profile.section.name,
            } : null,
            program: profile.program ? {
                id: profile.program.id,
                name: profile.program.name,
                code: profile.program.code,
            } : null,
            currentSemester: profile.currentSemester,
            admissionYear: profile.admissionYear,
            // Personal details from admission data
            mobileNumber: profile.admissionData?.mobileNumber || null,
            dateOfBirth: profile.admissionData?.dateOfBirth || null,
            gender: profile.admissionData?.gender || null,
            bloodGroup: profile.admissionData?.bloodGroup || null,
            category: profile.admissionData?.category || null,
            permanentAddress: profile.admissionData?.permanentAddress || null,
            localAddress: profile.admissionData?.localAddress || null,
            fatherDetails: profile.admissionData?.fatherDetails || null,
            motherDetails: profile.admissionData?.motherDetails || null,
        };

        await cacheService.set(cacheKey, result, CacheTTL.MEDIUM);
        return result;
    },

    /**
     * Get student's enrolled courses with teacher information
     */
    async getCourses(userId: number) {
        const cacheKey = `${CachePrefix.STUDENT}courses:${userId}`;
        const cached = await cacheService.get<any>(cacheKey);
        if (cached) return cached;

        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
            include: {
                section: true,
            },
        });

        if (!profile) {
            throw new Error('Student profile not found');
        }

        // Get courses via enrollments (Subject model)
        const enrollments = await prisma.enrollment.findMany({
            where: { studentId: profile.id },
            include: {
                subject: {
                    include: {
                        course: true,
                        semester: true,
                        teachers: {
                            include: {
                                teacher: {
                                    include: {
                                        user: {
                                            select: { id: true, name: true, email: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        // Also get courses via CourseAllocation for the student's section
        const allocations = profile.sectionId ? await prisma.courseAllocation.findMany({
            where: {
                sectionId: profile.sectionId,
                semesterNumber: profile.currentSemester,
            },
            include: {
                course: {
                    include: {
                        department: true,
                    },
                },
                teacher: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
            },
        }) : [];

        // Combine and deduplicate courses
        const coursesFromEnrollments = enrollments.map(e => ({
            id: e.subject.course.id,
            code: e.subject.course.code,
            name: e.subject.course.name,
            credits: e.subject.course.credits,
            semesterNumber: e.subject.course.semesterNumber,
            teacher: e.subject.teachers.find(t => t.isPrimary)?.teacher?.user?.name
                || e.subject.teachers[0]?.teacher?.user?.name
                || 'TBA',
            section: e.subject.section,
            status: e.subject.semester?.status || 'ACTIVE',
        }));

        const coursesFromAllocations = allocations.map(a => ({
            id: a.course.id,
            code: a.course.code,
            name: a.course.name,
            credits: a.course.credits,
            semesterNumber: a.semesterNumber,
            teacher: a.teacher?.user?.name || 'TBA',
            section: profile.section?.name || null,
            status: 'ACTIVE' as const,
        }));

        // Merge and deduplicate by course ID
        const courseMap = new Map<number, typeof coursesFromEnrollments[0]>();
        [...coursesFromEnrollments, ...coursesFromAllocations].forEach(c => {
            if (!courseMap.has(c.id)) {
                courseMap.set(c.id, c);
            }
        });

        const courses = Array.from(courseMap.values());
        await cacheService.set(cacheKey, courses, CacheTTL.MEDIUM);
        return courses;
    },

    /**
     * Get student's section timetable
     */
    async getTimetable(userId: number) {
        const cacheKey = `${CachePrefix.STUDENT}timetable:${userId}`;
        const cached = await cacheService.get<any>(cacheKey);
        if (cached) return cached;

        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
            include: {
                section: true,
            },
        });

        if (!profile || !profile.sectionId) {
            return null;
        }

        // Get the latest active timetable for the student's section
        const timetable = await prisma.sectionTimetable.findFirst({
            where: {
                sectionId: profile.sectionId,
                semesterNumber: profile.currentSemester,
                isActive: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        const result = timetable ? {
            id: timetable.id,
            fileUrl: timetable.fileUrl,
            fileName: timetable.fileName,
            fileType: timetable.fileType,
            semesterNumber: timetable.semesterNumber,
            uploadedAt: timetable.createdAt,
        } : null;

        if (result) await cacheService.set(cacheKey, result, CacheTTL.LONG);
        return result;
    },

    /**
     * Get student's internal marks (only finalized marks visible)
     */
    async getInternalMarks(userId: number) {
        const cacheKey = `${CachePrefix.MARKS}internal:${userId}`;
        const cached = await cacheService.get<any>(cacheKey);
        if (cached) return cached;

        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });

        if (!profile) {
            throw new Error('Student profile not found');
        }

        // Get internal marks details for this student
        const marks = await prisma.internalMarksDetail.findMany({
            where: {
                studentUsn: profile.rollNumber,
                isFinalized: true, // Only show finalized marks
            },
            include: {
                course: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        credits: true,
                        semesterNumber: true,
                    },
                },
            },
            orderBy: [
                { course: { semesterNumber: 'desc' } },
                { course: { code: 'asc' } },
            ],
        });

        // Get IA configs for proper calculation display
        const courseIds = [...new Set(marks.map(m => m.courseId))];
        const configs = await prisma.internalAssessmentConfig.findMany({
            where: {
                courseId: { in: courseIds },
            },
        });
        const configMap = new Map(configs.map(c => [`${c.courseId}-${c.semesterNumber}`, c]));

        const marksResult = marks.map(m => {
            const config = configMap.get(`${m.courseId}-${m.course.semesterNumber}`);

            // Calculate best-of-two or best-of-N based on config
            const internals = [m.internal1, m.internal2, m.internal3].filter(i => i !== null) as number[];
            // Use internalsToConsider from config (default to 2 for best-of-two)
            const internalsToConsider = config?.internalsToConsider || 2;
            const sortedInternals = internals.sort((a, b) => b - a);
            const bestInternals = sortedInternals.slice(0, internalsToConsider);
            const bestInternalsAvg = bestInternals.length > 0
                ? bestInternals.reduce((a, b) => a + b, 0) / bestInternals.length
                : null;

            return {
                courseId: m.course.id,
                courseCode: m.course.code,
                courseName: m.course.name,
                credits: m.course.credits,
                semesterNumber: m.course.semesterNumber,
                internal1: m.internal1,
                internal2: m.internal2,
                internal3: m.internal3,
                assignmentMarks: m.assignmentMarks,
                bestOfN: bestInternals,
                internalsConsidered: internalsToConsider,
                calculatedTotal: m.calculatedTotal,
                maxMarks: 50,
                isFinalized: m.isFinalized,
            };
        });

        await cacheService.set(cacheKey, marksResult, CacheTTL.MEDIUM);
        return marksResult;
    },

    /**
     * Get student's attendance (date-wise and course-wise)
     */
    async getAttendance(userId: number, courseId?: number) {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });

        if (!profile) {
            throw new Error('Student profile not found');
        }

        const whereClause: Prisma.AttendanceWhereInput = {
            studentId: profile.id,
        };

        if (courseId) {
            whereClause.subject = { courseId };
        }

        const attendance = await prisma.attendance.findMany({
            where: whereClause,
            include: {
                subject: {
                    include: {
                        course: {
                            select: {
                                id: true,
                                code: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: { date: 'desc' },
        });

        // Calculate summary per course
        const courseAttendance = new Map<number, {
            courseId: number;
            courseCode: string;
            courseName: string;
            present: number;
            absent: number;
            late: number;
            excused: number;
            total: number;
        }>();

        attendance.forEach(a => {
            const cid = a.subject.course.id;
            if (!courseAttendance.has(cid)) {
                courseAttendance.set(cid, {
                    courseId: cid,
                    courseCode: a.subject.course.code,
                    courseName: a.subject.course.name,
                    present: 0,
                    absent: 0,
                    late: 0,
                    excused: 0,
                    total: 0,
                });
            }
            const stats = courseAttendance.get(cid)!;
            stats.total++;
            if (a.status === 'PRESENT') stats.present++;
            else if (a.status === 'ABSENT') stats.absent++;
            else if (a.status === 'LATE') stats.late++;
            else if (a.status === 'EXCUSED') stats.excused++;
        });

        const summary = Array.from(courseAttendance.values()).map(s => ({
            ...s,
            percentage: s.total > 0 ? Math.round(((s.present + s.late + s.excused) / s.total) * 100) : 0,
        }));

        const records = attendance.map(a => ({
            id: a.id,
            date: a.date,
            status: a.status,
            remarks: a.remarks,
            courseId: a.subject.course.id,
            courseCode: a.subject.course.code,
            courseName: a.subject.course.name,
        }));

        return {
            summary,
            records,
        };
    },

    /**
     * Get student's published results
     */
    async getResults(userId: number) {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });

        if (!profile) {
            throw new Error('Student profile not found');
        }

        // Get published results only
        const results = await prisma.result.findMany({
            where: {
                studentUsn: profile.rollNumber,
                isPublished: true,
            },
            include: {
                course: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        credits: true,
                        semesterNumber: true,
                    },
                },
                revaluations: {
                    where: { status: 'APPROVED' },
                    orderBy: { approvedAt: 'desc' },
                    take: 1,
                },
            },
            orderBy: [
                { course: { semesterNumber: 'desc' } },
                { course: { code: 'asc' } },
            ],
        });

        return results.map(r => {
            const hasRevaluation = r.revaluations.length > 0;
            const finalSemesterMarks = hasRevaluation ? r.revaluations[0].newMarks : r.semesterMarks;
            const finalTotal = r.internalMarks + finalSemesterMarks;

            return {
                id: r.id,
                courseId: r.course.id,
                courseCode: r.course.code,
                courseName: r.course.name,
                credits: r.course.credits,
                semesterNumber: r.course.semesterNumber,
                internalMarks: r.internalMarks,
                semesterMarks: finalSemesterMarks,
                originalSemesterMarks: hasRevaluation ? r.semesterMarks : null,
                totalMarks: finalTotal,
                maxInternalMarks: 50,
                maxSemesterMarks: 50,
                maxTotalMarks: 100,
                status: r.status,
                hasRevaluation,
                publishedAt: r.publishedAt,
            };
        });
    },

    /**
     * Get student's complete academic history (4-year view)
     */
    async getAcademicHistory(userId: number) {
        const cacheKey = `${CachePrefix.STUDENT}history:${userId}`;
        const cached = await cacheService.get<any>(cacheKey);
        if (cached) return cached;

        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
            include: {
                batch: true,
                program: true,
            },
        });

        if (!profile) {
            throw new Error('Student profile not found');
        }

        // Parallelize independent queries for performance
        const [results, internalMarks] = await Promise.all([
            // Get all results for this student (published)
            prisma.result.findMany({
                where: {
                    studentUsn: profile.rollNumber,
                    isPublished: true,
                },
                include: {
                    course: true,
                    revaluations: {
                        where: { status: 'APPROVED' },
                    },
                },
                orderBy: [
                    { course: { semesterNumber: 'asc' } },
                    { course: { code: 'asc' } },
                ],
            }),
            // Get all internal marks (finalized)
            prisma.internalMarksDetail.findMany({
                where: {
                    studentUsn: profile.rollNumber,
                    isFinalized: true,
                },
                include: {
                    course: true,
                },
            }),
        ]);

        // Group by semester
        const semesters: Record<number, {
            semesterNumber: number;
            courses: Array<{
                courseId: number;
                courseCode: string;
                courseName: string;
                credits: number;
                internalMarks: number | null;
                semesterMarks: number | null;
                totalMarks: number | null;
                status: string | null;
                hasRevaluation: boolean;
                attempts: number;
            }>;
        }> = {};

        // Initialize semesters 1-8
        for (let i = 1; i <= 8; i++) {
            semesters[i] = { semesterNumber: i, courses: [] };
        }

        // Add results to semesters
        results.forEach(r => {
            const sem = r.course.semesterNumber || 1;
            const hasReval = r.revaluations.length > 0;
            const finalSemMarks = hasReval ? r.revaluations[0].newMarks : r.semesterMarks;

            semesters[sem].courses.push({
                courseId: r.course.id,
                courseCode: r.course.code,
                courseName: r.course.name,
                credits: r.course.credits,
                internalMarks: r.internalMarks,
                semesterMarks: finalSemMarks,
                totalMarks: r.internalMarks + finalSemMarks,
                status: r.status,
                hasRevaluation: hasReval,
                attempts: 1, // TODO: Track multiple attempts
            });
        });

        // Add internal marks for courses without results yet
        internalMarks.forEach(im => {
            const sem = im.course.semesterNumber || 1;
            const existingCourse = semesters[sem].courses.find(c => c.courseId === im.courseId);
            if (!existingCourse) {
                semesters[sem].courses.push({
                    courseId: im.course.id,
                    courseCode: im.course.code,
                    courseName: im.course.name,
                    credits: im.course.credits,
                    internalMarks: im.calculatedTotal,
                    semesterMarks: null,
                    totalMarks: null,
                    status: 'PENDING',
                    hasRevaluation: false,
                    attempts: 1,
                });
            }
        });

        // Get revaluation history
        const allRevaluations = await prisma.revaluation.findMany({
            where: {
                result: {
                    studentUsn: profile.rollNumber,
                },
                status: 'APPROVED',
            },
            include: {
                result: {
                    include: {
                        course: true,
                    },
                },
            },
            orderBy: { approvedAt: 'desc' },
        });

        const revaluationHistory = allRevaluations.map(rev => ({
            courseCode: rev.result.course.code,
            courseName: rev.result.course.name,
            semesterNumber: rev.result.course.semesterNumber,
            oldMarks: rev.oldMarks,
            newMarks: rev.newMarks,
            approvedAt: rev.approvedAt,
        }));

        const historyResult = {
            student: {
                usn: profile.rollNumber,
                batchName: profile.batch?.name || null,
                programName: profile.program?.name || null,
                admissionYear: profile.admissionYear,
                currentSemester: profile.currentSemester,
            },
            semesters: Object.values(semesters).filter(s => s.courses.length > 0),
            revaluationHistory,
        };

        await cacheService.set(cacheKey, historyResult, CacheTTL.MEDIUM);
        return historyResult;
    },

    /**
     * Log student access event
     */
    async logAccess(userId: number, module: string, action: string = 'VIEW') {
        await auditLogRepository.create({
            actorId: userId,
            action: `STUDENT_${action}_${module.toUpperCase()}`,
            entityType: 'StudentAccess',
            entityId: userId,
            newValue: { module, timestamp: new Date().toISOString() } as Prisma.JsonValue,
        });
    },

    /**
     * Update student personal profile information
     */
    async updateProfile(userId: number, data: {
        name?: string;
        mobileNumber?: string;
        dateOfBirth?: string;
        gender?: string;
        bloodGroup?: string;
        category?: string;
        permanentAddress?: string;
        localAddress?: string;
        fatherDetails?: unknown;
        motherDetails?: unknown;
    }) {
        // Update user name if provided
        if (data.name) {
            await prisma.user.update({
                where: { id: userId },
                data: { name: data.name },
            });
        }

        // Find linked admission data through student profile
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
            include: { admissionData: true },
        });

        if (profile?.admissionData) {
            const updateData: Record<string, unknown> = {};
            if (data.name) updateData.applicantName = data.name;
            if (data.mobileNumber) updateData.mobileNumber = data.mobileNumber;
            if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);
            if (data.gender) updateData.gender = data.gender;
            if (data.bloodGroup) updateData.bloodGroup = data.bloodGroup;
            if (data.category) updateData.category = data.category;
            if (data.permanentAddress) updateData.permanentAddress = data.permanentAddress;
            if (data.localAddress) updateData.localAddress = data.localAddress;
            if (data.fatherDetails) updateData.fatherDetails = data.fatherDetails;
            if (data.motherDetails) updateData.motherDetails = data.motherDetails;

            if (Object.keys(updateData).length > 0) {
                await prisma.admissionData.update({
                    where: { id: profile.admissionData.id },
                    data: updateData,
                });
            }
        }

        // Invalidate profile cache after update
        await cacheService.delete(`${CachePrefix.STUDENT}profile:${userId}`);

        return { message: 'Profile updated successfully' };
    },

    async submitEditRequest(userId: number, proposedChanges: Record<string, unknown>, reason: string) {
        const profile = await prisma.studentProfile.findUnique({ where: { userId } });
        if (!profile) throw new Error('Student profile not found');

        // Check if there's already a pending request
        const existingPending = await prisma.studentEditRequest.findFirst({
            where: { studentProfileId: profile.id, status: 'PENDING' },
        });
        if (existingPending) {
            throw new Error('You already have a pending edit request. Please wait for it to be reviewed.');
        }

        const request = await prisma.studentEditRequest.create({
            data: {
                studentProfileId: profile.id,
                requestedBy: userId,
                proposedChanges: proposedChanges as any,
                reason,
            },
        });

        return { message: 'Edit request submitted successfully. Changes will be applied after admin approval.', request };
    },

    async getMyEditRequests(userId: number) {
        const profile = await prisma.studentProfile.findUnique({ where: { userId } });
        if (!profile) throw new Error('Student profile not found');

        const requests = await prisma.studentEditRequest.findMany({
            where: { studentProfileId: profile.id },
            include: {
                reviewer: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });

        return requests;
    },
};
