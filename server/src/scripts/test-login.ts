import 'dotenv/config';
import prisma from '../data-access/prisma.js';
import { authService } from '../services/auth.service.js';

async function testLogin() {
    // Find a few students to test
    const students = await prisma.user.findMany({
        where: { role: 'STUDENT', NOT: { email: { startsWith: 'deleted_' } } },
        include: {
            studentProfile: {
                include: {
                    optedDepartment: { select: { code: true } },
                },
            },
            department: { select: { code: true } },
        },
        take: 5,
    });

    for (const student of students) {
        const deptCode = student.studentProfile?.optedDepartment?.code || student.department?.code || 'GEN';
        const admissionYear = student.studentProfile?.admissionYear || 2026;
        const expectedPassword = `${deptCode.replace(/[^A-Z0-9]/gi, '').toUpperCase()}${admissionYear}`;

        // Correct order: verifyPassword(hash, password)
        const isValid = await authService.verifyPassword(student.passwordHash, expectedPassword);
        const status = isValid ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} | ${student.name} | email: ${student.email} | rollNo: ${student.studentProfile?.rollNumber} | pwd: ${expectedPassword}`);
    }

    await prisma.$disconnect();
}

testLogin().catch(e => { console.error(e); process.exit(1); });
