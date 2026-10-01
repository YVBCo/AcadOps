/**
 * Auth Service Unit Tests
 * ──────────────────────────────────────
 * Tests authentication flows: register, login, token generation,
 * password hashing, account lockout, and token refresh.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing auth service
vi.mock('../data-access/prisma.js', async () => {
    const { prismaMock } = await import('../__tests__/mocks/prisma.mock.js');
    return { prisma: prismaMock, default: prismaMock };
});

vi.mock('../data-access/index.js', () => ({
    userRepository: {
        findByTenantEmail: vi.fn(),
        findByEmail: vi.fn(),
        findStudentByRollNumber: vi.fn(),
        create: vi.fn(),
    },
    auditLogRepository: {
        create: vi.fn(),
    },
}));

vi.mock('../utils/logger.js', () => ({
    logger: {
        child: () => ({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        }),
    },
}));

import { createMockUser, createMockTenant, createMockJwtPayload } from '../__tests__/factories.js';

describe('AuthService', () => {
    let authService: any;
    let userRepository: any;
    let auditLogRepository: any;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Dynamic import to get fresh mocked modules
        const dataAccess = await import('../data-access/index.js');
        userRepository = dataAccess.userRepository;
        auditLogRepository = dataAccess.auditLogRepository;

        const authMod = await import('../services/auth.service.js');
        authService = authMod.authService;
    });

    // ─── Password Hashing ────────────────────────────────────────

    describe('hashPassword / verifyPassword', () => {
        it('should hash a password and verify it correctly', async () => {
            const password = 'SecureP@ss123';
            const hash = await authService.hashPassword(password);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            expect(hash.startsWith('$argon2')).toBe(true);

            const isValid = await authService.verifyPassword(hash, password);
            expect(isValid).toBe(true);
        });

        it('should reject wrong password against valid hash', async () => {
            const hash = await authService.hashPassword('correct-password');
            const isValid = await authService.verifyPassword(hash, 'wrong-password');
            expect(isValid).toBe(false);
        });

        it('should generate different hashes for the same password (salted)', async () => {
            const password = 'SamePassword123';
            const hash1 = await authService.hashPassword(password);
            const hash2 = await authService.hashPassword(password);
            expect(hash1).not.toBe(hash2); // Argon2 uses random salt
        });
    });

    // ─── JWT Token Generation ────────────────────────────────────

    describe('generateToken / verifyToken', () => {
        it('should generate a valid JWT and decode it', () => {
            const payload = createMockJwtPayload();
            const token = authService.generateToken(payload);

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');

            const decoded = authService.verifyToken(token);
            expect(decoded.userId).toBe(payload.userId);
            expect(decoded.email).toBe(payload.email);
            expect(decoded.role).toBe(payload.role);
            expect(decoded.tenantId).toBe(payload.tenantId);
        });

        it('should throw on invalid token', () => {
            expect(() => authService.verifyToken('garbage.token.here')).toThrow();
        });

        it('should include tenantType and departmentId in token', () => {
            const payload = createMockJwtPayload({
                tenantType: 'ENGINEERING',
                departmentId: 5,
            });
            const token = authService.generateToken(payload);
            const decoded = authService.verifyToken(token);

            expect(decoded.tenantType).toBe('ENGINEERING');
            expect(decoded.departmentId).toBe(5);
        });
    });

    // ─── Token Pair (access + refresh) ────────────────────────────

    describe('generateTokenPair', () => {
        it('should generate both access and refresh tokens', () => {
            const payload = createMockJwtPayload();
            const pair = authService.generateTokenPair(payload);

            expect(pair.accessToken).toBeDefined();
            expect(pair.refreshToken).toBeDefined();
            expect(pair.accessToken).not.toBe(pair.refreshToken);
        });
    });

    // ─── Registration ────────────────────────────────────────────

    describe('register', () => {
        it('should reject registration without tenantId', async () => {
            await expect(authService.register({
                email: 'new@test.edu',
                password: 'Password123',
                name: 'New User',
            })).rejects.toThrow('Tenant ID is required');
        });

        it('should reject duplicate email within same tenant', async () => {
            const existingUser = createMockUser({ email: 'existing@test.edu' });
            userRepository.findByTenantEmail.mockResolvedValue(existingUser);

            await expect(authService.register({
                email: 'existing@test.edu',
                password: 'Password123',
                name: 'Duplicate User',
                tenantId: 1,
            })).rejects.toThrow('Email already registered');
        });

        it('should create user and return auth result on success', async () => {
            userRepository.findByTenantEmail.mockResolvedValue(null);
            const newUser = createMockUser({
                id: 10,
                email: 'new@test.edu',
                name: 'New User',
                role: 'STUDENT',
                tenantId: 1,
            });
            userRepository.create.mockResolvedValue(newUser);
            auditLogRepository.create.mockResolvedValue({});

            // Mock prisma.tenant.findUnique for tenant type
            const { prismaMock } = await import('../__tests__/mocks/prisma.mock.js');
            prismaMock.tenant.findUnique.mockResolvedValue(
                createMockTenant({ id: 1, type: 'ENGINEERING' })
            );

            const result = await authService.register({
                email: 'new@test.edu',
                password: 'Password123',
                name: 'New User',
                role: 'STUDENT',
                tenantId: 1,
            });

            expect(result.user.email).toBe('new@test.edu');
            expect(result.accessToken).toBeDefined();
            expect(result.refreshToken).toBeDefined();
            expect(result.token).toBe(result.accessToken);
            expect(result.user).not.toHaveProperty('passwordHash');
        });
    });

    // ─── Login ───────────────────────────────────────────────────

    describe('login', () => {
        it('should reject login with non-existent email', async () => {
            userRepository.findByEmail.mockResolvedValue(null);

            await expect(authService.login({
                identifier: 'nobody@test.edu',
                password: 'Password123',
            })).rejects.toThrow();
        });

        it('should reject login for deactivated user', async () => {
            const inactiveUser = createMockUser({ isActive: false });
            userRepository.findByEmail.mockResolvedValue(inactiveUser);

            await expect(authService.login({
                identifier: inactiveUser.email,
                password: 'Password123',
            })).rejects.toThrow(/deactivated|not yet activated/i);
        });

        it('should reject login for locked account', async () => {
            const lockedUser = createMockUser({
                lockedUntil: new Date(Date.now() + 600_000), // 10min from now
                failedLoginAttempts: 5,
            });
            userRepository.findByEmail.mockResolvedValue(lockedUser);

            await expect(authService.login({
                identifier: lockedUser.email,
                password: 'Password123',
            })).rejects.toThrow(/locked/i);
        });
    });
});
