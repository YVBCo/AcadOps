#!/usr/bin/env node

/**
 * Production migration runner for Render.
 *
 * Existing databases that were initialized with `prisma db push` have no
 * Prisma migration history (P3005). In that case, sync the schema first and
 * only then baseline migrations. Baseline resolution must never precede the
 * schema sync, or newly added migrations can be marked as applied without
 * their SQL ever running.
 */

import { execSync } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

function run(cmd, silent = false) {
    try {
        const output = execSync(cmd, {
            stdio: silent ? 'pipe' : 'inherit',
            env: { ...process.env, NODE_NO_WARNINGS: '1' },
        });
        return { success: true, output: output?.toString() || '' };
    } catch (err) {
        return {
            success: false,
            output: err.stdout?.toString() || '',
            error: err.stderr?.toString() || err.message || '',
        };
    }
}

function isCode(result, code) {
    return result.error?.includes(code) || result.output?.includes(code);
}

function syncSchema() {
    console.log('🔄 Verifying database schema against the current Prisma model...\n');
    const result = run('npx prisma db push');
    if (!result.success) {
        console.error('\n❌ Database schema is not synchronized; refusing to deploy.');
        process.exit(1);
    }
    console.log('✅ Database schema synchronized.');
}

console.log('🔄 Running production migration...\n');

const migrateResult = run('npx prisma migrate deploy');
if (migrateResult.success) {
    console.log('✅ Migrations applied successfully!');
    // Older releases could baseline migrations without applying their schema
    // changes. Keep production aligned until every existing database is
    // repaired, and fail the build if Prisma cannot safely reconcile drift.
    syncSchema();
    process.exit(0);
}

if (!isCode(migrateResult, 'P3005')) {
    console.log('⚠️  migrate deploy failed — retrying once...\n');
    const retry = run('npx prisma migrate deploy');
    if (retry.success) {
        console.log('✅ Migrations applied on retry!');
        syncSchema();
        process.exit(0);
    }

    console.error('\n❌ migrate deploy failed on retry; refusing to deploy against an unknown database schema.');
    process.exit(1);
}

// P3005: existing tables but no migration history. First apply the current
// Prisma schema, then baseline. This makes baselining an accurate record of
// the schema state instead of silently skipping unapplied migration SQL.
console.log('⚠️  Existing database has no migration history. Syncing schema before baselining...\n');
const pushResult = run('npx prisma db push');
if (!pushResult.success) {
    console.error('\n❌ Schema sync failed; refusing to mark migrations applied or deploy.');
    process.exit(1);
}

const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
const migrations = readdirSync(migrationsDir)
    .filter(entry => {
        const fullPath = join(migrationsDir, entry);
        return statSync(fullPath).isDirectory() && /^\d{14}_/.test(entry);
    })
    .sort();

for (const migration of migrations) {
    const result = run(`npx prisma migrate resolve --applied "${migration}"`, true);
    if (result.success || isCode(result, 'P3008')) continue;

    console.error(`❌ Could not baseline migration ${migration}; refusing to deploy.`);
    process.exit(1);
}

console.log('\n🔄 Verifying migration state...\n');
const verification = run('npx prisma migrate deploy');
if (!verification.success) {
    console.error('\n❌ Migrations could not be verified after baselining.');
    process.exit(1);
}

console.log('✅ Existing schema synced and migration history baselined successfully!');
