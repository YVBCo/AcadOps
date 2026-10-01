import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || '';
const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Starting database seed...\n');

    // ─── Developer Account (for the Developer Portal) ───────────
    const devPassword = await argon2.hash('dev123', { type: argon2.argon2id });

    const developer = await prisma.developer.upsert({
        where: { email: 'dev@system.com' },
        update: {},
        create: {
            email: 'dev@system.com',
            passwordHash: devPassword,
            name: 'Platform Developer',
        },
    });
    console.log('✅ Developer account created:', developer.email);

    console.log('\n✅ Database seeding completed!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Developer Portal:  dev@system.com / dev123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 Use the Developer Portal to create tenants (institutions).');
    console.log('   Each tenant will get its own Super Admin with auto-generated credentials.\n');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
