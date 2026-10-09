import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { User, UserRole, TenantType, Prisma } from '@prisma/client';
import { config } from '../config/index.js';
import { userRepository, auditLogRepository } from '../data-access/index.js';
import { prisma } from '../data-access/prisma.js';
import { ApiError } from '../api/middleware/error.middleware.js';

export interface RegisterData {
    email: string;
    password: string;
    name: string;
    role?: UserRole;
    departmentId?: number;
    tenantId?: number;
}

export interface LoginData {
    identifier: string; // Can be email or roll number
    password: string;
    tenantSlug?: string; // Tenant slug for scoped login
}

export interface JwtPayload {
    userId: number;
    email: string;
    role: UserRole;
    tenantId: number;
    tenantType?: string;
    departmentId?: number;
    tokenVersion: number;
}

export interface AuthResult {
    user: Omit<User, 'passwordHash'> & { tenantType?: string; tenantSlug?: string };
    accessToken: string;
    refreshToken: string;
    token: string; // backward compat (same as accessToken)
}

class AuthService {
    // Hash password using Argon2
    async hashPassword(password: string): Promise<string> {
        return argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4,
        });
    }

    // Verify password
    async verifyPassword(hash: string, password: string): Promise<boolean> {
        return argon2.verify(hash, password);
    }

    // Generate JWT token (legacy single-token path)
    generateToken(payload: JwtPayload): string {
        return jwt.sign(payload, config.jwt.secret, {
            expiresIn: config.jwt.accessExpiresIn as string,
        } as jwt.SignOptions);
    }

    // Verify JWT token
    verifyToken(token: string): JwtPayload {
        return jwt.verify(token, config.jwt.secret) as JwtPayload;
    }

    // Register new user
    async register(data: RegisterData, actorId?: number): Promise<AuthResult> {
        if (!data.tenantId) {
            throw new Error('Tenant ID is required for registration');
        }

        // Check if email already exists within this tenant
        const existingUser = await userRepository.findByTenantEmail(data.email, data.tenantId);
        if (existingUser) {
            throw new Error('Email already registered');
        }

        // Hash password
        const passwordHash = await this.hashPassword(data.password);

        // Create user
        const user = await userRepository.create({
            email: data.email,
            passwordHash,
            name: data.name,
            role: data.role || 'STUDENT',
            departmentId: data.departmentId,
            tenantId: data.tenantId,
        });

        // Audit log
        await auditLogRepository.create({
            actorId: actorId || user.id,
            action: 'USER_REGISTERED',
            entityType: 'User',
            entityId: user.id,
            newValue: { email: user.email, name: user.name, role: user.role },
        });

        // Fetch tenant type for JWT
        const tenant = await prisma.tenant.findUnique({
            where: { id: user.tenantId },
            select: { type: true },
        });

        // Generate token pair
        const jwtPayload: JwtPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            tenantType: tenant?.type,
            departmentId: user.departmentId ?? undefined,
            tokenVersion: user.tokenVersion ?? 0,
        };
        const { accessToken, refreshToken } = this.generateTokenPair(jwtPayload);

        // Return user without password hash
        const { passwordHash: _, ...userWithoutPassword } = user;
        return { user: { ...userWithoutPassword, tenantType: tenant?.type }, accessToken, refreshToken, token: accessToken };
    }

    // Login user - supports both email and roll number, scoped by tenant
    async login(data: LoginData, ipAddress?: string, userAgent?: string): Promise<AuthResult> {
        // Email clients and password managers can include surrounding whitespace
        // when credentials are copied from the welcome message. Normalize only
        // the identifier; passwords remain byte-for-byte unchanged.
        const identifier = data.identifier.trim();

        // Resolve tenant first if slug is provided (needed for tenant-scoped email lookup)
        let resolvedTenantId: number | undefined;
        if (data.tenantSlug) {
            const { tenantService } = await import('./tenant.service.js');
            const tenant = await tenantService.getBySlug(data.tenantSlug);
            if (!tenant) {
                throw new Error('Invalid credentials for this institution');
            }
            if (!tenant.isActive) {
                throw new Error('This institution is currently inactive');
            }
            resolvedTenantId = tenant.id;
        }

        // Find user by email, roll number, or phone
        let user;
        if (identifier.includes('@')) {
            // Login by email
            user = await userRepository.findByEmail(identifier, resolvedTenantId);
        } else {
            const cleanIdentifier = identifier.replace(/[\s\-\(\)]/g, '');
            // If identifier is purely numeric with 10+ digits, try parent phone FIRST
            // (avoids 3 unnecessary student roll queries for phone-based parent login)
            if (/^\d{10,}$/.test(cleanIdentifier)) {
                user = await userRepository.findParentByPhone(identifier, resolvedTenantId);
                // Fall back to student roll number if not a parent
                if (!user) {
                    user = await userRepository.findStudentByRollNumber(identifier.toUpperCase(), resolvedTenantId);
                }
            } else {
                // Non-phone identifier: try student roll number first
                user = await userRepository.findStudentByRollNumber(identifier.toUpperCase(), resolvedTenantId);
                // If not found and could be a phone, try parent phone lookup
                if (!user && /^\d{5,}$/.test(cleanIdentifier)) {
                    user = await userRepository.findParentByPhone(identifier, resolvedTenantId);
                }
            }
        }

        if (!user) {
            throw ApiError.fromCode('INVALID_CREDENTIALS');
        }

        // Verify user belongs to the specified tenant (for roll number logins)
        if (resolvedTenantId && user.tenantId !== resolvedTenantId) {
            throw ApiError.fromCode('INVALID_CREDENTIALS', { message: 'Invalid credentials for this institution' });
        }

        // Check if user is active
        if (!user.isActive) {
            // All deactivated accounts are blocked — admin must reactivate via dashboard
            await auditLogRepository.create({
                actorId: user.id,
                action: 'LOGIN_FAILED',
                entityType: 'User',
                entityId: user.id,
                ipAddress,
                userAgent,
                newValue: { reason: 'Account deactivated', role: user.role } as Prisma.JsonValue,
            });

            const isStudent = user.role === 'STUDENT';
            throw new Error(
                isStudent
                    ? 'Your account is not yet activated. Your department needs to finalize admissions first. Please contact your department admin.'
                    : 'Your account has been deactivated. Please contact your institution administrator to reactivate it.'
            );
        }

        // ─── Account Lockout Check ────────────────────────────────────
        // Lock account for 15 minutes after 5 consecutive failed attempts
        const MAX_FAILED_ATTEMPTS = 5;
        const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

        if (user.lockedUntil && user.lockedUntil > new Date()) {
            const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
            await auditLogRepository.create({
                actorId: user.id,
                action: 'LOGIN_FAILED',
                entityType: 'User',
                entityId: user.id,
                ipAddress,
                userAgent,
                newValue: { reason: 'Account locked' } as Prisma.JsonValue,
            });
            throw ApiError.fromCode('ACCOUNT_LOCKED', {
                message: `Account is temporarily locked. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`,
            });
        }

        // Auto-unlock if lockout has expired
        if (user.lockedUntil && user.lockedUntil <= new Date()) {
            await prisma.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: 0, lockedUntil: null },
            });
        }

        // Verify password
        const isValidPassword = await this.verifyPassword(user.passwordHash, data.password);
        if (!isValidPassword) {
            // Increment failed login attempts
            const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
            const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: newFailedAttempts,
                    lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
                },
            });

            // Audit failed login attempt
            await auditLogRepository.create({
                actorId: user.id,
                action: 'LOGIN_FAILED',
                entityType: 'User',
                entityId: user.id,
                ipAddress,
                userAgent,
                newValue: {
                    failedAttempts: newFailedAttempts,
                    locked: shouldLock,
                } as Prisma.JsonValue,
            });

            if (shouldLock) {
                throw ApiError.fromCode('ACCOUNT_LOCKED', { message: 'Too many failed attempts. Account locked for 15 minutes.' });
            }
            throw ApiError.fromCode('INVALID_CREDENTIALS', { message: 'Invalid email or password' });
        }

        // ─── Successful login — reset failed attempts ─────────────────
        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
            await prisma.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: 0, lockedUntil: null },
            });
        }

        // Audit successful login
        await auditLogRepository.create({
            actorId: user.id,
            action: 'LOGIN_SUCCESS',
            entityType: 'User',
            entityId: user.id,
            ipAddress,
            userAgent,
        });

        // Fetch tenant type and slug for JWT and response
        const loginTenant = await prisma.tenant.findUnique({
            where: { id: user.tenantId },
            select: { type: true, slug: true },
        });

        // Generate token pair (access + refresh)
        const jwtPayload: JwtPayload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            tenantType: loginTenant?.type,
            departmentId: user.departmentId ?? undefined,
            tokenVersion: user.tokenVersion ?? 0,
        };
        const { accessToken, refreshToken } = this.generateTokenPair(jwtPayload);

        // Return user without password hash
        const { passwordHash: _, ...userWithoutPassword } = user;
        return {
            user: { ...userWithoutPassword, tenantType: loginTenant?.type, tenantSlug: loginTenant?.slug },
            accessToken,
            refreshToken,
            // Keep 'token' for backward compatibility with existing frontend
            token: accessToken,
        };
    }

    // ─── Token Pair Generation (Access + Refresh) ─────────────────
    generateTokenPair(payload: JwtPayload): { accessToken: string; refreshToken: string } {
        // Short-lived access token (default: 15 minutes)
        const accessToken = jwt.sign(payload, config.jwt.secret, {
            expiresIn: config.jwt.accessExpiresIn as string,
        } as jwt.SignOptions);

        // Long-lived refresh token (default: 7 days) — signed with separate secret
        const refreshPayload = {
            userId: payload.userId,
            tokenVersion: payload.tokenVersion,
            type: 'refresh' as const,
        };
        const refreshToken = jwt.sign(refreshPayload, config.jwt.refreshSecret, {
            expiresIn: config.jwt.refreshExpiresIn as string,
        } as jwt.SignOptions);

        return { accessToken, refreshToken };
    }

    // ─── Refresh Access Token ─────────────────────────────────────
    async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
        try {
            const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;

            if (payload.type !== 'refresh') {
                throw new Error('Invalid token type');
            }

            // Verify token version hasn't been revoked
            const user = await prisma.user.findUnique({
                where: { id: payload.userId },
                select: {
                    id: true, email: true, role: true, tenantId: true,
                    departmentId: true, tokenVersion: true, isActive: true,
                    tenant: { select: { type: true } },
                },
            });

            if (!user || !user.isActive) {
                throw new Error('Account not found or inactive');
            }

            if (payload.tokenVersion !== user.tokenVersion) {
                throw new Error('Token revoked');
            }

            // Generate new token pair (rotation — old refresh token is now invalid by convention)
            const jwtPayload: JwtPayload = {
                userId: user.id,
                email: user.email,
                role: user.role,
                tenantId: user.tenantId,
                tenantType: user.tenant?.type,
                departmentId: user.departmentId ?? undefined,
                tokenVersion: user.tokenVersion,
            };

            return this.generateTokenPair(jwtPayload);
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new Error('Refresh token expired. Please login again.');
            }
            throw new Error('Invalid refresh token. Please login again.');
        }
    }

    // Get user from token
    async getUserFromToken(token: string): Promise<User | null> {
        try {
            const payload = this.verifyToken(token);
            return userRepository.findById(payload.userId);
        } catch {
            return null;
        }
    }

    // ─── Change Password ──────────────────────────────────────────
    async changePassword(
        userId: number,
        currentPassword: string,
        newPassword: string
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const user = await userRepository.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Verify current password
        const isValid = await this.verifyPassword(user.passwordHash, currentPassword);
        if (!isValid) {
            throw new Error('Current password is incorrect');
        }

        // Validate new password strength
        const { validatePassword } = await import('../utils/password-validator.js');
        const validation = validatePassword(newPassword, { email: user.email, name: user.name });
        if (!validation.isValid) {
            throw new Error(`Password too weak: ${validation.errors.join(', ')}`);
        }

        // Prevent reusing the same password
        const isSamePassword = await this.verifyPassword(user.passwordHash, newPassword);
        if (isSamePassword) {
            throw new Error('New password must be different from your current password');
        }

        // Hash new password and update — increment tokenVersion to revoke all existing tokens
        const newPasswordHash = await this.hashPassword(newPassword);
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash: newPasswordHash,
                tokenVersion: { increment: 1 },
                lastPasswordChangedAt: new Date(),
            },
            select: {
                id: true, email: true, role: true, tenantId: true,
                departmentId: true, tokenVersion: true,
                tenant: { select: { type: true } },
            },
        });

        // Audit log
        await auditLogRepository.create({
            actorId: userId,
            action: 'PASSWORD_CHANGED',
            entityType: 'User',
            entityId: userId,
        });

        // Return new token pair (old tokens are now revoked via incremented tokenVersion)
        return this.generateTokenPair({
            userId: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
            tenantId: updatedUser.tenantId,
            tenantType: updatedUser.tenant?.type,
            departmentId: updatedUser.departmentId ?? undefined,
            tokenVersion: updatedUser.tokenVersion,
        });
    }

    // ─── Request Password Reset OTP ─────────────────────────────
    async requestPasswordResetOtp(
        email: string,
        tenantSlug: string,
        ipAddress?: string
    ): Promise<void> {
        const { tenantService } = await import('./tenant.service.js');
        const tenant = await tenantService.getBySlug(tenantSlug);
        if (!tenant) return; // Silent fail to prevent enumeration

        const user = await userRepository.findByEmail(email, tenant.id);
        if (!user) return; // Silent fail to prevent enumeration

        // Rate limit: max 3 OTP requests per user every 2 days (48 hours)
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const recentOtps = await prisma.passwordResetOtp.count({
            where: {
                userId: user.id,
                createdAt: { gte: fortyEightHoursAgo },
            },
        });
        if (recentOtps >= 3) {
            throw new ApiError(429, 'You have reached the maximum limit of 3 OTP requests every 2 days. Please try again later.');
        }

        // Generate secure 6-digit OTP using node:crypto
        const { randomInt } = await import('crypto');
        const otp = randomInt(100000, 999999).toString();

        // Hash the OTP
        const crypto = await import('crypto');
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

        // Store hashed OTP with 10-minute expiry
        await prisma.passwordResetOtp.create({
            data: {
                userId: user.id,
                otpHash,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                ipAddress,
            },
        });

        // Send OTP email in real-time
        const { emailService } = await import('./email.service.js');
        const { logger } = await import('../utils/logger.js');
        const otpLog = logger.child({ module: 'password-reset-otp' });

        emailService.sendEmail({
            to: user.email,
            subject: '🔐 One-Time Password (OTP) for Password Reset',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 35px; text-align: center; border-radius: 12px 12px 0 0; }
                        .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
                        .content { background: #f8fafc; padding: 40px 30px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; }
                        .otp-box { background: white; border: 2px dashed #6366f1; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0; }
                        .otp-code { font-size: 36px; font-weight: 800; color: #4f46e5; letter-spacing: 6px; font-family: 'Courier New', Courier, monospace; margin: 0; }
                        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0; border-radius: 6px; font-size: 14px; color: #78350f; }
                        .footer { text-align: center; margin-top: 30px; color: #94a3b8; font-size: 13px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🔐 Reset Password Verification</h1>
                        </div>
                        <div class="content">
                            <h2>Hello, ${user.name}!</h2>
                            <p>We received a request to reset your password. Use the following One-Time Password (OTP) to complete the verification process:</p>
                            
                            <div class="otp-box">
                                <h2 class="otp-code">${otp}</h2>
                            </div>
                            
                            <div class="warning">
                                <strong>⏰ This OTP is valid for 10 minutes.</strong><br>
                                For your security, never share this code with anyone. If you did not request a password reset, you can safely ignore this email.
                            </div>
                            
                            <div class="footer">
                                <p>Academic Operations Platform</p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `Hello ${user.name},\n\nUse the following One-Time Password (OTP) to reset your password: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`,
            emailType: 'RESET',
            tenantId: user.tenantId,
            userId: user.id,
        }).catch((emailErr) => {
            otpLog.error({ err: emailErr, userId: user.id }, 'Failed to send password reset OTP email');
        });

        // Audit log request
        await auditLogRepository.create({
            actorId: user.id,
            action: 'PASSWORD_RESET_OTP_REQUESTED',
            entityType: 'User',
            entityId: user.id,
            ipAddress,
        });
    }

    // ─── Verify OTP & Reset Password ────────────────────────────
    async verifyOtpAndResetPassword(
        email: string,
        tenantSlug: string,
        otp: string,
        newPassword: string,
        ipAddress?: string
    ): Promise<void> {
        const { tenantService } = await import('./tenant.service.js');
        const tenant = await tenantService.getBySlug(tenantSlug);
        if (!tenant) {
            throw new ApiError(400, 'Invalid institution identifier');
        }

        const user = await userRepository.findByEmail(email, tenant.id);
        if (!user) {
            throw new ApiError(400, 'User with this email not found under this institution');
        }

        // Find latest unused OTP for user
        const resetOtp = await prisma.passwordResetOtp.findFirst({
            where: {
                userId: user.id,
                usedAt: null,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        if (!resetOtp) {
            throw new ApiError(400, 'No active password reset request found. Please request a new OTP.');
        }

        if (resetOtp.expiresAt < new Date()) {
            throw new ApiError(400, 'This OTP has expired. Please request a new code.');
        }

        if (resetOtp.attempts >= 3) {
            throw new ApiError(400, 'This OTP has been locked due to too many failed attempts. Please request a new code.');
        }

        // Hash provided OTP and verify
        const crypto = await import('crypto');
        const hashedInput = crypto.createHash('sha256').update(otp.trim()).digest('hex');

        if (resetOtp.otpHash !== hashedInput) {
            const updatedAttempts = resetOtp.attempts + 1;
            await prisma.passwordResetOtp.update({
                where: { id: resetOtp.id },
                data: { attempts: updatedAttempts },
            });

            if (updatedAttempts >= 3) {
                throw new ApiError(400, 'Incorrect code. This OTP is now locked due to too many failed attempts.');
            }
            throw new ApiError(400, `Incorrect code. Remaining attempts: ${3 - updatedAttempts}`);
        }

        // Validate password strength
        const { validatePassword } = await import('../utils/password-validator.js');
        const validation = validatePassword(newPassword, {
            email: user.email,
            name: user.name,
        });
        if (!validation.isValid) {
            throw new ApiError(400, `Password too weak: ${validation.errors.join(', ')}`);
        }

        // Update password, mark OTP as used, increment tokenVersion (revoking active logins), reset failed attempts
        const newPasswordHash = await this.hashPassword(newPassword);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash: newPasswordHash,
                    tokenVersion: { increment: 1 },
                    lastPasswordChangedAt: new Date(),
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                },
            }),
            prisma.passwordResetOtp.update({
                where: { id: resetOtp.id },
                data: { usedAt: new Date() },
            }),
        ]);

        // Audit log success
        await auditLogRepository.create({
            actorId: user.id,
            action: 'PASSWORD_RESET_WITH_OTP_SUCCESS',
            entityType: 'User',
            entityId: user.id,
            ipAddress,
        });
    }

    // ─── Request Password Reset (Forgot Password) ────────────────
    async requestPasswordReset(
        email: string,
        tenantSlug: string,
        ipAddress?: string
    ): Promise<void> {
        // Always return success (don't leak whether email exists)
        const { tenantService } = await import('./tenant.service.js');
        const tenant = await tenantService.getBySlug(tenantSlug);
        if (!tenant) return;

        const user = await userRepository.findByEmail(email, tenant.id);
        if (!user) return; // Silent fail — don't reveal email existence

        // Rate limit: max 3 reset requests per user per hour
        const recentTokens = await prisma.passwordResetToken.count({
            where: {
                userId: user.id,
                createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
            },
        });
        if (recentTokens >= 3) return; // Silent rate limit

        // Generate cryptographically secure token
        const crypto = await import('crypto');
        const rawToken = crypto.randomBytes(48).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        // Store hashed token (never store raw token)
        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
                ipAddress,
            },
        });

        // Send reset email in background (don't block response — SMTP can be slow)
        // Per OWASP: never reveal whether the email was actually sent
        const { emailService } = await import('./email.service.js');
        const resetUrl = `${config.frontendUrl.trim()}/reset-password?token=${rawToken}&tenant=${tenantSlug}`;
        const { logger } = await import('../utils/logger.js');
        const resetLog = logger.child({ module: 'password-reset' });

        emailService.sendEmail({
            to: user.email,
            subject: '🔐 Password Reset Request — Academic Operations',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                        .header h1 { color: white; margin: 0; font-size: 24px; }
                        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
                        .button { display: inline-block; background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: bold; }
                        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
                        .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 13px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🔐 Password Reset</h1>
                        </div>
                        <div class="content">
                            <h2>Hello, ${user.name}!</h2>
                            <p>We received a request to reset your password. Click the button below to set a new password:</p>
                            
                            <div style="text-align: center;">
                                <a href="${resetUrl}" class="button">Reset My Password</a>
                            </div>
                            
                            <div class="warning">
                                <strong>⏰ This link expires in 1 hour.</strong><br>
                                If you didn't request this, you can safely ignore this email.
                            </div>
                            
                            <div class="footer">
                                <p>If the button doesn't work, copy and paste this URL:<br>
                                <small>${resetUrl}</small></p>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `Hello ${user.name},\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`,
            emailType: 'RESET',
            tenantId: user.tenantId,
            userId: user.id,
        }).catch((emailErr) => {
            resetLog.error({ err: emailErr, userId: user.id }, 'Failed to send password reset email');
        });

        // Audit log
        await auditLogRepository.create({
            actorId: user.id,
            action: 'PASSWORD_RESET_REQUESTED',
            entityType: 'User',
            entityId: user.id,
            ipAddress,
        });
    }

    // ─── Execute Password Reset ───────────────────────────────────
    async resetPassword(
        rawToken: string,
        newPassword: string,
        ipAddress?: string
    ): Promise<void> {
        const crypto = await import('crypto');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

        // Find valid, unused token
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { tokenHash },
            include: { user: { select: { id: true, email: true, name: true } } },
        });

        if (!resetToken) {
            throw new Error('Invalid or expired reset link');
        }

        if (resetToken.usedAt) {
            throw new Error('This reset link has already been used');
        }

        if (resetToken.expiresAt < new Date()) {
            throw new Error('This reset link has expired. Please request a new one');
        }

        // Validate new password strength
        const { validatePassword } = await import('../utils/password-validator.js');
        const validation = validatePassword(newPassword, {
            email: resetToken.user.email,
            name: resetToken.user.name,
        });
        if (!validation.isValid) {
            throw new Error(`Password too weak: ${validation.errors.join(', ')}`);
        }

        // Update password + revoke all sessions + mark token as used
        const newPasswordHash = await this.hashPassword(newPassword);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetToken.userId },
                data: {
                    passwordHash: newPasswordHash,
                    tokenVersion: { increment: 1 },
                    lastPasswordChangedAt: new Date(),
                    failedLoginAttempts: 0,
                    lockedUntil: null, // Unlock if locked
                },
            }),
            prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { usedAt: new Date() },
            }),
        ]);

        // Invalidate all unused tokens for this user (security best practice)
        await prisma.passwordResetToken.updateMany({
            where: {
                userId: resetToken.userId,
                usedAt: null,
                id: { not: resetToken.id },
            },
            data: { usedAt: new Date() },
        });

        // Audit log
        await auditLogRepository.create({
            actorId: resetToken.userId,
            action: 'PASSWORD_RESET_COMPLETED',
            entityType: 'User',
            entityId: resetToken.userId,
            ipAddress,
        });
    }

    // ─── Cleanup Expired Tokens (call periodically) ───────────────
    async cleanupExpiredTokens(): Promise<number> {
        const result = await prisma.passwordResetToken.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: new Date() } },
                    { usedAt: { not: null }, createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
                ],
            },
        });
        return result.count;
    }
}

export const authService = new AuthService();
