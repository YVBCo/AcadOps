import pino from 'pino';
import { config } from '../config/index.js';

/**
 * Structured Logger — pino-based, production-grade.
 *
 * - JSON output in production (machine-parseable)
 * - Pretty colored output in development (via pino-pretty)
 * - Log level from LOG_LEVEL env var
 * - Child loggers for per-service context
 */
export const logger = pino({
    level: config.server.logLevel || 'info',
    transport: config.server.isDev
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
            },
        }
        : undefined, // JSON output in production
});

export type Logger = pino.Logger;
