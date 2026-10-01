/**
 * Test Fixture Factories
 * ──────────────────────────────────────
 * Generates realistic test data for all major entities.
 * Each factory returns a valid object with sensible defaults
 * that can be overridden via partial objects.
 */
import type { UserRole } from '@prisma/client';

// ─── User Factory ────────────────────────────────────────────
interface MockUser {
    id: number;
    email: string;
    passwordHash: string;
    name: string;
    role: UserRole;
    tenantId: number;
    departmentId: number | null;
    isActive: boolean;
    tokenVersion: number;
    lockedUntil: Date | null;
    failedLoginAttempts: number;
    createdAt: Date;
    updatedAt: Date;
}

let userIdCounter = 1;

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
    const id = overrides.id ?? userIdCounter++;
    return {
        id,
        email: `user${id}@test.edu`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$mock_hash',
        name: `Test User ${id}`,
        role: 'STUDENT' as UserRole,
        tenantId: 1,
        departmentId: 1,
        isActive: true,
        tokenVersion: 0,
        lockedUntil: null,
        failedLoginAttempts: 0,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        ...overrides,
    };
}

// ─── Tenant Factory ──────────────────────────────────────────
interface MockTenant {
    id: number;
    name: string;
    slug: string;
    type: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export function createMockTenant(overrides: Partial<MockTenant> = {}): MockTenant {
    return {
        id: 1,
        name: 'Test Engineering College',
        slug: 'test-college',
        type: 'ENGINEERING',
        isActive: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        ...overrides,
    };
}

// ─── Department Factory ──────────────────────────────────────
interface MockDepartment {
    id: number;
    name: string;
    code: string;
    description: string | null;
    tenantId: number;
    createdAt: Date;
    updatedAt: Date;
}

export function createMockDepartment(overrides: Partial<MockDepartment> = {}): MockDepartment {
    return {
        id: 1,
        name: 'Computer Science and Engineering',
        code: 'CSE',
        description: 'CSE Department',
        tenantId: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        ...overrides,
    };
}

// ─── Batch Factory ───────────────────────────────────────────
interface MockBatch {
    id: number;
    name: string;
    startYear: number;
    currentSemester: number;
    tenantId: number;
    createdAt: Date;
    updatedAt: Date;
}

export function createMockBatch(overrides: Partial<MockBatch> = {}): MockBatch {
    return {
        id: 1,
        name: '2026',
        startYear: 2026,
        currentSemester: 1,
        tenantId: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        ...overrides,
    };
}

// ─── Course Factory ──────────────────────────────────────────
interface MockCourse {
    id: number;
    name: string;
    code: string;
    credits: number;
    departmentId: number;
    tenantId: number;
    isLocked: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export function createMockCourse(overrides: Partial<MockCourse> = {}): MockCourse {
    return {
        id: 1,
        name: 'Data Structures',
        code: 'CS301',
        credits: 4,
        departmentId: 1,
        tenantId: 1,
        isLocked: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        ...overrides,
    };
}

// ─── Student Profile Factory ─────────────────────────────────
interface MockStudentProfile {
    id: number;
    userId: number;
    rollNumber: string;
    admissionYear: number;
    currentSemester: number;
    batchId: number;
    sectionId: number | null;
    optedDepartmentId: number | null;
    temporaryUsn: string | null;
    permanentUsn: string | null;
    admissionId: string | null;
    isLateralEntry: boolean;
}

export function createMockStudentProfile(overrides: Partial<MockStudentProfile> = {}): MockStudentProfile {
    return {
        id: 1,
        userId: 1,
        rollNumber: 'ADM0001',
        admissionYear: 2026,
        currentSemester: 1,
        batchId: 1,
        sectionId: null,
        optedDepartmentId: 1,
        temporaryUsn: null,
        permanentUsn: null,
        admissionId: 'ADM0001',
        isLateralEntry: false,
        ...overrides,
    };
}

// ─── Admission Data Factory ──────────────────────────────────
interface MockAdmissionData {
    id: number;
    admissionId: string;
    applicantName: string;
    emailId: string | null;
    mobileNumber: string | null;
    gender: string | null;
    branchSelection: string;
    admissionYear: number;
    status: string;
    enteredBy: number;
    approvedBy: number | null;
    studentProfileId: number | null;
    isLateralEntry: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export function createMockAdmission(overrides: Partial<MockAdmissionData> = {}): MockAdmissionData {
    return {
        id: 1,
        admissionId: 'APP-TEST-001',
        applicantName: 'Test Student',
        emailId: 'student@example.com',
        mobileNumber: '9876543210',
        gender: 'Male',
        branchSelection: 'CSE',
        admissionYear: 2026,
        status: 'DRAFT',
        enteredBy: 1,
        approvedBy: null,
        studentProfileId: null,
        isLateralEntry: false,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        ...overrides,
    };
}

// ─── JWT Payload Factory ─────────────────────────────────────
interface MockJwtPayload {
    userId: number;
    email: string;
    role: UserRole;
    tenantId: number;
    tenantType?: string;
    departmentId?: number;
    tokenVersion: number;
}

export function createMockJwtPayload(overrides: Partial<MockJwtPayload> = {}): MockJwtPayload {
    return {
        userId: 1,
        email: 'admin@test.edu',
        role: 'SUPER_ADMIN' as UserRole,
        tenantId: 1,
        tenantType: 'ENGINEERING',
        departmentId: 1,
        tokenVersion: 0,
        ...overrides,
    };
}
