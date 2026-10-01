import nodemailer from 'nodemailer';
import { randomInt } from 'node:crypto';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../data-access/prisma.js';

const log = logger.child({ module: 'email' });

export interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
    /** Email type for tracking: WELCOME, RESET, NOTIFICATION, EDIT_REQUEST, EDIT_DECISION */
    emailType?: string;
    /** Linked tenant ID for tracking */
    tenantId?: number;
    /** Linked user ID for tracking */
    userId?: number;
}

export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED';

class EmailService {
    private transporter: nodemailer.Transporter | null = null;
    private provider: 'smtp' | 'brevo' | 'log' = 'log';

    // ─── Circuit Breaker State ────────────────────────────────────
    // Prevents cascading latency when email provider is down.
    // After FAILURE_THRESHOLD consecutive failures, circuit opens for
    // RECOVERY_TIMEOUT_MS, fast-failing all sends. After timeout,
    // circuit enters half-open state and allows one test request.
    private static readonly FAILURE_THRESHOLD = 5;
    private static readonly RECOVERY_TIMEOUT_MS = 60_000; // 1 minute
    private consecutiveFailures = 0;
    private circuitOpenedAt: number | null = null;

    private isCircuitOpen(): boolean {
        if (this.circuitOpenedAt === null) return false;
        // Check if recovery timeout has elapsed → half-open
        if (Date.now() - this.circuitOpenedAt >= EmailService.RECOVERY_TIMEOUT_MS) {
            log.info('Email circuit breaker entering half-open state — allowing test request');
            this.circuitOpenedAt = null;
            this.consecutiveFailures = 0;
            return false; // Allow a test request
        }
        return true; // Still open
    }

    private recordSuccess(): void {
        this.consecutiveFailures = 0;
        this.circuitOpenedAt = null;
    }

    private recordFailure(): void {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= EmailService.FAILURE_THRESHOLD && !this.circuitOpenedAt) {
            this.circuitOpenedAt = Date.now();
            log.error(
                { failures: this.consecutiveFailures },
                'Email circuit breaker OPENED — fast-failing all sends for 60s'
            );
        }
    }

    constructor() {
        // Determine email provider
        if (config.smtp.brevoApiKey) {
            this.provider = 'brevo';
            log.info('Email provider: Brevo (HTTP API)');
        } else if (config.smtp.user && config.smtp.pass) {
            this.provider = 'smtp';
            log.info({ host: config.smtp.host, port: config.smtp.port }, 'Email provider: SMTP');
        } else {
            this.provider = 'log';
            log.warn('No email provider configured — emails will be logged only (set BREVO_API_KEY or SMTP_USER/SMTP_PASS)');
        }
    }

    // ─── Core Send Methods ─────────────────────────────────────────

    /**
     * Send email via Brevo HTTP API (works on Railway, Vercel, etc.)
     */
    private async sendViaBrevo(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
        const apiKey = config.smtp.brevoApiKey!;
        const fromRaw = config.smtp.brevoFrom || 'Academic Ops <no-reply@acadops.edu>';

        // Parse "Name <email>" format
        const match = fromRaw.match(/^(.+?)\s*<(.+?)>$/);
        const senderName = match ? match[1].trim() : 'Academic Ops';
        const senderEmail = match ? match[2].trim() : fromRaw;

        try {
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'api-key': apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    sender: { name: senderName, email: senderEmail },
                    to: [{ email: options.to }],
                    subject: options.subject,
                    htmlContent: options.html,
                    textContent: options.text,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                log.error({ status: response.status, body: errorBody, to: options.to }, 'Brevo API error');
                return { success: false, error: `Brevo ${response.status}: ${errorBody.substring(0, 500)}` };
            }

            const result = await response.json() as { messageId: string };
            log.info({ to: options.to, messageId: result.messageId }, 'Email sent via Brevo');
            return { success: true, messageId: result.messageId };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            log.error({ err: error, to: options.to }, 'Brevo API request failed');
            return { success: false, error: errMsg };
        }
    }

    /**
     * Send email via SMTP (nodemailer)
     */
    private async sendViaSmtp(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
        try {
            if (!this.transporter) {
                this.transporter = nodemailer.createTransport({
                    host: config.smtp.host,
                    port: config.smtp.port,
                    secure: config.smtp.port === 465,
                    auth: {
                        user: config.smtp.user,
                        pass: config.smtp.pass,
                    },
                });
            }

            const result = await this.transporter.sendMail({
                from: config.smtp.from,
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
            });
            log.info({ to: options.to, messageId: result.messageId }, 'Email sent via SMTP');
            return { success: true, messageId: result.messageId };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            log.error({ err: error, to: options.to }, 'SMTP send failed');
            return { success: false, error: errMsg };
        }
    }

    /**
     * Log-only mode (no email sent)
     */
    private async sendViaLog(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
        log.info({ to: options.to, subject: options.subject }, 'Email (log-only mode — not actually sent)');
        return { success: true, messageId: `log-${Date.now()}` };
    }

    // ─── Tracked Send (logs every attempt to DB) ─────────────────────

    /**
     * Check if an email address is a real, deliverable address.
     * Returns false for internal placeholder addresses.
     */
    private isDeliverableAddress(email: string): boolean {
        if (!email || !email.includes('@')) return false;
        const domain = email.split('@')[1]?.toLowerCase();
        // Skip internal placeholder addresses generated by bulk upload or admission flows
        const internalDomains = ['noreply.internal', 'internal.local', 'placeholder.local', 'student.edu'];
        return !internalDomains.includes(domain);
    }

    /**
     * Verify SMTP connection is working (call on startup for early failure detection).
     */
    async verifyConnection(): Promise<boolean> {
        if (this.provider !== 'smtp') return true;
        try {
            if (!this.transporter) {
                this.transporter = nodemailer.createTransport({
                    host: config.smtp.host,
                    port: config.smtp.port,
                    secure: config.smtp.port === 465,
                    auth: { user: config.smtp.user, pass: config.smtp.pass },
                });
            }
            await this.transporter.verify();
            log.info('SMTP connection verified successfully');
            return true;
        } catch (err) {
            log.error({ err }, 'SMTP connection verification FAILED — emails will not be delivered');
            return false;
        }
    }

    /**
     * Send an email and log the result to the email_logs table.
     * Every email attempt is recorded — success or failure.
     */
    async sendEmail(options: SendEmailOptions): Promise<boolean> {
        // Circuit breaker: fast-fail when email provider is known to be down
        if (this.isCircuitOpen()) {
            log.warn({ to: options.to, subject: options.subject }, 'Email circuit breaker OPEN — fast-failing send');
            this.logEmailAttempt(options, { success: false, error: 'Circuit breaker open — email provider down' }).catch(() => {});
            return false;
        }

        // Guard: skip internal/placeholder addresses
        if (!this.isDeliverableAddress(options.to)) {
            log.info({ to: options.to, subject: options.subject }, 'Skipping email — internal/placeholder address');
            this.logEmailAttempt(options, { success: true, messageId: `skipped-internal-${Date.now()}`, error: undefined }).catch(() => {});
            return true; // Don't fail the caller
        }

        log.info({ to: options.to, subject: options.subject, provider: this.provider }, 'Sending email');

        // Execute the send
        let result: { success: boolean; messageId?: string; error?: string };
        switch (this.provider) {
            case 'brevo':
                result = await this.sendViaBrevo(options);
                break;
            case 'smtp':
                result = await this.sendViaSmtp(options);
                break;
            default:
                result = await this.sendViaLog(options);
                break;
        }

        // Record success/failure for circuit breaker
        if (result.success) {
            this.recordSuccess();
        } else {
            this.recordFailure();
            log.error({ to: options.to, error: result.error, provider: this.provider }, 'EMAIL DELIVERY FAILED — check provider config');
        }

        // Log to email_logs table (non-blocking — never let logging fail the email flow)
        this.logEmailAttempt(options, result).catch((err) => {
            log.error({ err }, 'Failed to log email attempt to database');
        });

        return result.success;
    }

    /**
     * Persist email send attempt to the email_logs table.
     */
    private async logEmailAttempt(
        options: SendEmailOptions,
        result: { success: boolean; messageId?: string; error?: string }
    ): Promise<void> {
        try {
            await prisma.emailLog.create({
                data: {
                    tenantId: options.tenantId ?? null,
                    to: options.to,
                    subject: options.subject.substring(0, 500),
                    status: result.success ? 'SENT' : 'FAILED',
                    provider: this.provider,
                    messageId: result.messageId ?? null,
                    errorMessage: result.error?.substring(0, 2000) ?? null,
                    emailType: options.emailType ?? null,
                    userId: options.userId ?? null,
                    sentAt: result.success ? new Date() : null,
                },
            });
        } catch (err) {
            log.error({ err }, 'Failed to persist email log');
        }
    }

    // ─── Template Methods ─────────────────────────────────────────

    /**
     * Send welcome email with login credentials
     */
    async sendWelcomeEmail(
        to: string,
        name: string,
        role: string,
        password: string,
        tenantSlug?: string,
        meta?: { tenantId?: number; userId?: number }
    ): Promise<boolean> {
        const baseUrl = (config.frontendUrl || 'http://localhost:3000').trim();
        const loginUrl = tenantSlug
            ? `${baseUrl}/login?tenant=${tenantSlug}`
            : `${baseUrl}/login`;
        const subject = '🎓 Welcome to Academic Operations Platform';
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .header h1 { color: white; margin: 0; }
                    .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
                    .credentials { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #6366f1; margin: 20px 0; }
                    .credentials p { margin: 8px 0; }
                    .credentials strong { color: #6366f1; }
                    .button { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
                    .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 14px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎓 Welcome!</h1>
                    </div>
                    <div class="content">
                        <h2>Hello, ${name}!</h2>
                        <p>Your account has been created on the Academic Operations Platform. You have been assigned the role of <strong>${role}</strong>.</p>
                        
                        <div class="credentials">
                            <p><strong>Email:</strong> ${to}</p>
                            <p><strong>Password:</strong> ${password}</p>
                        </div>
                        
                        <p>⚠️ Please change your password after first login for security.</p>
                        
                        <a href="${loginUrl}" class="button">Login Now</a>
                        
                        <div class="footer">
                            <p>If you didn't expect this email, please contact your administrator.</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const text = `
Welcome to Academic Operations Platform!

Hello, ${name}!

Your account has been created with the role: ${role}

Your login credentials:
Email: ${to}
Password: ${password}

Login URL: ${loginUrl}

Please change your password after first login for security.
        `;

        return this.sendEmail({
            to,
            subject,
            html,
            text,
            emailType: 'WELCOME',
            tenantId: meta?.tenantId,
            userId: meta?.userId,
        });
    }

    /**
     * Send edit request notification to admin
     */
    async sendEditRequestNotification(
        adminEmail: string,
        adminName: string,
        requesterName: string,
        editType: string,
        entityInfo: string,
        meta?: { tenantId?: number }
    ): Promise<boolean> {
        const subject = `📝 Edit Request: ${editType} from ${requesterName}`;
        const html = `
            <h2>New Edit Request</h2>
            <p>Hello ${adminName},</p>
            <p><strong>${requesterName}</strong> has requested to edit ${editType} for: <strong>${entityInfo}</strong></p>
            <p>Please review this request in your admin dashboard.</p>
            <a href="${config.frontendUrl.trim()}/dashboard/admin/edit-requests">Review Request</a>
        `;

        return this.sendEmail({
            to: adminEmail,
            subject,
            html,
            emailType: 'EDIT_REQUEST',
            tenantId: meta?.tenantId,
        });
    }

    /**
     * Send edit approval/rejection notification
     */
    async sendEditDecisionNotification(
        teacherEmail: string,
        teacherName: string,
        editType: string,
        approved: boolean,
        reviewNote?: string,
        meta?: { tenantId?: number }
    ): Promise<boolean> {
        const status = approved ? 'Approved ✅' : 'Rejected ❌';
        const subject = `Edit Request ${status}: ${editType}`;
        const html = `
            <h2>Edit Request ${status}</h2>
            <p>Hello ${teacherName},</p>
            <p>Your request to edit <strong>${editType}</strong> has been <strong>${approved ? 'approved' : 'rejected'}</strong>.</p>
            ${reviewNote ? `<p>Note: ${reviewNote}</p>` : ''}
            ${approved ? '<p>The changes have been applied.</p>' : '<p>No changes were made.</p>'}
        `;

        return this.sendEmail({
            to: teacherEmail,
            subject,
            html,
            emailType: 'EDIT_DECISION',
            tenantId: meta?.tenantId,
        });
    }

    // ─── Password Generation (CSPRNG) ────────────────────────────

    generatePassword(length: number = 12): string {
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

    // ─── Email Log Queries (for developer dashboard) ─────────────

    /**
     * List email logs with filtering and pagination.
     */
    async listLogs(filters: {
        tenantId?: number;
        status?: string;
        emailType?: string;
        to?: string;
        limit?: number;
        offset?: number;
    }) {
        const where: Record<string, unknown> = {};
        if (filters.tenantId) where.tenantId = filters.tenantId;
        if (filters.status) where.status = filters.status;
        if (filters.emailType) where.emailType = filters.emailType;
        if (filters.to) where.to = { contains: filters.to, mode: 'insensitive' };

        const [logs, total] = await Promise.all([
            prisma.emailLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: filters.limit || 50,
                skip: filters.offset || 0,
                include: {
                    tenant: { select: { name: true, slug: true } },
                },
            }),
            prisma.emailLog.count({ where }),
        ]);

        return { emails: logs, total };
    }

    /**
     * Get email delivery stats for developer dashboard.
     */
    async getStats() {
        const [total, sent, failed, last24h, failedLast24h] = await Promise.all([
            prisma.emailLog.count(),
            prisma.emailLog.count({ where: { status: 'SENT' } }),
            prisma.emailLog.count({ where: { status: 'FAILED' } }),
            prisma.emailLog.count({
                where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
            }),
            prisma.emailLog.count({
                where: {
                    status: 'FAILED',
                    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                },
            }),
        ]);

        const deliveryRate = total > 0 ? Math.round((sent / total) * 100 * 10) / 10 : 100;

        return {
            total,
            sent,
            failed,
            deliveryRate,
            last24h,
            failedLast24h,
            provider: this.provider,
        };
    }

    /**
     * Retry sending a failed email by ID.
     */
    async retryFailed(logId: number): Promise<{ success: boolean; message: string }> {
        const emailLog = await prisma.emailLog.findUnique({ where: { id: logId } });
        if (!emailLog) {
            return { success: false, message: 'Email log not found' };
        }
        if (emailLog.status === 'SENT') {
            return { success: false, message: 'Email was already sent successfully' };
        }

        // We can't resend from the log alone (no HTML stored for size reasons)
        // But we can mark it for retry tracking
        await prisma.emailLog.update({
            where: { id: logId },
            data: { retryCount: { increment: 1 } },
        });

        return { success: true, message: 'Retry count incremented. Re-trigger the original action to resend.' };
    }

    /**
     * Cleanup old email logs (older than N days).
     */
    async cleanup(olderThanDays: number = 90): Promise<number> {
        const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
        const result = await prisma.emailLog.deleteMany({
            where: { createdAt: { lt: cutoff } },
        });
        log.info({ deletedCount: result.count, olderThanDays }, 'Cleaned up old email logs');
        return result.count;
    }
}

export const emailService = new EmailService();
