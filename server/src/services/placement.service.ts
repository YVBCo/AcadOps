import prisma from '../data-access/prisma.js';
import { PlacementApplicationStatus, PlacementDriveStatus, Prisma } from '@prisma/client';

type PlacementCompanyInput = {
    name: string;
    email: string;
    phone?: string;
    website?: string;
    industry?: string;
    description?: string;
    logoUrl?: string;
    address?: string;
};

type PlacementJobInput = {
    title: string;
    description?: string;
    jobType?: Prisma.PlacementJobCreateInput['jobType'];
    location?: string;
    salary?: string;
    stipend?: string;
    minCgpa?: number;
    maxBacklogs?: number;
    eligibleDepts?: string[];
    eligibleBatches?: string[];
    skills?: string[];
    deadline?: Date;
    isActive?: boolean;
};

class PlacementService {
    async getCompanies(tenantId: number) {
        return prisma.placementCompany.findMany({
            where: { tenantId },
            orderBy: { name: 'asc' },
        });
    }

    async getCompany(tenantId: number, companyId: number) {
        return prisma.placementCompany.findFirst({
            where: { id: companyId, tenantId },
            include: { jobs: true },
        });
    }

    async getMyCompany(tenantId: number, userId: number) {
        return prisma.placementCompany.findFirst({ where: { tenantId, userId } });
    }

    async createCompany(tenantId: number, data: PlacementCompanyInput, userId?: number) {
        if (userId) {
            const existing = await this.getMyCompany(tenantId, userId);
            if (existing) throw new Error('Your company profile already exists');
        }
        return prisma.placementCompany.create({
            data: { ...data, tenantId, ...(userId ? { userId } : {}) },
        });
    }

    async updateCompany(tenantId: number, companyId: number, data: Partial<PlacementCompanyInput>, userId?: number) {
        const company = await prisma.placementCompany.findFirst({
            where: { id: companyId, tenantId, ...(userId ? { userId } : {}) },
            select: { id: true },
        });
        if (!company) throw new Error('Company not found');
        return prisma.placementCompany.update({ where: { id: company.id }, data });
    }

    async verifyCompany(tenantId: number, companyId: number) {
        const company = await prisma.placementCompany.findFirst({
            where: { id: companyId, tenantId },
            select: { id: true },
        });
        if (!company) throw new Error('Company not found');
        return prisma.placementCompany.update({ where: { id: company.id }, data: { isVerified: true } });
    }

    async getJobs(
        tenantId: number,
        filters?: { deptId?: string; batchId?: string; type?: string; isActive?: string },
        options: { companyUserId?: number; publicOnly?: boolean } = {},
    ) {
        const where: Prisma.PlacementJobWhereInput = {
            tenantId,
            ...(options.publicOnly ? { isApproved: true, isActive: true } : {}),
            ...(filters?.type ? { jobType: filters.type as Prisma.EnumPlacementJobTypeFilter } : {}),
            ...(!options.publicOnly && filters?.isActive !== undefined ? { isActive: filters.isActive === 'true' } : {}),
            ...(filters?.batchId ? { eligibleBatches: { has: filters.batchId } } : {}),
            ...(filters?.deptId ? { eligibleDepts: { has: filters.deptId } } : {}),
            ...(options.companyUserId ? { company: { userId: options.companyUserId, tenantId } } : {}),
        };
        return prisma.placementJob.findMany({
            where,
            include: { company: true },
            orderBy: { id: 'desc' },
        });
    }

    async getJob(
        tenantId: number,
        jobId: number,
        options: { companyUserId?: number; publicOnly?: boolean } = {},
    ) {
        return prisma.placementJob.findFirst({
            where: {
                id: jobId,
                tenantId,
                ...(options.publicOnly ? { isApproved: true, isActive: true } : {}),
                ...(options.companyUserId ? { company: { userId: options.companyUserId, tenantId } } : {}),
            },
            include: { company: true, _count: { select: { applications: true } } },
        });
    }

    async createJob(tenantId: number, data: PlacementJobInput, options: { companyId?: number; companyUserId?: number }) {
        const company = options.companyUserId
            ? await this.getMyCompany(tenantId, options.companyUserId)
            : options.companyId
                ? await this.getCompany(tenantId, options.companyId)
                : null;
        if (!company) throw new Error(options.companyUserId ? 'Create your company profile before posting jobs' : 'Company not found');
        return prisma.placementJob.create({
            data: {
                ...data,
                tenantId,
                companyId: company.id,
                isApproved: false,
                eligibleDepts: data.eligibleDepts ?? [],
                eligibleBatches: data.eligibleBatches ?? [],
                skills: data.skills ?? [],
            },
            include: { company: true },
        });
    }

    async updateJob(tenantId: number, jobId: number, data: Partial<PlacementJobInput>, companyUserId?: number) {
        const job = await prisma.placementJob.findFirst({
            where: {
                id: jobId,
                tenantId,
                ...(companyUserId ? { company: { userId: companyUserId, tenantId } } : {}),
            },
            select: { id: true },
        });
        if (!job) throw new Error('Job not found');
        return prisma.placementJob.update({ where: { id: job.id }, data, include: { company: true } });
    }

    async approveJob(tenantId: number, jobId: number) {
        const job = await prisma.placementJob.findFirst({ where: { id: jobId, tenantId }, select: { id: true } });
        if (!job) throw new Error('Job not found');
        return prisma.placementJob.update({ where: { id: job.id }, data: { isApproved: true } });
    }

    async getEligibleStudents(tenantId: number, jobId: number) {
        const job = await this.getJob(tenantId, jobId);
        if (!job) throw new Error('Job not found');
        const where: Prisma.PlacementStudentProfileWhereInput = { tenantId };
        if (job.minCgpa) where.cgpa = { gte: job.minCgpa };
        if (job.maxBacklogs !== null) {
            where.activeBacklogs = { lte: job.maxBacklogs };
            where.backlogs = { lte: job.maxBacklogs };
        }
        if (job.eligibleDepts.length) where.user = { department: { code: { in: job.eligibleDepts } } };
        return prisma.placementStudentProfile.findMany({
            where,
            include: { user: { select: { name: true, email: true } } },
        });
    }

    async getDrives(tenantId: number, status?: PlacementDriveStatus, companyUserId?: number) {
        return prisma.placementDrive.findMany({
            where: { tenantId, ...(status ? { status } : {}), ...(companyUserId ? { company: { userId: companyUserId, tenantId } } : {}) },
            include: { company: true, job: true },
            orderBy: { id: 'asc' },
        });
    }

    async getDrive(tenantId: number, driveId: number) {
        return prisma.placementDrive.findFirst({
            where: { id: driveId, tenantId },
            include: { rounds: true, company: true, job: true },
        });
    }

    async createDrive(tenantId: number, createdBy: number, data: {
        companyId: number; jobId?: number; title: string; description?: string; driveDate?: Date; venue?: string; status?: PlacementDriveStatus;
    }) {
        const company = await this.getCompany(tenantId, data.companyId);
        if (!company) throw new Error('Company not found');
        if (data.jobId && !(await this.getJob(tenantId, data.jobId))) throw new Error('Job not found');
        return prisma.placementDrive.create({ data: { ...data, tenantId, createdBy } });
    }

    async updateDrive(tenantId: number, driveId: number, data: Partial<{
        companyId: number; jobId: number | null; title: string; description: string | null; driveDate: Date | null; venue: string | null; status: PlacementDriveStatus;
    }>) {
        const drive = await prisma.placementDrive.findFirst({ where: { id: driveId, tenantId }, select: { id: true } });
        if (!drive) throw new Error('Drive not found');
        if (data.companyId && !(await this.getCompany(tenantId, data.companyId))) throw new Error('Company not found');
        if (data.jobId && !(await this.getJob(tenantId, data.jobId))) throw new Error('Job not found');
        return prisma.placementDrive.update({ where: { id: drive.id }, data, include: { company: true, job: true } });
    }

    async addRound(tenantId: number, driveId: number, data: {
        roundNo: number; roundType: Prisma.PlacementRoundCreateInput['roundType']; name?: string; venue?: string; startTime?: Date; endTime?: Date; notes?: string;
    }) {
        const drive = await this.getDrive(tenantId, driveId);
        if (!drive) throw new Error('Drive not found');
        return prisma.placementRound.create({ data: { ...data, driveId } });
    }

    async updateRoundResults(tenantId: number, roundId: number, results: Array<{ applicationId: number; status: PlacementApplicationStatus; remarks?: string }>) {
        const round = await prisma.placementRound.findFirst({
            where: { id: roundId, drive: { tenantId } },
            select: { id: true },
        });
        if (!round) throw new Error('Round not found');
        const applicationIds = results.map(result => result.applicationId);
        const applications = await prisma.placementApplication.findMany({
            where: { id: { in: applicationIds }, tenantId },
            select: { id: true },
        });
        if (applications.length !== new Set(applicationIds).size) throw new Error('One or more applications were not found');
        return prisma.$transaction(results.map(result => prisma.placementApplication.update({
            where: { id: result.applicationId },
            data: { status: result.status, remarks: result.remarks },
        })));
    }

    async apply(tenantId: number, studentId: number, jobId: number, cvId?: number) {
        const job = await this.getJob(tenantId, jobId, { publicOnly: true });
        if (!job) throw new Error('This job is unavailable');
        if (cvId) {
            const cv = await prisma.placementCv.findFirst({ where: { id: cvId, profile: { tenantId, userId: studentId } }, select: { id: true } });
            if (!cv) throw new Error('CV not found');
        }
        return prisma.placementApplication.create({ data: { tenantId, studentId, jobId, cvId, status: 'APPLIED' } });
    }

    async getApplications(tenantId: number, options: { studentId?: number; companyUserId?: number } = {}) {
        return prisma.placementApplication.findMany({
            where: {
                tenantId,
                ...(options.studentId ? { studentId: options.studentId } : {}),
                ...(options.companyUserId ? { job: { company: { userId: options.companyUserId, tenantId } } } : {}),
            },
            include: { job: { include: { company: true } }, student: { include: { studentProfile: true } }, cv: true },
            orderBy: { id: 'desc' },
        });
    }

    async getApplication(tenantId: number, applicationId: number, options: { studentId?: number; companyUserId?: number } = {}) {
        return prisma.placementApplication.findFirst({
            where: {
                id: applicationId,
                tenantId,
                ...(options.studentId ? { studentId: options.studentId } : {}),
                ...(options.companyUserId ? { job: { company: { userId: options.companyUserId, tenantId } } } : {}),
            },
            include: { job: { include: { company: true } }, student: { include: { studentProfile: true } }, cv: true },
        });
    }

    async updateApplicationStatus(tenantId: number, applicationId: number, status: PlacementApplicationStatus, remarks?: string, companyUserId?: number) {
        const application = await prisma.placementApplication.findFirst({
            where: {
                id: applicationId,
                tenantId,
                ...(companyUserId ? { job: { company: { userId: companyUserId, tenantId } } } : {}),
            },
            select: { id: true, studentId: true },
        });
        if (!application) throw new Error('Application not found');
        const updated = await prisma.placementApplication.update({ where: { id: application.id }, data: { status, remarks } });
        if (status === PlacementApplicationStatus.SELECTED) {
            await prisma.placementStudentProfile.upsert({
                where: { tenantId_userId: { tenantId, userId: application.studentId } },
                update: { isPlaced: true },
                create: { tenantId, userId: application.studentId, cgpa: 0, isPlaced: true },
            });
        }
        return updated;
    }

    async withdrawApplication(tenantId: number, applicationId: number, studentId: number) {
        const application = await prisma.placementApplication.findFirst({ where: { id: applicationId, tenantId, studentId }, select: { id: true } });
        if (!application) throw new Error('Application not found or access denied');
        return prisma.placementApplication.update({ where: { id: application.id }, data: { status: 'WITHDRAWN' } });
    }

    async getProfile(tenantId: number, userId: number) {
        let profile = await prisma.placementStudentProfile.findFirst({
            where: { userId, tenantId },
            include: { cvs: { orderBy: { version: 'desc' } }, declaration: true },
        });
        if (!profile) {
            const user = await prisma.user.findFirst({ where: { id: userId, tenantId, role: 'STUDENT' }, select: { id: true } });
            if (!user) throw new Error('Student not found');
            profile = await prisma.placementStudentProfile.create({
                data: { userId, tenantId, cgpa: 0 },
                include: { cvs: { orderBy: { version: 'desc' } }, declaration: true },
            });
        }
        return profile;
    }

    async findProfile(tenantId: number, userId: number) {
        return prisma.placementStudentProfile.findFirst({ where: { userId, tenantId }, include: { cvs: { orderBy: { version: 'desc' } }, declaration: true } });
    }

    async updateProfile(tenantId: number, userId: number, data: Partial<{
        cgpa: number; tenthPct: number; twelfthPct: number; backlogs: number; activeBacklogs: number; skills: string[];
        linkedinUrl: string; githubUrl: string; portfolioUrl: string; isOptedOut: boolean;
    }>) {
        const profile = await prisma.placementStudentProfile.findFirst({ where: { userId, tenantId }, select: { id: true } });
        if (!profile) throw new Error('Placement profile not found');
        return prisma.placementStudentProfile.update({ where: { id: profile.id }, data });
    }

    async uploadCv(tenantId: number, userId: number, data: { fileName: string; fileUrl: string }) {
        const profile = await prisma.placementStudentProfile.findFirst({ where: { tenantId, userId }, select: { id: true } });
        if (!profile) throw new Error('Placement profile not found');
        const latest = await prisma.placementCv.findFirst({ where: { profileId: profile.id }, orderBy: { version: 'desc' }, select: { version: true } });
        await prisma.placementCv.updateMany({ where: { profileId: profile.id }, data: { isDefault: false } });
        return prisma.placementCv.create({ data: { ...data, profileId: profile.id, version: (latest?.version ?? 0) + 1, isDefault: true } });
    }

    async submitDeclaration(tenantId: number, userId: number, data: { declarationType?: string; reason?: string; companyName?: string; ctc?: string }) {
        const profile = await prisma.placementStudentProfile.findFirst({ where: { tenantId, userId }, select: { id: true } });
        if (!profile) throw new Error('Placement profile not found');
        return prisma.placementDeclaration.upsert({
            where: { profileId: profile.id },
            create: { ...data, profileId: profile.id },
            update: data,
        });
    }

    async getPlacementStats(tenantId: number) {
        const [totalCompanies, activeDrives, placedStudents, offers] = await Promise.all([
            prisma.placementCompany.count({ where: { tenantId, isActive: true } }),
            prisma.placementDrive.count({ where: { tenantId, status: 'ACTIVE' } }),
            prisma.placementStudentProfile.count({ where: { tenantId, isPlaced: true } }),
            prisma.placementOfferLetter.findMany({ where: { application: { tenantId } }, select: { ctcOffered: true } }),
        ]);
        const ctcs = offers.map(offer => offer.ctcOffered === null ? Number.NaN : Number(offer.ctcOffered)).filter(Number.isFinite);
        const avgCtc = ctcs.length ? ctcs.reduce((sum, value) => sum + value, 0) / ctcs.length : 0;
        const highestCtc = ctcs.length ? Math.max(...ctcs) : 0;
        return { totalCompanies, activeDrives, placedStudents, totalOffers: offers.length, avgCtc, highestCtc };
    }

    async getDeptWiseStats(tenantId: number) {
        const [profiles, offers] = await Promise.all([
            prisma.placementStudentProfile.findMany({
                where: { tenantId, isOptedOut: false },
                select: { isPlaced: true, user: { select: { department: { select: { id: true, name: true, code: true } } } } },
            }),
            prisma.placementOfferLetter.findMany({
                where: { application: { tenantId } },
                select: { ctcOffered: true, application: { select: { student: { select: { departmentId: true } } } } },
            }),
        ]);
        const departments = new Map<number, { departmentId: number; departmentName: string; departmentCode: string; eligible: number; placed: number; department: string; avgCtc: number }>();
        for (const profile of profiles) {
            const department = profile.user.department;
            if (!department) continue;
            const current = departments.get(department.id) ?? {
                departmentId: department.id,
                departmentName: department.name,
                departmentCode: department.code,
                eligible: 0,
                placed: 0,
                department: department.name,
                avgCtc: 0,
            };
            current.eligible += 1;
            if (profile.isPlaced) current.placed += 1;
            departments.set(department.id, current);
        }
        const ctcByDepartment = new Map<number, number[]>();
        for (const offer of offers) {
            const departmentId = offer.application.student.departmentId;
            const ctc = offer.ctcOffered === null ? Number.NaN : Number(offer.ctcOffered);
            if (departmentId && Number.isFinite(ctc)) ctcByDepartment.set(departmentId, [...(ctcByDepartment.get(departmentId) ?? []), ctc]);
        }
        for (const [departmentId, values] of ctcByDepartment) {
            const department = departments.get(departmentId);
            if (department) department.avgCtc = values.reduce((sum, value) => sum + value, 0) / values.length;
        }
        return [...departments.values()].sort((a, b) => a.departmentName.localeCompare(b.departmentName));
    }
}

export const placementService = new PlacementService();
