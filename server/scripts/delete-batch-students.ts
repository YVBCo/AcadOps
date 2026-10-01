import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteStudents() {
    // Find batch 2023
    const batch = await prisma.batch.findFirst({ where: { name: '2023' } });
    if (!batch) {
        console.log('Batch 2023 not found');
        return;
    }

    // Find all student profiles in batch 2023
    const profiles = await prisma.studentProfile.findMany({
        where: { batchId: batch.id },
        include: { user: true }
    });

    console.log('Found', profiles.length, 'students in batch 2023');

    // Get user IDs before deleting profiles
    const userIds = profiles.map(p => p.userId);

    // Delete student profiles first (due to FK constraints)
    const deletedProfiles = await prisma.studentProfile.deleteMany({
        where: { batchId: batch.id }
    });
    console.log('Deleted', deletedProfiles.count, 'student profiles');

    // Delete user records
    const deletedUsers = await prisma.user.deleteMany({
        where: { id: { in: userIds } }
    });
    console.log('Deleted', deletedUsers.count, 'users');

    console.log('Done! You can now recreate the students with the fixed logic.');
}

deleteStudents()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e);
        prisma.$disconnect();
        process.exit(1);
    });
