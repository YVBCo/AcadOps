import prisma from '../data-access/prisma.js';
import { PlacementDriveStatus, PlacementApplicationStatus, PlacementRoundType, PlacementJobType } from '@prisma/client';

class PlacementService {
    async getCompanies(tenantId: number, filters?: any) {
        return prisma.placementCompany.findMany({
            where: { },
            orderBy: { name: 'asc' },
        });
    }

    async getCompany(tenantId: number, companyId: number) {
        return prisma.placementCompany.findUnique({
            where: { id: companyId, },
            include: { jobs: true },
        });
    }

    async createCompany(tenantId: number, data: any) {
        return prisma.placementCompany.create({
            data: { ...data, },
        });
    }

    async updateCompany(tenantId: number, companyId: number, data: any) {
        return prisma.placementCompany.update({
            where: { id: companyId, },
            data,
        });
    }

    async verifyCompany(tenantId: number, companyId: number) {
        return prisma.placementCompany.update({
            where: { id: companyId, },
            data: { isVerified: true },
        });
    }

    async getJobs(tenantId: number, filters?: any) {
        const where: any = { };
        if (filters?.deptId) where.departmentIds = { has: filters.deptId };
        if (filters?.batchId) where.batchIds = { has: filters.batchId };
        if (filters?.type) where.type = filters.type;
        if (filters?.isActive !== undefined) where.isActive = filters.isActive;

        return prisma.placementJob.findMany({
            where,
            include: { company: true },
            orderBy: { id: 'desc' },
        });
    }

    async getJob(tenantId: number, jobId: number) {
        return prisma.placementJob.findUnique({
            where: { id: jobId, },
            include: { 
                company: true,
                _count: { select: { applications: true } }
            },
        });
    }

    async createJob(tenantId: number, companyId: number, data: any) {
        return prisma.placementJob.create({
            data: { ...data, companyId, },
        });
    }

    async updateJob(tenantId: number, jobId: number, data: any) {
        return prisma.placementJob.update({
            where: { id: jobId, },
            data,
        });
    }

    async approveJob(tenantId: number, jobId: number) {
        return prisma.placementJob.update({
            where: { id: jobId, },
            data: { isApproved: true },
        });
    }

    async getEligibleStudents(tenantId: number, jobId: number) {
        const job = await prisma.placementJob.findUnique({ where: { id: jobId, } });
        if (!job) throw new Error('Job not found');

        const where: any = { };
        if (job.minCgpa) where.cgpa = { gte: job.minCgpa };
        if (job.maxBacklogs !== null) where.activeBacklogs = { lte: job.maxBacklogs };
        if (job.maxBacklogs !== null) where.totalBacklogs = { lte: job.maxBacklogs };

        return prisma.placementStudentProfile.findMany({
            where,
            include: { user: { select: { name: true, email: true } } },
        });
    }

    async getDrives(tenantId: number, status?: PlacementDriveStatus) {
        return prisma.placementDrive.findMany({
            where: { tenantId, ...(status && { status }) },
            include: { company: true },
            orderBy: { id: 'asc' },
        });
    }

    async getDrive(tenantId: number, driveId: number) {
        return prisma.placementDrive.findUnique({
            where: { id: driveId, },
            include: { rounds: true, company: true },
        });
    }

    async createDrive(tenantId: number, data: any) {
        return prisma.placementDrive.create({
            data: { ...data, },
        });
    }

    async updateDrive(tenantId: number, driveId: number, data: any) {
        return prisma.placementDrive.update({
            where: { id: driveId, },
            data,
        });
    }

    async addRound(tenantId: number, driveId: number, data: any) {
        return prisma.placementRound.create({
            data: { ...data, driveId, },
        });
    }

    async updateRoundResults(tenantId: number, roundId: number, results: any[]) {
        const round = await prisma.placementRound.findUnique({ where: { id: roundId } });
        if (!round) throw new Error('Round not found');

        return prisma.$transaction(
            results.map(r => prisma.placementApplication.update({
                where: { id: r.applicationId, },
                data: { status: r.status, remarks: r.remarks },
            }))
        );
    }

    async apply(tenantId: number, studentId: number, jobId: number, cvId?: number) {
        return prisma.placementApplication.create({
            data: {
                tenantId,
                studentId,
                jobId,
                cvId,
                status: 'APPLIED',
            },
        });
    }

    async getApplications(tenantId: number, studentId?: number) {
        return prisma.placementApplication.findMany({
            where: { tenantId, ...(studentId && { studentId }) },
            include: { job: { include: { company: true } }, student: true },
            orderBy: { id: 'desc' },
        });
    }

    async getApplication(tenantId: number, applicationId: number) {
        return prisma.placementApplication.findUnique({
            where: { id: applicationId, },
            include: { job: { include: { company: true } }, student: true, cv: true },
        });
    }

    async updateApplicationStatus(tenantId: number, applicationId: number, status: PlacementApplicationStatus, remarks?: string) {
        return prisma.placementApplication.update({
            where: { id: applicationId, },
            data: { status, remarks },
        });
    }

    async withdrawApplication(tenantId: number, applicationId: number, studentId: number) {
        const app = await prisma.placementApplication.findUnique({ where: { id: applicationId, tenantId, studentId } });
        if (!app) throw new Error('Application not found or access denied');

        return prisma.placementApplication.update({
            where: { id: applicationId, },
            data: { status: 'WITHDRAWN' },
        });
    }

    async getProfile(tenantId: number, userId: number) {
        let profile = await prisma.placementStudentProfile.findUnique({
            where: { userId, },
            include: { cvs: true, declaration: true },
        });

        if (!profile) {
            profile = await prisma.placementStudentProfile.create({
                data: { userId, tenantId, cgpa: 0 },
                include: { cvs: true, declaration: true },
            });
        }
        return profile;
    }

    async updateProfile(tenantId: number, userId: number, data: any) {
        return prisma.placementStudentProfile.update({
            where: { userId, },
            data,
        });
    }

    async uploadCv(tenantId: number, profileId: number, data: any) {
        return prisma.placementCv.create({
            data: { ...data, profileId, },
        });
    }

    async submitDeclaration(tenantId: number, profileId: number, data: any) {
        return prisma.placementDeclaration.create({
            data: { ...data, profileId, },
        });
    }

    async getPlacementStats(tenantId: number) {
        const companyCount = await prisma.placementCompany.count({ where: { } });
        const placedCount = await prisma.placementOfferLetter.count({ where: { } });
        
        const offers = await prisma.placementOfferLetter.findMany({ where: { } });
        const avgCtc = offers.length > 0 ? offers.reduce((acc, curr) => acc + Number(curr.ctcOffered || 0), 0) / offers.length : 0;

        return { companyCount, placedCount, avgCtc };
    }

    async getDeptWiseStats(tenantId: number) {
        return [];
    }
}

export const placementService = new PlacementService();
