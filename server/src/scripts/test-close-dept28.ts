import 'dotenv/config';
import prisma from '../data-access/prisma.js';
import { admissionUsnService } from '../services/admissions/index.js';

async function test() {
    try {
        // Find an admin user for the tenant
        const adminUser = await prisma.user.findFirst({
            where: { tenantId: 7, role: 'ADMISSIONS_ADMIN' },
        });
        console.log('Admin user:', adminUser?.id, adminUser?.name);

        if (!adminUser) {
            console.log('No admin found for tenant 7');
            return;
        }

        console.log('\nAttempting closeAdmissionsForDepartment(28)...');
        const result = await admissionUsnService.closeAdmissionsForDepartment(28, adminUser.id, 7);
        console.log('\n✅ Success:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('\n❌ ERROR:', err);
    }

    await prisma.$disconnect();
}
test();
