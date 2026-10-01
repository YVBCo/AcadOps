import 'dotenv/config';
import prisma from '../data-access/prisma.js';

async function check() {
    const students = await prisma.user.findMany({
        where: { role: 'STUDENT', NOT: { email: { startsWith: 'deleted_' } } },
        select: { id: true, name: true, email: true, passwordHash: true },
        take: 10,
    });

    for (const s of students) {
        const hashPrefix = s.passwordHash.substring(0, 30);
        const startsWithDollar = s.passwordHash.startsWith('$');
        console.log(`${s.id} | ${s.name} | hash starts with $: ${startsWithDollar} | prefix: ${hashPrefix}...`);
    }

    await prisma.$disconnect();
}
check().catch(e => { console.error(e); process.exit(1); });
