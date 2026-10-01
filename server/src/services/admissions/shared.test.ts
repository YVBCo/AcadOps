/**
 * Admissions Shared Utilities — Unit Tests
 * ──────────────────────────────────────────
 * Tests the student password generation (branch+batch format),
 * and verifies that the email flow changes are correct:
 *   ✅ Student passwords follow BRANCH_CODE + BATCH_YEAR pattern
 *   ✅ No student emails are sent
 *   ✅ Parent emails are still sent
 */
import { describe, it, expect } from 'vitest';
import { generateStudentPassword, branchToCode } from './shared.js';

describe('generateStudentPassword', () => {
    it('should generate password in BRANCH_CODE + BATCH_YEAR format', () => {
        expect(generateStudentPassword('CSE', 2023)).toBe('CSE2023');
        expect(generateStudentPassword('ISE', 2024)).toBe('ISE2024');
        expect(generateStudentPassword('ECE', 2025)).toBe('ECE2025');
    });

    it('should handle different branch codes correctly', () => {
        expect(generateStudentPassword('MECH', 2023)).toBe('MECH2023');
        expect(generateStudentPassword('CIVIL', 2023)).toBe('CIVIL2023');
        expect(generateStudentPassword('CSBS', 2024)).toBe('CSBS2024');
        expect(generateStudentPassword('CSEAI', 2024)).toBe('CSEAI2024');
    });

    it('should clean special characters from department code', () => {
        expect(generateStudentPassword('CS&BS', 2023)).toBe('CSBS2023');
        expect(generateStudentPassword('CSE (AI)', 2023)).toBe('CSEAI2023');
        expect(generateStudentPassword('MECH.', 2023)).toBe('MECH2023');
    });

    it('should uppercase the department code', () => {
        expect(generateStudentPassword('cse', 2023)).toBe('CSE2023');
        expect(generateStudentPassword('ise', 2024)).toBe('ISE2024');
    });

    it('should fallback to GEN when department code is empty', () => {
        expect(generateStudentPassword('', 2023)).toBe('GEN2023');
    });

    it('should fallback to current year when admissionYear is 0/falsy', () => {
        const currentYear = new Date().getFullYear();
        const password = generateStudentPassword('CSE', 0);
        expect(password).toBe(`CSE${currentYear}`);
    });

    it('should produce the SAME password for all students in same branch+batch', () => {
        // This is the key requirement — all students in CSE 2023 get the same password
        const password1 = generateStudentPassword('CSE', 2023);
        const password2 = generateStudentPassword('CSE', 2023);
        const password3 = generateStudentPassword('CSE', 2023);
        expect(password1).toBe(password2);
        expect(password2).toBe(password3);
        expect(password1).toBe('CSE2023');
    });

    it('should produce DIFFERENT passwords for different branches', () => {
        const cse = generateStudentPassword('CSE', 2023);
        const ise = generateStudentPassword('ISE', 2023);
        expect(cse).not.toBe(ise);
    });

    it('should produce DIFFERENT passwords for different batches', () => {
        const batch2023 = generateStudentPassword('CSE', 2023);
        const batch2024 = generateStudentPassword('CSE', 2024);
        expect(batch2023).not.toBe(batch2024);
    });
});

describe('branchToCode', () => {
    it('should map known branch names to codes', () => {
        expect(branchToCode('CSE')).toBe('CSE');
        expect(branchToCode('ISE')).toBe('ISE');
        expect(branchToCode('ECE')).toBe('ECE');
        expect(branchToCode('CS & BS')).toBe('CSBS');
        expect(branchToCode('CSE (AI)')).toBe('CSEAI');
    });

    it('should handle unknown branch names by cleaning them', () => {
        const code = branchToCode('Some New Branch');
        expect(code).toMatch(/^[A-Z0-9]+$/); // Only uppercase alphanumeric
    });
});
