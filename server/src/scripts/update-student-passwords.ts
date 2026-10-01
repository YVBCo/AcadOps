/**
 * One-time migration script: Update ALL existing student passwords
 * to the new branch+batch format (e.g. CSE2023).
 *
 * Run with: npx tsx src/scripts/update-student-passwords.ts
 */
import 'dotenv/config';
import prisma from '../data-access/prisma.js';
import { authService } from '../services/auth.service.js';
import { generateStudentPassword } from '../services/admissions/shared.js';

async function main() {
    console.log('🔄 Starting bulk student password update...\n');

    // Fetch all students with their profiles and departments
    const students = await prisma.user.findMany({
        where: {
            role: 'STUDENT',
            NOT: { email: { startsWith: 'deleted_' } },
        },
        include: {
            studentProfile: {
                include: {
                    optedDepartment: { select: { code: true, name: true } },
                },
            },
            department: { select: { code: true, name: true } },
        },
    });

    console.log(`Found ${students.length} students to update.\n`);

    // Group by dept+year so we hash each unique password only once
    const passwordCache = new Map<string, string>();
    let updated = 0;
    let skipped = 0;

    for (const student of students) {
        const profile = student.studentProfile;
        if (!profile) {
            console.log(`⚠️  Skipping ${student.name} (no student profile)`);
            skipped++;
            continue;
        }

        // Get department code from profile's opted department, or user's department
        const deptCode =
            profile.optedDepartment?.code ||
            student.department?.code ||
            'GEN';

        const admissionYear = profile.admissionYear || new Date().getFullYear();
        const newPassword = generateStudentPassword(deptCode, admissionYear);

        // Get or compute hash (cache to avoid re-hashing same password)
        let passwordHash = passwordCache.get(newPassword);
        if (!passwordHash) {
            passwordHash = await authService.hashPassword(newPassword);
            passwordCache.set(newPassword, passwordHash);
            console.log(`  🔑 New password group: ${newPassword}`);
        }

        // Update the user's password
        await prisma.user.update({
            where: { id: student.id },
            data: { passwordHash },
        });

        updated++;
    }

    // Print summary
    console.log('\n📋 Password Summary:');
    console.log('─'.repeat(50));
    for (const [password] of passwordCache.entries()) {
        console.log(`  🔑 ${password}`);
    }
    console.log('─'.repeat(50));
    console.log(`\n✅ Updated: ${updated} | ⚠️ Skipped: ${skipped} | Total: ${students.length}`);
    console.log('\nDone! All student passwords now use BRANCH+YEAR format.');
}

main()
    .catch((err) => {
        console.error('❌ Script failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
