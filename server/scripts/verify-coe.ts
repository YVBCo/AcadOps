
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:4000/api';

async function request(endpoint: string, method: string, body?: any, token?: string) {
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

async function main() {
    console.log('🧪 Starting COE Permission Verification...');

    // 1. Clean up existing COE
    console.log('🧹 Cleaning up existing COE users...');
    await prisma.user.deleteMany({
        where: { role: 'COE' }
    });
    console.log('✅ Cleanup complete.');

    // 2. Login as Super Admin
    console.log('🔑 Logging in as Super Admin...');
    let superAdminToken = '';

    const loginRes = await request('/auth/login', 'POST', {
        email: 'admin@college.edu',
        password: 'admin123'
    });

    if (loginRes.ok) {
        superAdminToken = loginRes.data.token;
        console.log('✅ Super Admin logged in.');
    } else {
        console.error('❌ Failed to login as Super Admin:', loginRes.data);
        process.exit(1);
    }

    // 3. Create COE User
    console.log('👤 Creating COE User...');
    const coeEmail = 'coe@college.edu';
    const coePassword = 'password123';

    const createRes = await request('/users', 'POST', {
        email: coeEmail,
        password: coePassword,
        name: 'Test COE',
        role: 'COE'
    }, superAdminToken);

    if (createRes.ok) {
        console.log('✅ COE User created.');
    } else {
        console.error('❌ Failed to create COE:', createRes.data);
        process.exit(1);
    }

    // 4. Login as COE
    console.log('🔑 Logging in as COE...');
    let coeToken = '';
    const coeLoginRes = await request('/auth/login', 'POST', {
        email: coeEmail,
        password: coePassword
    });

    if (coeLoginRes.ok) {
        coeToken = coeLoginRes.data.token;
        console.log('✅ COE logged in.');
    } else {
        console.error('❌ Failed to login as COE:', coeLoginRes.data);
        process.exit(1);
    }

    // 5. Setup: Need a Department and Program to create a Course
    let dept = await prisma.department.findFirst();
    let prog = await prisma.program.findFirst();

    if (!dept || !prog) {
        console.warn('⚠️ No department or program found. Creating dummy ones for test...');

        if (!dept) {
            const deptRes = await request('/departments', 'POST', {
                name: 'Test Department',
                code: 'TEST',
                description: 'Created by verification script'
            }, superAdminToken);

            if (deptRes.ok) {
                dept = await prisma.department.findUnique({ where: { id: deptRes.data.id } });
                console.log('✅ Created dummy department.');
            } else {
                console.error('❌ Failed to create dummy department:', deptRes.data);
            }
        }

        if (!prog && dept) { // Program needs dept
            // Create program logic, need to check Program endpoint requirements. 
            // Usually Program creation is simpler but might need dept connection which is Many-to-Many now?
            // Let's assume standard creation for now or skip if too complex to script quickly.
            // Actually, Program creation might require specific relation logic.
            // Let's try to create a simple one.
            const progRes = await request('/programs', 'POST', {
                name: 'Test Program',
                code: 'TP',
                departmentIds: [dept.id],
                durationYears: 4
            }, superAdminToken);

            if (progRes.ok) {
                prog = await prisma.program.findUnique({ where: { id: progRes.data.id } });
                console.log('✅ Created dummy program.');
            } else {
                console.error('❌ Failed to create dummy program:', progRes.data);
            }
        }
    }

    if (dept && prog) {
        console.log(`ℹ️ Using Dept ID: ${dept.id}, Prog ID: ${prog.id}`);

        const courseData = {
            name: 'Test Course 101',
            code: 'TC101',
            credits: 4,
            departmentId: dept.id,
            programId: prog.id,
            description: 'Test Description'
        };

        // 6. Try to Create Course as Super Admin (Should Fail)
        console.log('🛡️ Testing Super Admin Course Creation (Expect Failure)...');
        const failRes = await request('/courses', 'POST', courseData, superAdminToken);

        if (failRes.status === 403) {
            console.log('✅ Super Admin blocked from creating course (403).');
        } else if (failRes.ok) {
            console.error('❌ Super Admin WAS able to create course! (Security Failure)');
        } else {
            console.error('❓ Unexpected error for Super Admin:', failRes.status);
        }

        // 7. Try to Create Course as COE (Should Success)
        console.log('🛡️ Testing COE Course Creation (Expect Success)...');
        const successRes = await request('/courses', 'POST', courseData, coeToken);
        let courseId = 0;

        if (successRes.ok) {
            courseId = successRes.data.id;
            console.log('✅ COE created course successfully.');
        } else {
            console.error('❌ COE failed to create course:', successRes.data);
        }

        if (courseId) {
            // 8. Try to Delete as Super Admin (Should Fail)
            console.log('🛡️ Testing Super Admin Course Deletion (Expect Failure)...');
            const deleteFailRes = await request(`/courses/${courseId}`, 'DELETE', undefined, superAdminToken);

            if (deleteFailRes.status === 403) {
                console.log('✅ Super Admin blocked from deleting course (403).');
            } else if (deleteFailRes.ok) {
                console.error('❌ Super Admin WAS able to delete course! (Security Failure)');
            } else {
                console.error('❓ Unexpected error for Super Admin delete:', deleteFailRes.status);
            }

            // 9. Try to Delete as COE (Should Success)
            console.log('🛡️ Testing COE Course Deletion (Expect Success)...');
            const deleteSuccessRes = await request(`/courses/${courseId}`, 'DELETE', undefined, coeToken);

            if (deleteSuccessRes.ok) {
                console.log('✅ COE deleted course successfully.');
            } else {
                console.error('❌ COE failed to delete course:', deleteSuccessRes.data);
            }
        }
    } else {
        console.error('❌ Skipping course tests due to missing dependencies.');
    }

    console.log('\n🏁 Verification Complete.');
    await prisma.$disconnect();
}

main();
