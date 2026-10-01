import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Fixing Department Admin departmentId...');

    // Update the Department Admin (user id 2) to have departmentId = 3 (CSE)
    const updated = await prisma.user.update({
        where: { id: 2 },
        data: { departmentId: 3 },
        include: { department: true }
    });

    console.log('Updated user:');
    console.log(JSON.stringify(updated, null, 2));

    await prisma.$disconnect();
}

main().catch(console.error);
