/**
 * Admissions — Shared utilities and types
 * Extracted from the monolithic admissions.service.ts
 */
import prisma from '../../data-access/prisma.js';
import { Prisma } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { randomInt } from 'crypto';

export const log = logger.child({ module: 'admissions' });

// ─── Strict template headers for bulk upload ─────────────────────
export const TEMPLATE_HEADERS = [
    'Applicant Name',
    'Email',
    'Mobile Number',
    'Gender',
    'Date of Birth',
    'Blood Group',
    'Nationality',
    'Religion',
    'Category',
    'Sub Caste',
    'Mother Tongue',
    'Aadhaar Number',
    'Branch',
    'Admission Year',
    'Applying Through',
    'Hostel',
    'Specially Abled',
    'Lateral Entry',
    'Father Name',
    'Father Mobile',
    'Father Email',
    'Father Occupation',
    'Father Annual Income',
    'Mother Name',
    'Mother Mobile',
    'Mother Email',
    'Mother Occupation',
    'Mother Annual Income',
    'Permanent Address',
    'Permanent State',
    'Permanent Pin',
    'Local Address',
    'Local State',
    'Local Pin',
    'CET Roll No',
    'CET Rank',
    'COMEDK Roll No',
    'COMEDK Rank',
] as const;

export interface ParsedStudentRow {
    rowNumber: number;
    data: Record<string, string>;
    errors: string[];
    isValid: boolean;
}

export interface AddressInput {
    address?: string;
    state?: string;
    pin?: string;
    [key: string]: unknown; // Allow extra fields from form
}

export interface ParentDetailInput {
    name?: string;
    email?: string;
    mobile?: string;
    occupation?: string;
    annualIncome?: string | number;
    [key: string]: unknown;
}

export interface AcademicDetailInput {
    board?: string;
    schoolName?: string;
    collegeName?: string;
    registerNo?: string;
    medium?: string;
    marks?: string | number;
    maxMarks?: string | number;
    percentage?: string | number;
    yearOfPassing?: string | number;
    [key: string]: unknown;
}

export interface SubjectWiseMarksInput {
    physics?: string | number;
    mathematics?: string | number;
    chemistry?: string | number;
    biologyOrOther?: string | number;
    [key: string]: unknown;
}

export interface DocumentInput {
    type: string;
    url: string;
}

export interface CreateAdmissionInput {
    applicantName: string;
    applyingThrough?: string;
    gender?: string;
    bloodGroup?: string;
    dateOfBirth?: string;
    nationality?: string;
    religion?: string;
    category?: string;
    subCaste?: string;
    motherTongue?: string;
    speciallyAbled?: boolean;
    aadhaarNumber?: string;
    emailId?: string;
    mobileNumber?: string;
    hostel?: boolean;
    pickupPlace?: string;
    permanentAddress?: AddressInput;
    localAddress?: AddressInput;
    fatherDetails?: ParentDetailInput;
    motherDetails?: ParentDetailInput;
    branchSelection?: string;
    cetRollNo?: string;
    cetRank?: string;
    cetAllottedCategory?: string;
    comedkRollNo?: string;
    comedkRank?: string;
    sslcDetails?: AcademicDetailInput;
    pucDetails?: AcademicDetailInput;
    subjectWiseMarks?: SubjectWiseMarksInput;
    documents?: DocumentInput[];
    howDidYouKnow?: string;
    applicantDeclaration?: boolean;
    parentDeclaration?: boolean;
    admissionYear?: number;
    formData?: Record<string, unknown>;
    isLateralEntry?: boolean;
}

// ─── Helper: Branch name → short department code ──────────────────
export function branchToCode(branch: string): string {
    const map: Record<string, string> = {
        'CSE': 'CSE', 'ISE': 'ISE', 'ECE': 'ECE', 'CIVIL': 'CIVIL', 'MECH.': 'MECH',
        'CS & BS': 'CSBS', 'CSE (AI)': 'CSEAI', 'CSE (AI&ML)': 'CSEAIML',
        'CSE (DS)': 'CSEDS', 'Comp.Engg.': 'CE',
        'CSE (IOT & Cyber Security Including Block Chain Tech.)': 'CSEIOT',
    };
    return map[branch] || branch.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8);
}

// ─── Helper: Generate next admission ID (ADM0001, ADM0002, ...) ──
export function nextAdmissionSequence(...ids: Array<string | null | undefined>): number {
    return ids.reduce((next, id) => {
        const match = id?.match(/^ADM(\d+)$/i);
        return match ? Math.max(next, Number(match[1]) + 1) : next;
    }, 1);
}

export async function generateAdmissionId(_tenantId: number, _admissionYear?: number): Promise<string> {
    // Admission approval creates the admission ID on StudentProfile.rollNumber
    // before it is copied to AdmissionData.admissionId. Both fields have global
    // unique constraints (not tenant-scoped), so allocate from all tenants.
    // Filtering by tenant/year makes a new tenant's first approval collide with
    // ADM0001 already held by another tenant and surfaces as a generic P2002.
    const [lastAdmission, lastStudent] = await Promise.all([
        prisma.admissionData.findFirst({
            where: { admissionId: { startsWith: 'ADM' } },
            orderBy: { admissionId: 'desc' },
            select: { admissionId: true },
        }),
        prisma.studentProfile.findFirst({
            where: { rollNumber: { startsWith: 'ADM' } },
            orderBy: { rollNumber: 'desc' },
            select: { rollNumber: true },
        }),
    ]);

    let nextNum = nextAdmissionSequence(lastAdmission?.admissionId, lastStudent?.rollNumber);
    // Also account for gaps and historical IDs whose admission year differs.
    // This avoids colliding with records created by imports or older workflows.
    for (;;) {
        const candidate = `ADM${nextNum.toString().padStart(4, '0')}`;
        const [admissionCollision, studentCollision] = await Promise.all([
            prisma.admissionData.findFirst({
                where: { admissionId: candidate },
                select: { id: true },
            }),
            prisma.studentProfile.findFirst({
                where: { rollNumber: candidate },
                select: { id: true },
            }),
        ]);
        if (!admissionCollision && !studentCollision) return candidate;
        nextNum++;
    }
}

// ─── Helper: Generate temporary USN (regular) ────────────────────
export async function generateTemporaryUsn(departmentCode: string, tenantId: number): Promise<string> {
    const prefix = departmentCode.toUpperCase();
    const last = await prisma.studentProfile.findFirst({
        where: {
            temporaryUsn: { startsWith: prefix },
            user: { tenantId },
        },
        orderBy: { temporaryUsn: 'desc' },
        select: { temporaryUsn: true },
    });

    let nextNum = 1;
    if (last?.temporaryUsn) {
        const match = last.temporaryUsn.match(new RegExp(`^${prefix}(\\d+)$`));
        if (match) nextNum = parseInt(match[1]) + 1;
    }

    let candidate = `${prefix}${nextNum.toString().padStart(3, '0')}`;
    let safety = 0;
    while (safety < 100) {
        const exists = await prisma.studentProfile.findUnique({
            where: { temporaryUsn: candidate },
            select: { id: true },
        });
        if (!exists) break;
        nextNum++;
        candidate = `${prefix}${nextNum.toString().padStart(3, '0')}`;
        safety++;
    }
    return candidate;
}

// ─── Helper: Generate lateral entry temporary USN ─────────────────
export async function generateLateralTemporaryUsn(departmentCode: string, tenantId: number): Promise<string> {
    const prefix = `L${departmentCode.toUpperCase()}`;
    const last = await prisma.studentProfile.findFirst({
        where: {
            temporaryUsn: { startsWith: prefix },
            user: { tenantId },
        },
        orderBy: { temporaryUsn: 'desc' },
        select: { temporaryUsn: true },
    });

    let nextNum = 1;
    if (last?.temporaryUsn) {
        const match = last.temporaryUsn.match(new RegExp(`^${prefix}(\\d+)$`));
        if (match) nextNum = parseInt(match[1]) + 1;
    }

    let candidate = `${prefix}${nextNum.toString().padStart(3, '0')}`;
    let safety = 0;
    while (safety < 100) {
        const exists = await prisma.studentProfile.findUnique({
            where: { temporaryUsn: candidate },
            select: { id: true },
        });
        if (!exists) break;
        nextNum++;
        candidate = `${prefix}${nextNum.toString().padStart(3, '0')}`;
        safety++;
    }
    return candidate;
}

// ─── Helper: Resolve unique email ─────────────────────────────────
export async function resolveUniqueEmail(
    admissionEmail: string | undefined | null,
    temporaryUsn: string,
    studentUserId: number,
    tenantId: number,
): Promise<string> {
    const candidateEmail = admissionEmail?.trim()?.toLowerCase();

    if (candidateEmail) {
        const existing = await prisma.user.findFirst({
            where: {
                email: { equals: candidateEmail, mode: 'insensitive' },
                tenantId,
            },
        });
        if (!existing || existing.id === studentUserId) {
            return candidateEmail;
        }
    }

    const usnEmail = `${temporaryUsn.toLowerCase()}@noreply.internal`;
    const existingUsn = await prisma.user.findFirst({
        where: {
            email: { equals: usnEmail, mode: 'insensitive' },
            tenantId,
        },
    });
    if (!existingUsn || existingUsn.id === studentUserId) {
        return usnEmail;
    }

    return `${temporaryUsn.toLowerCase()}.${Date.now()}@noreply.internal`;
}

// ─── Helper: Generate student password from branch code + batch year ──
// Format: <DEPT_CODE><ADMISSION_YEAR>  (e.g. "CSE2023", "ISE2024")
// All students in the same branch & batch share the same general password.
// This eliminates the need for individual welcome emails to students.
export function generateStudentPassword(deptCode: string, admissionYear: number): string {
    const code = deptCode.replace(/[^A-Z0-9]/gi, '').toUpperCase() || 'GEN';
    const year = admissionYear || new Date().getFullYear();
    return `${code}${year}`;
}

export function generatePassword(length = 12): string {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I, O
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';   // Exclude i, l, o
    const numbers = '23456789';                    // Exclude 0, 1
    const allChars = uppercase + lowercase + numbers;

    const chars: string[] = [];
    // Ensure at least one of each type
    chars.push(uppercase[randomInt(uppercase.length)]);
    chars.push(lowercase[randomInt(lowercase.length)]);
    chars.push(numbers[randomInt(numbers.length)]);

    // Fill the rest with random characters
    for (let i = chars.length; i < length; i++) {
        chars.push(allChars[randomInt(allChars.length)]);
    }

    // Fisher-Yates shuffle
    for (let i = chars.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
}
