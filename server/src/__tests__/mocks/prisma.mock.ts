/**
 * Prisma Mock Factory
 * ──────────────────────────────────────
 * Creates a deeply-mocked Prisma client for unit testing.
 * Every model method (findUnique, create, update, delete, etc.)
 * is auto-mocked with vi.fn().
 *
 * Usage:
 *   import { prismaMock } from '../__tests__/mocks/prisma.mock';
 *   vi.mock('../../data-access/prisma.js', () => ({ prisma: prismaMock, default: prismaMock }));
 */
import { vi } from 'vitest';

// All Prisma model methods that need mocking
const modelMethods = [
    'findUnique',
    'findFirst',
    'findMany',
    'create',
    'createMany',
    'update',
    'updateMany',
    'upsert',
    'delete',
    'deleteMany',
    'count',
    'aggregate',
    'groupBy',
] as const;

function createModelMock() {
    const mock: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of modelMethods) {
        mock[method] = vi.fn();
    }
    return mock;
}

// All Prisma models in the schema
const models = [
    'user', 'tenant', 'department', 'batch', 'section', 'semester',
    'course', 'subject', 'program', 'studentProfile', 'teacherProfile',
    'parentProfile', 'attendance', 'internalMarksDetail', 'semesterEndMarks',
    'semesterMarkUpload', 'semesterMarkEntry', 'admissionData',
    'courseAllocation', 'sectionCourseAllocation', 'auditLog', 'editRequest',
    'chatConversation', 'chatMessage', 'mentorAssignment', 'mentorSession',
    'timetableEntry', 'systemError', 'parsingCorrection', 'formConfig',
    'usnRequest', 'programCourse',
    'placementCompany', 'placementJob', 'placementStudentProfile', 'placementDrive',
    'placementApplication', 'placementCv', 'placementDeclaration', 'placementOfferLetter', 'placementRound',
    'nodueClearanceRequest', 'nodueSubjectEnrollment', 'nodueLibraryDue', 'nodueStudentDue', 'nodueDue', 'nodueFineCategory',
    'cycleDepartmentAllocation',
] as const;

type PrismaMock = Record<string, Record<string, ReturnType<typeof vi.fn>>> & {
    $transaction: ReturnType<typeof vi.fn>;
    $connect: ReturnType<typeof vi.fn>;
    $disconnect: ReturnType<typeof vi.fn>;
    $queryRaw: ReturnType<typeof vi.fn>;
};

function createPrismaMock(): PrismaMock {
    const mock: Record<string, unknown> = {};
    for (const model of models) {
        mock[model] = createModelMock();
    }
    // Prisma utilities
    mock.$transaction = vi.fn().mockImplementation(async (fn: unknown) => {
        if (typeof fn === 'function') {
            return fn(mock); // Pass the mock as the transaction client
        }
        return fn; // Array of promises
    });
    mock.$connect = vi.fn();
    mock.$disconnect = vi.fn();
    mock.$queryRaw = vi.fn();
    return mock as PrismaMock;
}

export const prismaMock = createPrismaMock();

/**
 * Reset all mocks between tests.
 * Call in beforeEach() or afterEach().
 */
export function resetPrismaMock(): void {
    for (const model of models) {
        const modelObj = prismaMock[model];
        if (modelObj) {
            for (const method of modelMethods) {
                if (modelObj[method]) {
                    modelObj[method].mockReset();
                }
            }
        }
    }
    prismaMock.$transaction.mockReset();
    prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
        if (typeof fn === 'function') {
            return fn(prismaMock);
        }
        return fn;
    });
}
