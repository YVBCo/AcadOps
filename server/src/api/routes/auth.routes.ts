import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { authService } from '../../services/index.js';
import { authenticate, superAdminOnly } from '../middleware/index.js';

const router = Router();

// ─── Rate Limiters (tiered by sensitivity) ────────────────────────

// Login: 10 attempts per 15 minutes
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again later.' },
});

// Password reset request: 5 attempts per 15 minutes (per IP)
const resetRequestLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many reset requests. Please try again later.' },
});

// Token refresh: 30 per 15 minutes (legitimate apps refresh often)
const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many refresh attempts. Please try again later.' },
});

// Change password: 5 per 15 minutes
const changePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many password change attempts. Please try again later.' },
});

// ─── Validation Schemas ───────────────────────────────────────────

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    role: z.enum(['STUDENT', 'TEACHER', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN']).optional(),
    departmentId: z.number().optional(),
});

const loginSchema = z.object({
    identifier: z.string().min(1, 'Email or roll number is required'),
    password: z.string(),
    tenantSlug: z.string().optional(),
});

const forgotPasswordSchema = z.object({
    email: z.string().email('Valid email is required'),
    tenantSlug: z.string().min(1, 'Institution identifier is required'),
});

const resetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const refreshSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
});

const resetPasswordOtpSchema = z.object({
    email: z.string().email('Valid email is required'),
    tenantSlug: z.string().min(1, 'Institution identifier is required'),
    otp: z.string().length(6, 'Verification code must be exactly 6 digits'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// ─── Routes ───────────────────────────────────────────────────────

// POST /api/auth/register — Protected: only Super Admins can register new users
router.post('/register', authenticate, superAdminOnly, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = registerSchema.parse(req.body);
        const result = await authService.register(data, req.user!.userId);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const data = loginSchema.parse(req.body);
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        const result = await authService.login(data, ipAddress, userAgent);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/refresh — Refresh access token using refresh token
router.post('/refresh', refreshLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = refreshSchema.parse(req.body);
        const tokens = await authService.refreshAccessToken(refreshToken);
        res.json(tokens);
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me - Get current user (requires auth)
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await authService.getUserFromToken(
            req.headers.authorization!.split(' ')[1]
        );

        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }

        const { passwordHash: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/change-password — Authenticated users can change their password
router.post('/change-password', authenticate, changePasswordLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
        const tokens = await authService.changePassword(req.user!.userId, currentPassword, newPassword);
        res.json({
            message: 'Password changed successfully. All previous sessions have been revoked.',
            ...tokens,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/forgot-password — Request password reset email
router.post('/forgot-password', resetRequestLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, tenantSlug } = forgotPasswordSchema.parse(req.body);
        const ipAddress = req.ip || req.socket.remoteAddress;

        await authService.requestPasswordReset(email, tenantSlug, ipAddress);

        // Always return success (don't reveal whether email exists)
        res.json({
            message: 'If an account exists with this email, a password reset link has been sent.',
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/reset-password — Execute password reset with token
router.post('/reset-password', resetRequestLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { token, newPassword } = resetPasswordSchema.parse(req.body);
        const ipAddress = req.ip || req.socket.remoteAddress;

        await authService.resetPassword(token, newPassword, ipAddress);

        res.json({
            message: 'Password has been reset successfully. Please login with your new password.',
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/forgot-password-otp — Request password reset OTP email
router.post('/forgot-password-otp', resetRequestLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, tenantSlug } = forgotPasswordSchema.parse(req.body);
        const ipAddress = req.ip || req.socket.remoteAddress;

        await authService.requestPasswordResetOtp(email, tenantSlug, ipAddress);

        // Always return success (don't reveal whether email exists)
        res.json({
            message: 'If an account exists with this email, a verification code has been sent.',
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/reset-password-otp — Execute password reset with OTP
router.post('/reset-password-otp', resetRequestLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, tenantSlug, otp, newPassword } = resetPasswordOtpSchema.parse(req.body);
        const ipAddress = req.ip || req.socket.remoteAddress;

        await authService.verifyOtpAndResetPassword(email, tenantSlug, otp, newPassword, ipAddress);

        res.json({
            message: 'Password has been reset successfully. Please login with your new password.',
        });
    } catch (error) {
        next(error);
    }
});

export default router;
