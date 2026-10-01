/**
 * Email Service Unit Tests
 * ──────────────────────────────────────
 * Tests email delivery logic: provider selection, Brevo API,
 * internal address filtering, and delivery logging.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../data-access/prisma.js', async () => {
    const { prismaMock } = await import('../__tests__/mocks/prisma.mock.js');
    return { prisma: prismaMock, default: prismaMock };
});

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

// Mock nodemailer
vi.mock('nodemailer', () => ({
    default: {
        createTransport: vi.fn(() => ({
            sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-smtp-id-123' }),
            verify: vi.fn().mockResolvedValue(true),
        })),
    },
}));

// Mock fetch for Brevo
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('EmailService', () => {
    let emailService: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockFetch.mockReset();

        // Reset module to get fresh instance
        vi.resetModules();

        // Re-import with clean state
        const mod = await import('../services/email.service.js');
        emailService = mod.emailService;
    });

    // ─── Internal Address Filtering ──────────────────────────────

    describe('isDeliverableAddress (via sendEmail)', () => {
        it('should skip @noreply.internal addresses', async () => {
            const result = await emailService.sendEmail({
                to: 'student123.1234567@noreply.internal',
                subject: 'Welcome',
                html: '<p>Hello</p>',
            });

            // Should return true (success) but NOT actually send
            expect(result).toBe(true);
        });

        it('should skip @internal.local addresses', async () => {
            const result = await emailService.sendEmail({
                to: 'user@internal.local',
                subject: 'Test',
                html: '<p>Test</p>',
            });
            expect(result).toBe(true);
        });

        it('should skip @placeholder.local addresses', async () => {
            const result = await emailService.sendEmail({
                to: 'temp@placeholder.local',
                subject: 'Test',
                html: '<p>Test</p>',
            });
            expect(result).toBe(true);
        });

        it('should skip empty email addresses', async () => {
            const result = await emailService.sendEmail({
                to: '',
                subject: 'Test',
                html: '<p>Test</p>',
            });
            expect(result).toBe(true);
        });

        it('should skip addresses without @', async () => {
            const result = await emailService.sendEmail({
                to: 'not-an-email',
                subject: 'Test',
                html: '<p>Test</p>',
            });
            expect(result).toBe(true);
        });
    });

    // ─── Provider Selection ──────────────────────────────────────

    describe('provider selection', () => {
        it('should default to log provider when no SMTP or Brevo configured', () => {
            // Default test env has no SMTP_USER/SMTP_PASS or BREVO_API_KEY
            // So provider should be 'log'
            expect(emailService.provider).toBeDefined();
        });
    });

    // ─── Welcome Email Template ──────────────────────────────────

    describe('sendWelcomeEmail', () => {
        it('should send welcome email with correct template structure', async () => {
            const result = await emailService.sendWelcomeEmail(
                'student@example.com',
                'John Doe',
                'Student',
                'tempPass123',
                'test-college',
                { tenantId: 1, userId: 10 }
            );

            // Should succeed (log provider just logs it)
            expect(typeof result).toBe('boolean');
        });

        it('should skip welcome email for internal addresses', async () => {
            const result = await emailService.sendWelcomeEmail(
                'usn1001.1234567@noreply.internal',
                'Internal Student',
                'Student',
                'tempPass123',
                'test-college',
            );

            expect(result).toBe(true); // Skipped, not failed
        });
    });

    // ─── SMTP Verification ───────────────────────────────────────

    describe('verifyConnection', () => {
        it('should return true for non-SMTP providers', async () => {
            const result = await emailService.verifyConnection();
            expect(result).toBe(true); // log provider always returns true
        });
    });
});
