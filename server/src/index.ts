import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config/index.js';
import routes from './api/routes/index.js';
import { errorHandler, notFoundHandler, authenticate } from './api/middleware/index.js';
import { requestIdMiddleware } from './api/middleware/request-id.middleware.js';
import { developerService } from './services/developer.service.js';
import { logger } from './utils/logger.js';
import { sanitizeRequest } from './api/middleware/sanitize.middleware.js';

const log = logger.child({ module: 'server' });

const app = express();

// Trust Railway's reverse proxy (required for rate limiting + correct client IPs)
app.set('trust proxy', 1);

// ─── CORS (must run BEFORE helmet & rate limiter for preflight) ──
app.use(cors({
    origin: config.server.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
}));

// Explicit preflight handler — ensures OPTIONS never reaches rate limiter
// Express 5 requires named wildcard params: '{*path}' instead of '*'
app.options('{*path}', cors({
    origin: config.server.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
}));

// ─── Health check (before helmet/rate-limiter for uptime monitors) ─
app.get('/health', async (_req, res) => {
    const checks: Record<string, unknown> = { server: 'ok', database: 'error', cache: 'error' };
    let healthy = true;
    const startTime = Date.now();

    // Database connectivity + latency
    try {
        const { prisma } = await import('./data-access/prisma.js');
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        checks.database = 'ok';
        checks.db_latency_ms = Date.now() - dbStart;
    } catch {
        healthy = false;
    }

    // Redis connectivity
    try {
        const { default: cacheService } = await import('./services/cache.service.js');
        const pong = await cacheService.get('health:ping');
        checks.cache = pong !== undefined || pong === null ? 'ok' : 'error';
    } catch {
        // Redis is optional — don't fail health check entirely
        checks.cache = 'ok'; // Degrade gracefully
    }

    // System metrics
    const memUsage = process.memoryUsage();
    checks.uptime_seconds = Math.floor(process.uptime());
    checks.memory_mb = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heap_used: Math.round(memUsage.heapUsed / 1024 / 1024),
        heap_total: Math.round(memUsage.heapTotal / 1024 / 1024),
    };
    checks.response_ms = Date.now() - startTime;

    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks });
});

// ─── Security Middleware (Hardened) ───────────────────────────
app.use(helmet({
    hsts: {
        maxAge: 31536000,       // 1 year
        includeSubDomains: true,
        preload: true,
    },
    contentSecurityPolicy: config.server.isProd ? {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
        },
    } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ─── Response Compression (~70% bandwidth reduction) ──────────
app.use(compression());

// ─── Rate Limiting (Redis-backed for horizontal scaling) ──────
let rateLimitStore: import('express-rate-limit').Store | undefined = undefined;
if (config.server.isProd) {
    // Use Redis store in production for multi-instance support
    try {
        const { default: RedisStore } = await import('rate-limit-redis');
        const { default: cacheService } = await import('./services/cache.service.js');
        const redisClient = cacheService.getClient?.();
        if (redisClient) {
            rateLimitStore = new RedisStore({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ioredis/rate-limit-redis type mismatch
                sendCommand: (...args: string[]) => (redisClient as import('ioredis').Redis).call(args[0], ...args.slice(1)) as any,
            });
            log.info('Rate limiting using Redis store');
        }
    } catch {
        log.warn('Redis rate limit store not available, using memory store');
    }
}

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: config.server.isProd ? 500 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
    store: rateLimitStore,
    validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
    skip: (req) => req.method === 'OPTIONS', // Never rate-limit CORS preflight
});
app.use(globalLimiter);

// ─── Body Parsing ─────────────────────────────────────────────
// Default 1MB limit — file upload routes override with their own limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── XSS Sanitization ────────────────────────────────────────
app.use(sanitizeRequest);

// ─── Request ID + Scoped Logger ──────────────────────────────
app.use(requestIdMiddleware);

// ─── Request Logging (dev only) ───────────────────────────────
if (config.server.isDev) {
    app.use((req, _res, next) => {
        log.debug({ requestId: req.requestId, method: req.method, path: req.path }, 'incoming request');
        next();
    });
}

// ─── Static Files ─────────────────────────────────────────────
// Path traversal guard — reject any request with `..` or null bytes
const staticGuard: express.RequestHandler = (req, res, next) => {
    if (req.path.includes('..') || req.path.includes('\0')) {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    next();
};
const staticOptions = { dotfiles: 'deny' as const, index: false };

// Login background images must be public (login page is unauthenticated)
// Allow cross-origin loading since client runs on a different port
app.use('/uploads/login-bg', staticGuard, (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
}, express.static(path.join(process.cwd(), 'uploads', 'login-bg'), staticOptions));
// All other uploads remain auth-gated
app.use('/uploads', staticGuard, authenticate, express.static(path.join(process.cwd(), 'uploads'), staticOptions));

// ─── API Documentation (dev only) ─────────────────────────────
if (config.server.isDev) {
    import('./api/docs/swagger.js').then(({ default: docsRouter }) => {
        app.use('/api-docs', docsRouter);
        log.info({ url: `http://localhost:${config.server.port}/api-docs` }, '📚 Swagger UI available');
    }).catch((err) => {
        log.warn({ err }, 'Swagger UI could not be loaded');
    });
}

// API Routes
app.use('/api', routes);

// Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const HOST = '0.0.0.0';
const server = app.listen(config.server.port, HOST, async () => {
    // ─── Database Connection Warmup ───────────────────────────────
    // Eagerly establish a Postgres connection so the first user request
    // doesn't pay the Neon cold-start penalty (~3-7s).
    try {
        const warmupStart = Date.now();
        const { prisma } = await import('./data-access/prisma.js');
        await prisma.$queryRaw`SELECT 1`;
        log.info({ latency_ms: Date.now() - warmupStart }, 'Database connection warmed up');
    } catch (err) {
        log.warn({ err }, 'Database warmup failed — first request may be slow');
    }

    // Seed developer account if none exists
    try {
        await developerService.seedIfEmpty();
    } catch (err) {
        log.error({ err }, 'Failed to seed developer account');
    }

    // ─── Periodic Cleanup: tokens, email logs, system errors, audit logs ──
    // Runs every 6 hours to prevent unbounded table growth
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    setInterval(async () => {
        try {
            const { authService } = await import('./services/index.js');
            const cleaned = await authService.cleanupExpiredTokens();
            if (cleaned > 0) {
                log.info({ cleaned }, 'Cleaned expired password reset tokens');
            }
        } catch (err) {
            log.warn({ err }, 'Token cleanup failed (non-critical)');
        }
        try {
            const { emailService } = await import('./services/email.service.js');
            const emailsCleaned = await emailService.cleanup(90);
            if (emailsCleaned > 0) {
                log.info({ emailsCleaned }, 'Cleaned old email logs (>90 days)');
            }
        } catch (err) {
            log.warn({ err }, 'Email log cleanup failed (non-critical)');
        }
        try {
            const { systemErrorService } = await import('./services/system-error.service.js');
            const result = await systemErrorService.cleanup(30);
            if (result.count > 0) {
                log.info({ cleaned: result.count }, 'Cleaned resolved system errors (>30 days)');
            }
        } catch (err) {
            log.warn({ err }, 'System error cleanup failed (non-critical)');
        }
        try {
            // Monitor audit log table size — immutability guard prevents deletion
            // Alert when audit logs exceed 100k records for manual archival/export
            const { prisma } = await import('./data-access/prisma.js');
            const auditCount = await prisma.auditLog.count();
            if (auditCount > 100_000) {
                log.warn({ auditCount }, 'Audit log table exceeds 100k records — consider exporting old records');
            }
        } catch (err) {
            log.warn({ err }, 'Audit log monitoring failed (non-critical)');
        }
    }, SIX_HOURS);

    // ─── Database Keep-Alive: Prevent Neon Compute Auto-Suspend ──
    // Runs a lightweight query every 4 minutes to keep the Neon Postgres endpoint permanently warm
    const FOUR_MINUTES = 4 * 60 * 1000;
    setInterval(async () => {
        try {
            const { prisma } = await import('./data-access/prisma.js');
            await prisma.$queryRaw`SELECT 1`;
            log.debug('Database Keep-Alive: Ping successful (Neon compute warm)');
        } catch (err) {
            log.warn({ err }, 'Database Keep-Alive: Ping failed (non-critical)');
        }
    }, FOUR_MINUTES);

    log.info({
        port: config.server.port,
        env: config.server.nodeEnv,
        apiUrl: `http://localhost:${config.server.port}/api`,
    }, '🚀 Server started');

    // Verify email delivery is working on startup
    try {
        const { emailService } = await import('./services/email.service.js');
        await emailService.verifyConnection();
    } catch (err) {
        log.warn({ err }, 'Email connection check failed — emails may not be delivered');
    }

    // Initialize BullMQ email queue (non-blocking — falls back to direct send)
    try {
        const { emailQueueService } = await import('./services/email-queue.service.js');
        await emailQueueService.init();
    } catch (err) {
        log.warn({ err }, 'Email queue init skipped — using direct send');
    }
});

// ─── Request Timeout (120s) ───────────────────────────────────
server.setTimeout(120_000);

// Graceful shutdown
const shutdown = async () => {
    log.info('Shutting down server...');
    server.close(async () => {
        try {
            const { disconnectPrisma } = await import('./data-access/prisma.js');
            const { default: cacheService } = await import('./services/cache.service.js');
            const { emailQueueService } = await import('./services/email-queue.service.js');
            await emailQueueService.shutdown();
            await disconnectPrisma();
            await cacheService.disconnect();
        } catch (e) {
            log.error({ err: e }, 'Error during shutdown');
        }
        log.info('Server closed gracefully');
        process.exit(0);
    });

    // Force exit after 10s if graceful shutdown fails
    setTimeout(() => {
        log.fatal('Forced shutdown after timeout');
        process.exit(1);
    }, 10_000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Crash handlers — prevent silent deaths in production
process.on('unhandledRejection', (reason: unknown) => {
    log.error({ err: reason }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (error: Error) => {
    log.fatal({ err: error }, 'Uncaught Exception');
    shutdown();
});

export default app;
