import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debug() {
    // Find teacher by email
    const user = await prisma.user.findFirst({
        where: { email: 'ashanagarajmysore@gmail.com' },
        include: { teacherProfile: true }
    });
    console.log('User:', JSON.stringify(user, null, 2));

    // Find all course allocations
    const allocations = await prisma.courseAllocation.findMany({
        include: {
            teacher: { include: { user: true } },
            course: true,
            section: true
        }
    });
    console.log('\nAll Allocations:', JSON.stringify(allocations, null, 2));

    // Find teacher profiles
    const teachers = await prisma.teacherProfile.findMany({
        include: { user: true }
    });
    console.log('\nTeacher Profiles:', JSON.stringify(teachers, null, 2));

    await prisma.$disconnect();
}
debug();
