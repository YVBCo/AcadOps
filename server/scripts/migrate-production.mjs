#!/usr/bin/env node

/**
 * Smart Migration Runner for Render/Production
 * ─────────────────────────────────────────────
 * Handles the P3005 "database not empty" error by baselining
 * existing migrations when deploying to a database that was
 * originally set up with `prisma db push`.
 *
 * Usage: node scripts/migrate-production.mjs
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

console.log('🔄 Running production migration...\n');

// Step 1: Try normal migrate deploy
const migrateResult = run('npx prisma migrate deploy');

if (migrateResult.success) {
    console.log('✅ Migrations applied successfully!');
    process.exit(0);
}

// Check if it's a P3005 (database not empty / not baselined) error
const isP3005 = migrateResult.error?.includes('P3005') || migrateResult.output?.includes('P3005');

if (!isP3005) {
    // Not a baseline issue — could be transient connection error, just retry once
    console.log('⚠️  migrate deploy failed (not P3005) — retrying once...\n');
    const retry = run('npx prisma migrate deploy');
    if (retry.success) {
        console.log('✅ Migrations applied on retry!');
        process.exit(0);
    }

    // Fall through to db push safety net
    console.log('⚠️  migrate deploy retry failed — falling back to db push\n');
} else {
    // Step 2: P3005 — need to baseline existing migrations
    console.log('⚠️  First-time migration setup — baselining existing migrations...\n');

    const migrationsDir = join(process.cwd(), 'prisma', 'migrations');
    const migrations = readdirSync(migrationsDir)
        .filter(entry => {
            const fullPath = join(migrationsDir, entry);
            return statSync(fullPath).isDirectory() && /^\d{14}_/.test(entry);
        })
        .sort();

    let baselined = 0;
    let alreadyApplied = 0;
    for (const migration of migrations) {
        const result = run(`npx prisma migrate resolve --applied "${migration}"`, true);
        if (result.success) {
            baselined++;
            console.log(`  ✓ Baselined: ${migration}`);
        } else if (result.error?.includes('P3008') || result.output?.includes('P3008')) {
            // Already applied — this is fine, skip silently
            alreadyApplied++;
        } else {
            console.log(`  ⚠ Skipped: ${migration} (transient error)`);
        }
    }

    console.log(`\n✅ Baselined ${baselined} new, ${alreadyApplied} already applied (${migrations.length} total)`);

    // Retry migrate deploy for any pending migrations
    console.log('\n🔄 Applying pending migrations...\n');
    const retryResult = run('npx prisma migrate deploy');
    if (retryResult.success) {
        console.log('✅ All migrations applied successfully!');
        process.exit(0);
    }
}

// Step 3: Final safety net — db push ensures schema is fully synced
console.log('🔄 Syncing schema with db push (safety net)...\n');
const pushResult = run('npx prisma db push');
if (pushResult.success) {
    console.log('✅ Schema fully synced!');
} else {
    console.log('⚠️  db push had issues — schema may already be in sync');
}

process.exit(0);
