import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('=== DEPARTMENT ADMINS ===');
    const deptAdmins = await prisma.user.findMany({
        where: { role: 'DEPARTMENT_ADMIN' },
        select: {
            id: true,
            email: true,
            name: true,
            departmentId: true,
            department: { select: { id: true, name: true, code: true } }
        }
    });
    console.log(JSON.stringify(deptAdmins, null, 2));

    console.log('\n=== ALL DEPARTMENTS ===');
    const depts = await prisma.department.findMany({
        select: { id: true, name: true, code: true }
    });
    console.log(JSON.stringify(depts, null, 2));

    // Find CS department
    const csDept = depts.find(d => d.code === 'CS');
    console.log('\n=== CS DEPT ===');
    console.log(csDept);

    if (csDept) {
        console.log('\n=== STUDENTS WITH optedDepartmentId = CS (first 5) ===');
        const csOptedStudents = await prisma.studentProfile.findMany({
            where: { optedDepartmentId: csDept.id },
            take: 5,
            include: {
                user: { select: { id: true, name: true, email: true } },
                batch: { select: { id: true, name: true } }
            }
        });
        console.log(JSON.stringify(csOptedStudents, null, 2));
        console.log(`Total CS opted students: ${await prisma.studentProfile.count({ where: { optedDepartmentId: csDept.id } })}`);
    }

    // Check what students are in Batch 2023
    const batch2023 = await prisma.batch.findFirst({ where: { name: '2023' } });
    if (batch2023) {
        console.log('\n=== BATCH 2023 STUDENT COUNTS BY optedDepartmentId ===');
        const batchStudents = await prisma.studentProfile.groupBy({
            by: ['optedDepartmentId'],
            where: { batchId: batch2023.id },
            _count: true
        });
        console.log(JSON.stringify(batchStudents, null, 2));

        console.log('\n=== BATCH 2023 STUDENT COUNTS BY cycleDepartmentId ===');
        const batchCycleStudents = await prisma.studentProfile.groupBy({
            by: ['cycleDepartmentId'],
            where: { batchId: batch2023.id },
            _count: true
        });
        console.log(JSON.stringify(batchCycleStudents, null, 2));
    }

    await prisma.$disconnect();
}

main().catch(console.error);
