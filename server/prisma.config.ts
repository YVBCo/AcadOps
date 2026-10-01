import path from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// Load .env so Prisma CLI has access to DATABASE_URL / DIRECT_DATABASE_URL
dotenv.config();

/**
 * Prisma 7 Configuration
 * Centralizes all Prisma settings previously spread across schema.prisma and package.json.
 *
 * The `datasource.url` is used by Prisma CLI (migrations, generate).
 * Uses DIRECT_DATABASE_URL (non-pooled) for CLI operations like migrations & db push,
 * falls back to DATABASE_URL (pooled) if direct URL is not set.
 */
export default defineConfig({
    schema: path.join(import.meta.dirname, 'prisma', 'schema.prisma'),
    datasource: {
        url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || '',
    },
});
