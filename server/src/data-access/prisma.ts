/**
 * Prisma Client Singleton with Connection Pooling
 * Optimized for 1,000+ concurrent users
 * Uses Neon PostgreSQL with SSL
 *
 * Prisma 7: Uses @prisma/adapter-pg driver adapter (no Rust engine)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import pg from 'pg';

const log = logger.child({ module: 'prisma' });

const prismaClientSingleton = () => {
    // Use DIRECT_DATABASE_URL (bypasses Neon PgBouncer) for our own pg.Pool.
    // Pool-on-pool (pg.Pool → PgBouncer) causes connection issues & added latency.
    // Falls back to DATABASE_URL (pooler) if direct URL is not configured.
    let dbUrl = config.database.directUrl || config.database.url;
    if (!dbUrl.includes('sslmode=') && !dbUrl.includes('localhost')) {
        dbUrl += dbUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
    }

    log.info(`Connecting to Postgres via ${config.database.directUrl ? 'DIRECT (non-pooler)' : 'POOLER'} URL`);

    const pool = new pg.Pool({
        connectionString: dbUrl,
        max: 15,                          // 15 connections (Neon free tier allows ~20 total)
        min: 2,                           // Keep 2 warm connections ready
        idleTimeoutMillis: 30000,         // Close idle clients after 30 seconds
        connectionTimeoutMillis: 5000,    // Fail fast in 5 seconds if Postgres is down
        ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    });

    pool.on('error', (err: Error) => {
        log.error({ err }, 'PostgreSQL connection pool error');
    });

    const adapter = new PrismaPg(pool);

    const baseClient = new PrismaClient({
        adapter,
        log: config.server.isDev ? ['query', 'error', 'warn'] : ['error'],
    });

    // Slow query monitoring (on base client before extending)
    baseClient.$on('query' as never, (e: any) => {
        if (e.duration > 1000) {
            log.warn({ duration: e.duration, query: e.query }, 'Slow query detected');
        }
    });

    // ─── Audit Log Immutability Protection ────────────────────────
    // Block all delete operations on AuditLog — audit logs must be immutable
    const client = baseClient.$extends({
        query: {
            auditLog: {
                async delete() {
                    throw new Error('Audit logs are immutable and cannot be deleted');
                },
                async deleteMany() {
                    throw new Error('Audit logs are immutable and cannot be deleted');
                },
            },
        },
    });

    return client;
};

/** The extended Prisma client type (with audit-log immutability guard) */
export type ExtendedPrismaClient = ReturnType<typeof prismaClientSingleton>;

/**
 * Transaction client type that matches the extended client.
 * Use this instead of Prisma.TransactionClient when passing tx around.
 */
export type ExtendedTransactionClient = Parameters<
    Parameters<ExtendedPrismaClient['$transaction']>[0]
>[0];

declare global {
    // eslint-disable-next-line no-var
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prisma ?? prismaClientSingleton();

if (config.server.nodeEnv !== 'production') {
    globalThis.prisma = prisma;
}

// Graceful shutdown handler
export async function disconnectPrisma() {
    await prisma.$disconnect();
    log.info('Database connection closed');
}

/**
 * Check database connectivity (for health endpoints).
 * Returns true if DB responds, false otherwise.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch {
        return false;
    }
}

export default prisma;
