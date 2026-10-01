/**
 * Email Queue Service (BullMQ)
 * ──────────────────────────────────────
 * Offloads email delivery to a background Redis queue.
 * Falls back to direct sending when Redis is unavailable.
 *
 * Benefits:
 * - API responses return immediately (don't wait for SMTP/Brevo)
 * - Automatic retries (3 attempts with exponential backoff)
 * - Rate limiting awareness (max 10 emails/second)
 * - Dead letter queue for permanently failed emails
 */
import { Queue, Worker, type Job } from 'bullmq';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'email-queue' });

// ─── Types ───────────────────────────────────────────────────

interface EmailJobData {
    to: string;
    subject: string;
    html: string;
    text?: string;
    emailType?: string;
    tenantId?: number;
    userId?: number;
}

// ─── Redis Connection Options ────────────────────────────────

function getRedisConnection() {
    try {
        const url = new URL(config.redis.url);
        const isTls = url.protocol === 'rediss:';
        return {
            host: url.hostname,
            port: Number(url.port) || 6379,
            password: url.password || undefined,
            ...(isTls ? { tls: {} } : {}),
            maxRetriesPerRequest: null as unknown as number, // BullMQ requires null
        };
    } catch {
        return {
            host: 'localhost',
            port: 6379,
            maxRetriesPerRequest: null as unknown as number,
        };
    }
}

// ─── Queue & Worker ──────────────────────────────────────────

let emailQueue: Queue | null = null;
let emailWorker: Worker | null = null;
let isQueueAvailable = false;

/**
 * Initialize the email queue and worker.
 * Call this on server startup after Redis is confirmed available.
 */
async function initEmailQueue(): Promise<boolean> {
    try {
        const connection = getRedisConnection();

        emailQueue = new Queue('email-delivery', {
            connection,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000, // 5s, 10s, 20s
                },
                removeOnComplete: { count: 500 }, // Keep last 500 completed
                removeOnFail: { count: 200 },      // Keep last 200 failed
            },
        });

        // Worker processes email jobs
        emailWorker = new Worker('email-delivery', async (job: Job<EmailJobData>) => {
            const { emailService } = await import('./email.service.js');
            const { to, subject, html, text, emailType, tenantId, userId } = job.data;

            log.info({ jobId: job.id, to, subject, attempt: job.attemptsMade + 1 }, 'Processing email job');

            const success = await emailService.sendEmail({
                to,
                subject,
                html,
                text,
                emailType,
                tenantId,
                userId,
            });

            if (!success) {
                throw new Error(`Email delivery failed for ${to}`);
            }

            return { to, subject, sentAt: new Date().toISOString() };
        }, {
            connection,
            concurrency: 5,          // Process 5 emails in parallel
            limiter: {
                max: 10,             // Max 10 emails per duration
                duration: 1000,      // Per second — prevents Gmail/Brevo rate limits
            },
        });

        // Event listeners
        emailWorker.on('completed', (job) => {
            log.info({ jobId: job.id, to: job.data.to }, 'Email job completed');
        });

        emailWorker.on('failed', (job, err) => {
            log.error({
                jobId: job?.id,
                to: job?.data.to,
                error: err.message,
                attempts: job?.attemptsMade,
            }, 'Email job failed');
        });

        emailWorker.on('error', (err) => {
            // Suppress connection errors once we've flagged queue as unavailable
            if (!isQueueAvailable) return;
            log.error({ err }, 'Email worker error');
        });

        // Verify queue is operational
        await emailQueue.waitUntilReady();
        isQueueAvailable = true;
        log.info('📮 Email queue initialized (BullMQ + Redis)');
        return true;
    } catch (err) {
        log.warn({ err }, 'Email queue unavailable — falling back to direct sending');
        isQueueAvailable = false;

        // Clean up partially-initialised worker/queue so they stop retrying Redis
        if (emailWorker) {
            try { await emailWorker.close(); } catch { /* ignore */ }
            emailWorker = null;
        }
        if (emailQueue) {
            try { await emailQueue.close(); } catch { /* ignore */ }
            emailQueue = null;
        }

        return false;
    }
}

/**
 * Enqueue an email for background delivery.
 * Falls back to direct sending if queue is unavailable.
 */
async function enqueueEmail(data: EmailJobData): Promise<{ queued: boolean; jobId?: string }> {
    if (!isQueueAvailable || !emailQueue) {
        // Fallback: send directly
        const { emailService } = await import('./email.service.js');
        await emailService.sendEmail(data);
        return { queued: false };
    }

    try {
        const job = await emailQueue.add('send', data, {
            // Use recipient + timestamp as dedup key
            jobId: `email-${data.to}-${Date.now()}`,
        });
        log.info({ jobId: job.id, to: data.to }, 'Email enqueued');
        return { queued: true, jobId: job.id };
    } catch (err) {
        // Queue failed — send directly as fallback
        log.warn({ err, to: data.to }, 'Queue add failed — sending directly');
        const { emailService } = await import('./email.service.js');
        await emailService.sendEmail(data);
        return { queued: false };
    }
}

/**
 * Enqueue a welcome email for background delivery.
 */
async function enqueueWelcomeEmail(
    to: string,
    name: string,
    role: string,
    password: string,
    tenantSlug?: string,
    meta?: { tenantId?: number; userId?: number }
): Promise<{ queued: boolean; jobId?: string }> {
    if (!isQueueAvailable) {
        // Fallback: send directly
        const { emailService } = await import('./email.service.js');
        await emailService.sendWelcomeEmail(to, name, role, password, tenantSlug, meta);
        return { queued: false };
    }

    // Build the welcome email HTML inline (to avoid import issues in worker)
    const { emailService } = await import('./email.service.js');
    const baseUrl = (config.frontendUrl || 'http://localhost:3000').trim();
    const loginUrl = tenantSlug ? `${baseUrl}/login?tenant=${tenantSlug}` : `${baseUrl}/login`;

    return enqueueEmail({
        to,
        subject: `Welcome to Academic Ops — Your ${role} Account is Ready`,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2>Welcome, ${name}!</h2>
            <p>Your <strong>${role}</strong> account has been created.</p>
            <table style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;width:100%;margin:16px 0;">
                <tr><td style="color:#6b7280;padding:4px 8px;">Email/Login</td><td style="font-weight:600;padding:4px 8px;">${to}</td></tr>
                <tr><td style="color:#6b7280;padding:4px 8px;">Password</td><td style="font-weight:600;padding:4px 8px;">${password}</td></tr>
            </table>
            <p><a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Sign In Now</a></p>
            <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Please change your password after first login.</p>
        </div>`,
        emailType: 'WELCOME',
        tenantId: meta?.tenantId,
        userId: meta?.userId,
    });
}

/**
 * Get queue statistics for monitoring.
 */
async function getQueueStats() {
    if (!emailQueue) {
        return { available: false, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }

    try {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            emailQueue.getWaitingCount(),
            emailQueue.getActiveCount(),
            emailQueue.getCompletedCount(),
            emailQueue.getFailedCount(),
            emailQueue.getDelayedCount(),
        ]);

        return { available: true, waiting, active, completed, failed, delayed };
    } catch {
        return { available: false, waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }
}

/**
 * Graceful shutdown — close worker and queue connections.
 */
async function shutdownEmailQueue(): Promise<void> {
    if (emailWorker) {
        await emailWorker.close();
        log.info('Email worker closed');
    }
    if (emailQueue) {
        await emailQueue.close();
        log.info('Email queue closed');
    }
}

export const emailQueueService = {
    init: initEmailQueue,
    enqueue: enqueueEmail,
    enqueueWelcome: enqueueWelcomeEmail,
    getStats: getQueueStats,
    shutdown: shutdownEmailQueue,
    get isAvailable() { return isQueueAvailable; },
};
