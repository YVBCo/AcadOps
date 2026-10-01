import prisma from '../data-access/prisma.js';
import { getDefaultFormFields } from './tenant.service.js';
import * as fs from 'fs';
import * as path from 'path';

interface FormField {
    id: string;
    label: string;
    type: string;
    required: boolean;
    section: string;
    order: number;
    options?: string[];
    placeholder?: string;
}

interface UpdateFormConfigData {
    collegeName?: string;
    collegeAddress?: string;
    primaryColor?: string;
    secondaryColor?: string;
    bgColor?: string;
    formTitle?: string;
    formFields?: FormField[];
    isPublished?: boolean;
}

class FormConfigService {
    /**
     * Get form config for a tenant (create default if not exists)
     */
    async getConfig(tenantId: number) {
        let config = await prisma.admissionFormConfig.findUnique({
            where: { tenantId },
        });

        if (!config) {
            // Auto-create default config
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { name: true, address: true },
            });
            config = await prisma.admissionFormConfig.create({
                data: {
                    tenantId,
                    collegeName: tenant?.name || 'Institution',
                    collegeAddress: tenant?.address || '',
                    formFields: getDefaultFormFields(),
                },
            });
        }

        return config;
    }

    /**
     * Get published form config by tenant slug (public endpoint)
     */
    async getPublicConfig(slug: string) {
        const tenant = await prisma.tenant.findUnique({
            where: { slug },
            select: {
                id: true,
                name: true,
                slug: true,
                type: true,
                isActive: true,
                logoUrl: true,
                address: true,
                admissionFormConfig: true,
            },
        });

        if (!tenant || !tenant.isActive) {
            throw new Error('Institution not found or inactive');
        }

        let config = tenant.admissionFormConfig;

        // Auto-create default config for existing tenants that don't have one
        if (!config) {
            config = await prisma.admissionFormConfig.create({
                data: {
                    tenantId: tenant.id,
                    collegeName: tenant.name,
                    collegeAddress: tenant.address || '',
                    formFields: getDefaultFormFields(),
                },
            });
        }

        if (!config.isPublished) {
            throw new Error('Application form is not currently available');
        }

        // Also fetch non-cycle departments for branch selection
        const departments = await prisma.department.findMany({
            where: { tenantId: tenant.id, isCycleDepartment: false },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        });

        return {
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            tenantType: tenant.type,
            collegeName: config.collegeName,
            collegeAddress: config.collegeAddress,
            logoUrl: config.logoData || config.logoUrl || tenant.logoUrl,
            primaryColor: config.primaryColor,
            secondaryColor: config.secondaryColor,
            bgColor: config.bgColor,
            formTitle: config.formTitle,
            formFields: config.formFields as unknown as FormField[],
            departments,
        };
    }

    /**
     * Update form config for a tenant
     */
    async updateConfig(tenantId: number, data: UpdateFormConfigData) {
        // Ensure config exists first
        await this.getConfig(tenantId);

        return prisma.admissionFormConfig.update({
            where: { tenantId },
            data: {
                collegeName: data.collegeName,
                collegeAddress: data.collegeAddress,
                primaryColor: data.primaryColor,
                secondaryColor: data.secondaryColor,
                bgColor: data.bgColor,
                formTitle: data.formTitle,
                formFields: data.formFields ? JSON.parse(JSON.stringify(data.formFields)) : undefined,
                isPublished: data.isPublished,
            },
        });
    }

    /**
     * Upload logo for form watermark — stores as base64 data URI in DB.
     * Also propagates to the Tenant record so it appears on the login page.
     */
    async uploadLogo(tenantId: number, file: Express.Multer.File) {
        const { bufferToLogoDataUri } = await import('../utils/image-utils.js');
        const buffer = file.buffer || (await import('fs')).readFileSync(file.path);
        const dataUri = await bufferToLogoDataUri(buffer);

        // Store in form config
        await prisma.admissionFormConfig.update({
            where: { tenantId },
            data: { logoData: dataUri, logoUrl: dataUri },
        });

        // Propagate to tenant for login page + favicon
        await prisma.tenant.update({
            where: { id: tenantId },
            data: { logoData: dataUri, logoUrl: dataUri },
        });

        return { logoUrl: dataUri };
    }

    /**
     * Get departments for public form (tenant-scoped)
     */
    async getPublicDepartments(slug: string) {
        const tenant = await prisma.tenant.findUnique({
            where: { slug },
            select: { id: true, isActive: true },
        });

        if (!tenant || !tenant.isActive) {
            throw new Error('Institution not found or inactive');
        }

        return prisma.department.findMany({
            where: { tenantId: tenant.id, isCycleDepartment: false },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        });
    }
}

export const formConfigService = new FormConfigService();
