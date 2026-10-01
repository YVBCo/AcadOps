import 'dotenv/config';
import prisma from '../data-access/prisma.js';

async function check() {
    // Check department 28
    const dept = await prisma.department.findUnique({ where: { id: 28 } });
    console.log('Department:', JSON.stringify(dept, null, 2));

    // Check students pending USN
    const students = await prisma.studentProfile.findMany({
        where: { optedDepartmentId: 28, temporaryUsn: null },
        include: {
            user: { select: { id: true, name: true, email: true, isActive: true } },
            admissionData: { select: { id: true, emailId: true, fatherDetails: true, motherDetails: true } },
        },
    });
    console.log('\nStudents pending USN:', students.length);
    for (const s of students) {
        console.log('  -', s.user.name, '| email:', s.user.email, '| admYear:', s.admissionYear, '| isLateral:', s.isLateralEntry);
        console.log('    admissionData:', s.admissionData ? `ID=${s.admissionData.id}, fatherEmail=${(s.admissionData.fatherDetails as any)?.email || 'NONE'}, motherEmail=${(s.admissionData.motherDetails as any)?.email || 'NONE'}` : 'NONE');
    }

    await prisma.$disconnect();
}
check().catch(e => { console.error(e); process.exit(1); });
