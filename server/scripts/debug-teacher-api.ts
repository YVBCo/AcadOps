import { PrismaClient } from '@prisma/client';
import { TeacherService } from '../services/teacher.service.js';

const prisma = new PrismaClient();

async function debug() {
    console.log('=== Debug Teacher Service ===\n');

    // Find teacher user
    const user = await prisma.user.findFirst({
        where: { email: 'ashanagarajmysore@gmail.com' },
        include: { teacherProfile: true }
    });

    if (!user) {
        console.log('ERROR: Teacher user not found!');
        return;
    }

    console.log('User found:');
    console.log('  ID:', user.id);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  TeacherProfile:', user.teacherProfile ? `ID ${user.teacherProfile.id}` : 'NONE');

    if (!user.teacherProfile) {
        console.log('\nERROR: No TeacherProfile found for this user!');
        return;
    }

    console.log('\n=== Testing getAssignedCourses ===');

    try {
        // Direct Prisma query
        const allocations = await prisma.courseAllocation.findMany({
            where: { teacherId: user.teacherProfile.id },
            include: {
                course: { include: { department: true } },
                section: {
                    include: {
                        department: true,
                        batch: true,
                        _count: { select: { students: true } }
                    }
                }
            }
        });

        console.log('Allocations found:', allocations.length);
        allocations.forEach(a => {
            console.log(`  - ${a.course.code} - ${a.course.name} | Section ${a.section.name}`);
        });
    } catch (error) {
        console.log('ERROR in Prisma query:', error);
    }

    await prisma.$disconnect();
}

debug();
