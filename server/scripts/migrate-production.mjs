#!/usr/bin/env node

/**
 * Synchronize the production database schema before starting the API.
 *
 * This production database was initialized with `prisma db push` and does not
 * have a complete Prisma migration history. Running `migrate deploy` and then
 * resolving every historical migration on each boot is unsafe: it creates
 * many short-lived connections and has exhausted the Supabase session pool.
 * Keep startup to the single schema-sync command used to initialize this DB.
 */
import { execFileSync } from 'node:child_process';

console.log('🔄 Synchronizing production database schema...');

try {
  const output = execFileSync('npx', ['prisma', 'db', 'push'], {
    encoding: 'utf8',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  });

  if (output) process.stdout.write(output);
  console.log('✅ Database schema synchronized; continuing startup.');
} catch (error) {
  const output = `${error.stdout?.toString() ?? ''}${error.stderr?.toString() ?? ''}`;
  if (output) process.stderr.write(output);
  console.error('❌ Database schema sync failed; refusing to start.');
  if (!output) console.error(error.message);
  process.exit(1);
}
