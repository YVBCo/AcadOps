import 'dotenv/config';
import prisma from '../data-access/prisma.js';
import { authService } from '../services/auth.service.js';

async function check() {
    const student = await prisma.user.findFirst({
        where: { name: 'kharyna', role: 'STUDENT' },
        select: { id: true, name: true, email: true, passwordHash: true },
    });
    console.log('kharyna hash:', student?.passwordHash?.substring(0, 40));
    console.log('starts with $:', student?.passwordHash?.startsWith('$'));
    console.log('full hash:', student?.passwordHash);
    
    // Also check yashu and yashwanth (newly closed students)
    const yashu = await prisma.user.findFirst({
        where: { name: 'yashu', role: 'STUDENT' },
        select: { id: true, name: true, email: true, passwordHash: true },
    });
    console.log('\nyashu hash:', yashu?.passwordHash?.substring(0, 40));
    console.log('starts with $:', yashu?.passwordHash?.startsWith('$'));

    // Fix kharyna if needed
    if (student && !student.passwordHash.startsWith('$')) {
        console.log('\n🔧 Fixing kharyna password hash...');
        const hash = await authService.hashPassword('BA2026');
        await prisma.user.update({
            where: { id: student.id },
            data: { passwordHash: hash },
        });
        console.log('✅ Fixed');
    }

    await prisma.$disconnect();
}
check().catch(e => { console.error(e); process.exit(1); });
