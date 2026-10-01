import prisma from '../data-access/prisma.js';
import { TenantType } from '@prisma/client';
import { authService } from './auth.service.js';
import { emailService } from './email.service.js';
import { logger } from '../utils/logger.js';
import cacheService from './cache.service.js';

const log = logger.child({ module: 'tenant-service' });

interface CreateTenantData {
    name: string;
    slug: string;
    type: TenantType;
    maxUsers?: number;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    adminName?: string;
    adminEmail?: string;
}

// Default departments to create per tenant type
const DEFAULT_DEPARTMENTS: Record<string, Array<{ name: string; code: string; isCycleDepartment?: boolean }>> = {
    ENGINEERING: [
        { name: 'Physics', code: 'PHY', isCycleDepartment: true },
        { name: 'Chemistry', code: 'CHEM', isCycleDepartment: true },
        { name: 'Mathematics', code: 'MATH', isCycleDepartment: true },
    ],
    MEDICAL: [
        { name: 'General Medicine', code: 'GM' },
        { name: 'Surgery', code: 'SUR' },
        { name: 'Paediatrics', code: 'PED' },
        { name: 'Orthopaedics', code: 'ORT' },
        { name: 'Anatomy', code: 'ANA' },
        { name: 'Pharmacology', code: 'PHA' },
    ],
    DEGREE: [
        { name: 'Bachelor of Commerce', code: 'BCOM' },
        { name: 'Bachelor of Arts', code: 'BA' },
        { name: 'Bachelor of Science', code: 'BSC' },
    ],
    MBA: [
        { name: 'Finance', code: 'FIN' },
        { name: 'Marketing', code: 'MKT' },
        { name: 'Human Resources', code: 'HR' },
        { name: 'Operations', code: 'OPS' },
    ],
    MCA: [
        { name: 'Master of Computer Applications', code: 'MCA' },
    ],
    LAW: [
        { name: 'Constitutional Law', code: 'CLAW' },
        { name: 'Criminal Law', code: 'CRLAW' },
        { name: 'Corporate Law', code: 'COLAW' },
    ],
    PHARMACY: [
        { name: 'Pharmaceutics', code: 'PHARM' },
        { name: 'Pharmacology', code: 'PHLGY' },
        { name: 'Pharmaceutical Chemistry', code: 'PHCHEM' },
    ],
    AYURVEDIC: [
        { name: 'Kayachikitsa', code: 'KAYA' },
        { name: 'Shalya Tantra', code: 'SHALYA' },
        { name: 'Shalakya Tantra', code: 'SHALAK' },
        { name: 'Prasuti & Stri Roga', code: 'PSR' },
        { name: 'Panchakarma', code: 'PANCH' },
        { name: 'Dravyaguna', code: 'DG' },
        { name: 'Roga Nidan', code: 'RN' },
        { name: 'Rachana Sharira', code: 'RS' },
        { name: 'Kriya Sharira', code: 'KS' },
    ],
    PARAMEDICAL: [
        { name: 'Nursing', code: 'NURS' },
        { name: 'Physiotherapy', code: 'PHYSIO' },
        { name: 'Medical Lab Technology', code: 'MLT' },
        { name: 'Radiology & Imaging', code: 'RAD' },
        { name: 'Optometry', code: 'OPT' },
        { name: 'Operation Theatre Technology', code: 'OTT' },
        { name: 'Anaesthesia Technology', code: 'ANTH' },
    ],
    OTHER: [],
};

// Default form fields for admission forms
function getDefaultFormFields() {
    return [
        // Section: Admission Details
        { id: 'applyingThrough', label: 'Applying Through', type: 'radio', options: ['CET', 'COMEDK', 'Management'], required: true, section: 'Admission Details', order: 1, width: 'full' },
        // Section: Personal Details
        { id: 'applicantName', label: 'Name of the Applicant', type: 'text', required: true, section: 'Personal Details', order: 2, placeholder: 'Full name as per records', width: 'full', validation: { minLength: 2, maxLength: 100 } },
        { id: 'gender', label: 'Gender', type: 'radio', options: ['Male', 'Female'], required: true, section: 'Personal Details', order: 3, width: 'half' },
        { id: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true, section: 'Personal Details', order: 4, width: 'half' },
        { id: 'bloodGroup', label: 'Blood Group', type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], required: false, section: 'Personal Details', order: 5, width: 'half' },
        { id: 'nationality', label: 'Nationality', type: 'text', required: true, section: 'Personal Details', order: 6, placeholder: 'e.g. Indian', width: 'half' },
        { id: 'religion', label: 'Religion', type: 'select', options: ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'], required: false, section: 'Personal Details', order: 7, width: 'half' },
        { id: 'category', label: 'Category', type: 'select', options: ['GM (General Merit)', 'OBC (2A)', 'OBC (2B)', 'OBC (3A)', 'OBC (3B)', 'SC', 'ST', 'Cat-1'], required: true, section: 'Personal Details', order: 8, width: 'half' },
        { id: 'motherTongue', label: 'Mother Tongue', type: 'text', required: false, section: 'Personal Details', order: 9, width: 'half' },
        { id: 'subCaste', label: 'Sub Caste', type: 'text', required: false, section: 'Personal Details', order: 10, width: 'half' },
        { id: 'speciallyAbled', label: 'Specially Abled', type: 'radio', options: ['Yes', 'No'], required: false, section: 'Personal Details', order: 11, width: 'half' },
        { id: 'aadhaarNumber', label: 'Aadhaar Number', type: 'text', required: true, section: 'Personal Details', order: 12, placeholder: '12-digit Aadhaar number', width: 'half', validation: { exactLength: 12, pattern: '^[0-9]{12}$', customError: 'Aadhaar must be exactly 12 digits' } },
        // Section: Contact Details
        { id: 'emailId', label: 'Email ID', type: 'email', required: true, section: 'Contact Details', order: 13, placeholder: 'your@email.com', width: 'half' },
        { id: 'mobileNumber', label: 'Mobile Number', type: 'phone', required: true, section: 'Contact Details', order: 14, placeholder: '10-digit mobile number', width: 'half', validation: { exactLength: 10 } },
        { id: 'hostel', label: 'Hostel Required', type: 'radio', options: ['Yes', 'No'], required: false, section: 'Contact Details', order: 15, width: 'half' },
        { id: 'pickupPlace', label: 'Pick-Up Place', type: 'text', required: false, section: 'Contact Details', order: 16, helpText: 'Nearest bus stop or pick-up location', width: 'half' },
        // Section: Address Details
        { id: 'permanentAddress', label: 'Permanent Address', type: 'textarea', required: true, section: 'Address Details', order: 17, width: 'full' },
        { id: 'permanentState', label: 'State', type: 'text', required: true, section: 'Address Details', order: 18, width: 'half' },
        { id: 'permanentPin', label: 'Pin Code', type: 'text', required: true, section: 'Address Details', order: 19, width: 'half', validation: { exactLength: 6, pattern: '^[0-9]{6}$' } },
        { id: 'localAddress', label: 'Local Address', type: 'textarea', required: false, section: 'Address Details', order: 20, width: 'full' },
        { id: 'localState', label: 'Local State', type: 'text', required: false, section: 'Address Details', order: 21, width: 'half' },
        { id: 'localPin', label: 'Local Pin Code', type: 'text', required: false, section: 'Address Details', order: 22, width: 'half', validation: { exactLength: 6, pattern: '^[0-9]{6}$' } },
        // Section: Parent Details
        { id: 'fatherName', label: "Father's Name", type: 'text', required: true, section: 'Parent / Guardian Details', order: 23, width: 'half' },
        { id: 'fatherMobile', label: "Father's Mobile", type: 'phone', required: true, section: 'Parent / Guardian Details', order: 24, width: 'half', validation: { exactLength: 10 } },
        { id: 'fatherEmail', label: "Father's Email", type: 'email', required: false, section: 'Parent / Guardian Details', order: 25, width: 'half' },
        { id: 'fatherOccupation', label: "Father's Occupation", type: 'text', required: false, section: 'Parent / Guardian Details', order: 26, width: 'half' },
        { id: 'fatherIncome', label: "Father's Annual Income", type: 'text', required: false, section: 'Parent / Guardian Details', order: 27, width: 'half' },
        { id: 'motherName', label: "Mother's Name", type: 'text', required: true, section: 'Parent / Guardian Details', order: 28, width: 'half' },
        { id: 'motherMobile', label: "Mother's Mobile", type: 'phone', required: true, section: 'Parent / Guardian Details', order: 29, width: 'half', validation: { exactLength: 10 } },
        { id: 'motherEmail', label: "Mother's Email", type: 'email', required: false, section: 'Parent / Guardian Details', order: 30, width: 'half' },
        { id: 'motherOccupation', label: "Mother's Occupation", type: 'text', required: false, section: 'Parent / Guardian Details', order: 31, width: 'half' },
        { id: 'motherIncome', label: "Mother's Annual Income", type: 'text', required: false, section: 'Parent / Guardian Details', order: 32, width: 'half' },
        // Section: Branch Selection
        { id: 'branchSelection', label: 'Select Branch', type: 'branch_select', required: true, section: 'Course & Quota', order: 33, width: 'full' },
        { id: 'cetRollNo', label: 'CET Roll No.', type: 'text', required: false, section: 'Course & Quota', order: 34, width: 'half' },
        { id: 'cetRank', label: 'CET Rank', type: 'text', required: false, section: 'Course & Quota', order: 35, width: 'half' },
        { id: 'comedkRollNo', label: 'COMEDK Roll No.', type: 'text', required: false, section: 'Course & Quota', order: 36, width: 'half' },
        { id: 'comedkRank', label: 'COMEDK Rank', type: 'text', required: false, section: 'Course & Quota', order: 37, width: 'half' },
        // Section: Education (SSLC)
        { id: 'sslcRegisterNo', label: 'SSLC Register No.', type: 'text', required: false, section: 'Education — SSLC / 10th', order: 38, width: 'half' },
        { id: 'sslcSchoolName', label: 'School Name', type: 'text', required: false, section: 'Education — SSLC / 10th', order: 39, width: 'half' },
        { id: 'sslcPercentage', label: 'Percentage', type: 'text', required: false, section: 'Education — SSLC / 10th', order: 40, width: 'half' },
        { id: 'sslcYearOfPassing', label: 'Year of Passing', type: 'text', required: false, section: 'Education — SSLC / 10th', order: 41, width: 'half' },
        // Section: Education (PUC)
        { id: 'pucRegisterNo', label: 'PUC Register No.', type: 'text', required: false, section: 'Education — PUC / 12th', order: 42, width: 'half' },
        { id: 'pucCollegeName', label: 'College Name', type: 'text', required: false, section: 'Education — PUC / 12th', order: 43, width: 'half' },
        { id: 'pucPercentage', label: 'Percentage', type: 'text', required: false, section: 'Education — PUC / 12th', order: 44, width: 'half' },
        { id: 'pucYearOfPassing', label: 'Year of Passing', type: 'text', required: false, section: 'Education — PUC / 12th', order: 45, width: 'half' },
    ];
}

export { getDefaultFormFields };

class TenantService {
    /**
     * Create a new tenant with auto-setup
     */
    async create(data: CreateTenantData) {
        // Check slug uniqueness
        const existing = await prisma.tenant.findUnique({ where: { slug: data.slug } });
        if (existing) throw new Error(`Tenant with slug "${data.slug}" already exists`);

        // ─── Transaction: create tenant + departments + form + admin atomically ────
        const result = await prisma.$transaction(async (tx) => {
            // Create tenant
            const tenant = await tx.tenant.create({
                data: {
                    name: data.name,
                    slug: data.slug,
                    type: data.type,
                    maxUsers: data.maxUsers || 500,
                    contactEmail: data.contactEmail,
                    contactPhone: data.contactPhone,
                    address: data.address,
                },
            });

            // Auto-create departments based on type
            const depts = DEFAULT_DEPARTMENTS[data.type] || [];
            if (depts.length > 0) {
                await tx.department.createMany({
                    data: depts.map(d => ({
                        tenantId: tenant.id,
                        name: d.name,
                        code: d.code,
                        isCycleDepartment: d.isCycleDepartment || false,
                    })),
                });
            }

            // Auto-create default admission form config
            await tx.admissionFormConfig.create({
                data: {
                    tenantId: tenant.id,
                    collegeName: data.name,
                    formFields: getDefaultFormFields(),
                },
            });

            // Create Super Admin user for this tenant
            const password = emailService.generatePassword(12);
            const passwordHash = await authService.hashPassword(password);
            const adminEmail = data.adminEmail || data.contactEmail || `admin@${data.slug}.edu`;
            const adminName = data.adminName || `${data.name} Admin`;

            const adminUser = await tx.user.create({
                data: {
                    tenantId: tenant.id,
                    email: adminEmail,
                    passwordHash,
                    name: adminName,
                    role: 'SUPER_ADMIN',
                },
            });

            return { tenant, adminUser, password, depts };
        });

        // Send welcome email (blocking — ensures instant delivery)
        await emailService.sendWelcomeEmail(
            result.adminUser.email,
            result.adminUser.name,
            'Super Admin',
            result.password,
            data.slug,
            { tenantId: result.tenant.id, userId: result.adminUser.id }
        ).then(sent => {
            if (sent) log.info({ email: result.adminUser.email }, 'Welcome email sent to tenant admin');
            else log.error({ email: result.adminUser.email }, 'Welcome email FAILED for tenant admin');
        }).catch(err => log.error({ err, email: result.adminUser.email }, 'Tenant admin welcome email error'));

        return {
            tenant: result.tenant,
            adminUser: { id: result.adminUser.id, email: result.adminUser.email, name: result.adminUser.name },
            adminPassword: result.password, // Return only on creation
            departmentsCreated: result.depts.length,
            formLink: `/apply/${data.slug}`,
        };
    }

    /**
     * List all tenants with stats
     */
    async list() {
        const tenants = await prisma.tenant.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        users: true,
                        departments: true,
                        batches: true,
                        systemErrors: true,
                    },
                },
            },
        });
        return tenants;
    }

    /**
     * Get tenant by ID with detailed stats
     */
    async getById(id: number) {
        const tenant = await prisma.tenant.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        users: true,
                        departments: true,
                        batches: true,
                        semesters: true,
                        courses: true,
                        systemErrors: true,
                    },
                },
                departments: {
                    select: { id: true, name: true, code: true },
                    orderBy: { name: 'asc' },
                },
            },
        });
        if (!tenant) throw new Error('Tenant not found');
        return tenant;
    }

    /**
     * Get tenant by slug
     */
    async getBySlug(slug: string) {
        const tenant = await prisma.tenant.findUnique({
            where: { slug },
            select: { id: true, name: true, slug: true, type: true, isActive: true, logoUrl: true, logoData: true, loginBgImage: true, loginBgData: true },
        });
        return tenant;
    }

    /**
     * Update tenant
     */
    async update(id: number, data: Partial<CreateTenantData>) {
        return prisma.tenant.update({
            where: { id },
            data: {
                name: data.name,
                type: data.type,
                maxUsers: data.maxUsers,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                address: data.address,
            },
        });
    }

    /**
     * Deactivate tenant (soft delete)
     */
    async deactivate(id: number) {
        return prisma.tenant.update({
            where: { id },
            data: { isActive: false },
        });
    }

    /**
     * Activate tenant
     */
    async activate(id: number) {
        return prisma.tenant.update({
            where: { id },
            data: { isActive: true },
        });
    }

    /**
     * Get stats for all tenants (for developer dashboard)
     */
    async getGlobalStats() {
        const [totalTenants, activeTenants, totalUsers, totalErrors, recentErrors] = await Promise.all([
            prisma.tenant.count(),
            prisma.tenant.count({ where: { isActive: true } }),
            prisma.user.count(),
            prisma.systemError.count(),
            prisma.systemError.count({
                where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
            }),
        ]);

        return {
            totalTenants,
            activeTenants,
            totalUsers,
            totalErrors,
            recentErrors24h: recentErrors,
        };
    }

    /**
     * List only active tenants (for login dropdown, public)
     */
    async listActive() {
        return prisma.tenant.findMany({
            where: { isActive: true },
            select: { id: true, name: true, slug: true, type: true, logoUrl: true, logoData: true },
            orderBy: { name: 'asc' },
        });
    }

    /**
     * Store login background as base64 data URI in the database.
     */
    async updateLoginBgData(tenantId: number, dataUri: string) {
        return prisma.tenant.update({
            where: { id: tenantId },
            data: { loginBgData: dataUri, loginBgImage: dataUri },
        });
    }

    /**
     * Remove login background data from the database.
     */
    async removeLoginBgData(tenantId: number) {
        await prisma.tenant.update({
            where: { id: tenantId },
            data: { loginBgData: null, loginBgImage: null },
        });
    }

    async getModules(tenantId: number) {
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { enabledModules: true }
        });
        return tenant?.enabledModules as Record<string, any> || {};
    }

    getDefaultModules() {
        return {};
    }

    async updateModules(tenantId: number, modules: Record<string, any>) {
        const autoDisabled: string[] = [];
        const warnings: string[] = [];
        
        const newModules = JSON.parse(JSON.stringify(modules));

        // Basic cascade down rules
        if (newModules.erp?.attendance?._enabled === false) {
            newModules.erp.attendance.parent_sms = false;
            newModules.erp.attendance.parent_view = false;
            autoDisabled.push('erp.attendance.parent_sms', 'erp.attendance.parent_view');
        }
        
        if (newModules.erp?.mentorship?._enabled === false) {
            newModules.erp.mentorship.observation_cards = false;
            newModules.erp.mentorship.interaction_logs = false;
            if (!newModules.erp.parent_portal) newModules.erp.parent_portal = {};
            newModules.erp.parent_portal.chat = false;
            autoDisabled.push('erp.mentorship.observation_cards', 'erp.mentorship.interaction_logs', 'erp.parent_portal.chat');
        }
        
        if (newModules.erp?.internal_assessment?._enabled === false) {
            newModules.erp.internal_assessment.mentor_review = false;
            newModules.erp.internal_assessment.submit_to_coe = false;
            autoDisabled.push('erp.internal_assessment.mentor_review', 'erp.internal_assessment.submit_to_coe');
        }

        if (newModules.nodue?._enabled === false) {
            for (const key of Object.keys(newModules.nodue)) {
                if (key !== '_enabled') {
                    newModules.nodue[key] = false;
                    autoDisabled.push(`nodue.${key}`);
                }
            }
        }

        if (newModules.placepro?._enabled === false) {
            for (const key of Object.keys(newModules.placepro)) {
                if (key !== '_enabled') {
                    newModules.placepro[key] = false;
                    autoDisabled.push(`placepro.${key}`);
                }
            }
        }

        const updated = await prisma.tenant.update({
            where: { id: tenantId },
            data: { enabledModules: newModules }
        });

        const cacheKey = `tenant:modules:${tenantId}`;
        await cacheService.set(cacheKey, null);

        return {
            modules: updated.enabledModules,
            autoDisabled,
            autoEnabled: [],
            warnings
        };
    }
}

export const tenantService = new TenantService();
