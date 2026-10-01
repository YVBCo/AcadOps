import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || '';
const adapter = new PrismaPg({ connectionString: dbUrl });
const prisma = new PrismaClient({ adapter });

// Sample Indian names for students
const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Arnav', 'Ayaan', 'Krishna', 'Ishaan',
    'Aadhya', 'Ananya', 'Pari', 'Anika', 'Diya', 'Saanvi', 'Ira', 'Myra', 'Sara', 'Kiara',
    'Rohan', 'Kabir', 'Advait', 'Dhruv', 'Atharv', 'Reyansh', 'Shaurya', 'Pranav', 'Kian', 'Ved',
    'Aarohi', 'Navya', 'Riya', 'Aditi', 'Prisha', 'Shanaya', 'Tara', 'Anvi', 'Avni', 'Dia',
    'Aryan', 'Aayan', 'Veer', 'Aarush', 'Rudra', 'Shivansh', 'Kartik', 'Laksh', 'Ayush', 'Aarav'];

const lastNames = ['Sharma', 'Verma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Gupta', 'Joshi', 'Nair', 'Iyer',
    'Mehta', 'Desai', 'Kulkarni', 'Rao', 'Menon', 'Chopra', 'Banerjee', 'Chatterjee', 'Pillai', 'Agarwal',
    'Malhotra', 'Kapoor', 'Bhatia', 'Sethi', 'Ghosh', 'Das', 'Sinha', 'Pandey', 'Mishra', 'Tiwari'];

// CSE Courses for each semester
const cseCourses = [
    // Semester 1 (Physics Cycle)
    { sem: 1, name: 'Engineering Mathematics I', code: 'PHY101', credits: 4 },
    { sem: 1, name: 'Engineering Physics', code: 'PHY102', credits: 4 },
    { sem: 1, name: 'Engineering Chemistry', code: 'PHY103', credits: 3 },
    { sem: 1, name: 'Software Engineering', code: 'PHY104', credits: 3 },
    { sem: 1, name: 'Basic Electrical Engineering', code: 'PHY105', credits: 3 },

    // Semester 2 (Chemistry Cycle)
    { sem: 2, name: 'Engineering Mathematics II', code: 'CHEM101', credits: 4 },
    { sem: 2, name: 'Engineering Mechanics', code: 'CHEM102', credits: 4 },
    { sem: 2, name: 'Introduction to Programming', code: 'CHEM103', credits: 3 },
    { sem: 2, name: 'Technical English', code: 'CHEM104', credits: 2 },
    { sem: 2, name: 'Environmental Studies', code: 'CHEM105', credits: 2 },

    // Semester 3 (CSE)
    { sem: 3, name: 'Data Structures', code: 'CS301', credits: 4 },
    { sem: 3, name: 'Digital Logic Design', code: 'CS302', credits: 3 },
    { sem: 3, name: 'Object Oriented Programming', code: 'CS303', credits: 4 },
    { sem: 3, name: 'Discrete Mathematics', code: 'CS304', credits: 3 },
    { sem: 3, name: 'Computer Organization', code: 'CS305', credits: 3 },

    // Semester 4
    { sem: 4, name: 'Algorithms', code: 'CS401', credits: 4 },
    { sem: 4, name: 'Operating Systems', code: 'CS402', credits: 4 },
    { sem: 4, name: 'Database Management Systems', code: 'CS403', credits: 4 },
    { sem: 4, name: 'Theory of Computation', code: 'CS404', credits: 3 },
    { sem: 4, name: 'Microprocessors', code: 'CS405', credits: 3 },

    // Semester 5
    { sem: 5, name: 'Computer Networks', code: 'CS501', credits: 4 },
    { sem: 5, name: 'Software Engineering', code: 'CS502', credits: 3 },
    { sem: 5, name: 'Web Technologies', code: 'CS503', credits: 3 },
    { sem: 5, name: 'Machine Learning', code: 'CS504', credits: 4 },
    { sem: 5, name: 'Compiler Design', code: 'CS505', credits: 3 },

    // Semester 6
    { sem: 6, name: 'Artificial Intelligence', code: 'CS601', credits: 4 },
    { sem: 6, name: 'Cloud Computing', code: 'CS602', credits: 3 },
    { sem: 6, name: 'Cybersecurity', code: 'CS603', credits: 3 },
    { sem: 6, name: 'Mobile Application Development', code: 'CS604', credits: 3 },
    { sem: 6, name: 'Big Data Analytics', code: 'CS605', credits: 4 },

    // Semester 7
    { sem: 7, name: 'Blockchain Technology', code: 'CS701', credits: 3 },
    { sem: 7, name: 'IoT and Applications', code: 'CS702', credits: 3 },
    { sem: 7, name: 'Deep Learning', code: 'CS703', credits: 4 },
    { sem: 7, name: 'DevOps', code: 'CS704', credits: 3 },
    { sem: 7, name: 'Project Work I', code: 'CS705', credits: 4 },

    // Semester 8
    { sem: 8, name: 'Natural Language Processing', code: 'CS801', credits: 4 },
    { sem: 8, name: 'Computer Vision', code: 'CS802', credits: 3 },
    { sem: 8, name: 'Quantum Computing', code: 'CS803', credits: 3 },
    { sem: 8, name: 'Project Work II', code: 'CS804', credits: 6 },
];

function generateRandomMarks(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
    console.log('🌱 Starting comprehensive database seed...\n');

    const demoPassword = await argon2.hash('demo123', { type: argon2.argon2id });
    const superAdminPassword = await argon2.hash('admin123', { type: argon2.argon2id });

    // Create Super Admin
    const superAdmin = await prisma.user.upsert({
        where: { email: 'admin@college.edu' },
        update: {},
        create: {
            email: 'admin@college.edu',
            passwordHash: superAdminPassword,
            name: 'Super Admin',
            role: 'SUPER_ADMIN',
        },
    });
    console.log('✅ Super Admin created');

    // Create Departments
    const phyDept = await prisma.department.upsert({
        where: { code: 'PHY' },
        update: { isCycleDepartment: true },
        create: {
            name: 'Physics',
            code: 'PHY',
            description: 'Physics Department - Cycle',
            isCycleDepartment: true,
        },
    });

    const chemDept = await prisma.department.upsert({
        where: { code: 'CHEM' },
        update: { isCycleDepartment: true },
        create: {
            name: 'Chemistry',
            code: 'CHEM',
            description: 'Chemistry Department - Cycle',
            isCycleDepartment: true,
        },
    });

    const cseDept = await prisma.department.upsert({
        where: { code: 'CSE' },
        update: {},
        create: {
            name: 'Computer Science & Engineering',
            code: 'CSE',
            description: 'Computer Science & Engineering',
            isCycleDepartment: false,
        },
    });
    console.log('✅ Departments created');

    // Create Program
    const cseProgram = await prisma.program.upsert({
        where: { code: 'BE-CSE' },
        update: {},
        create: {
            name: 'Bachelor of Engineering in Computer Science',
            code: 'BE-CSE',
            durationYears: 4,
        },
    });

    await prisma.department.update({
        where: { id: cseDept.id },
        data: { programs: { connect: { id: cseProgram.id } } },
    });
    console.log('✅ CSE Program created');

    // Create Batches
    const batch2026 = await prisma.batch.upsert({
        where: { name: '2026' },
        update: {},
        create: {
            name: '2026',
            startYear: 2026,
            currentSemester: 1,
            isGraduated: false,
        },
    });

    const batch2024 = await prisma.batch.upsert({
        where: { name: '2024' },
        update: {},
        create: {
            name: '2024',
            startYear: 2024,
            currentSemester: 3,
            isGraduated: false,
        },
    });
    console.log('✅ Batches created');

    // Create Admin Users
    const clerk = await prisma.user.upsert({
        where: { email: 'clerk@college.edu' },
        update: {},
        create: {
            email: 'clerk@college.edu',
            passwordHash: demoPassword,
            name: 'Admin Clerk',
            role: 'ADMIN_CLERK',
        },
    });

    const coe = await prisma.user.upsert({
        where: { email: 'coe@college.edu' },
        update: {},
        create: {
            email: 'coe@college.edu',
            passwordHash: demoPassword,
            name: 'Controller of Examinations',
            role: 'COE',
        },
    });

    const admissionsAdmin = await prisma.user.upsert({
        where: { email: 'admissions@college.edu' },
        update: {},
        create: {
            email: 'admissions@college.edu',
            passwordHash: demoPassword,
            name: 'Admissions Admin',
            role: 'ADMISSIONS_ADMIN',
        },
    });

    const deptAdmin = await prisma.user.upsert({
        where: { email: 'deptadmin@college.edu' },
        update: {},
        create: {
            email: 'deptadmin@college.edu',
            passwordHash: demoPassword,
            name: 'CSE Dept Admin',
            role: 'DEPARTMENT_ADMIN',
            departmentId: cseDept.id,
        },
    });

    const teacher = await prisma.user.upsert({
        where: { email: 'teacher@college.edu' },
        update: {},
        create: {
            email: 'teacher@college.edu',
            passwordHash: demoPassword,
            name: 'CSE Teacher',
            role: 'TEACHER',
            departmentId: cseDept.id,
        },
    });
    console.log('✅ Admin users created');

    // Create Sections for Batch 2026 (2 sections)
    const section2026A = await prisma.section.create({
        data: {
            name: 'A',
            departmentId: phyDept.id, // Currently in Physics
            batchId: batch2026.id,
        },
    });

    const section2026B = await prisma.section.create({
        data: {
            name: 'B',
            departmentId: phyDept.id,
            batchId: batch2026.id,
        },
    });

    // Create Sections for Batch 2024 (2 sections)
    const section2024A = await prisma.section.create({
        data: {
            name: 'A',
            departmentId: cseDept.id,
            batchId: batch2024.id,
        },
    });

    const section2024B = await prisma.section.create({
        data: {
            name: 'B',
            departmentId: cseDept.id,
            batchId: batch2024.id,
        },
    });
    console.log('✅ Sections created');

    // Create Courses for all semesters
    const createdCourses: any[] = [];
    for (const course of cseCourses) {
        const deptId = course.sem <= 2
            ? (course.sem === 1 ? phyDept.id : chemDept.id)
            : cseDept.id;

        const created = await prisma.course.create({
            data: {
                name: course.name,
                code: course.code,
                credits: course.credits,
                departmentId: deptId,
                programId: cseProgram.id,
                semesterNumber: course.sem,
                internalMarks: 50,
                externalMarks: 50,
            },
        });
        createdCourses.push({ ...created, sem: course.sem });
    }
    console.log(`✅ Created ${createdCourses.length} courses for all semesters`);

    // Create 100 Students (50 per batch)
    console.log('\n📚 Creating 100 students...');

    let studentCount = 0;
    let demoStudent2026 = null;
    let demoStudent2024 = null;

    // Create 50 students for Batch 2026 (Semester 1)
    for (let i = 0; i < 50; i++) {
        const section = i < 25 ? section2026A : section2026B;
        const firstName = firstNames[i % firstNames.length];
        const lastName = lastNames[Math.floor(i / 2) % lastNames.length];
        const rollNum = `4VP26CS${String(i + 1).padStart(3, '0')}`;

        const user = await prisma.user.create({
            data: {
                email: `${rollNum.toLowerCase()}@student.edu`,
                passwordHash: demoPassword,
                name: `${firstName} ${lastName}`,
                role: 'STUDENT',
                departmentId: phyDept.id, // Currently in Physics cycle
            },
        });

        await prisma.studentProfile.create({
            data: {
                userId: user.id,
                rollNumber: rollNum,
                admissionYear: 2026,
                currentSemester: 1,
                batchId: batch2026.id,
                programId: cseProgram.id,
                sectionId: section.id,
                cycleDepartmentId: phyDept.id,
                optedDepartmentId: cseDept.id,
            },
        });

        // Save first student as demo
        if (i === 0) {
            demoStudent2026 = { email: user.email, rollNumber: rollNum, name: user.name };
        }

        studentCount++;
        if (studentCount % 10 === 0) {
            console.log(`  Created ${studentCount} students...`);
        }
    }

    // Create 50 students for Batch 2024 (Semester 3)
    for (let i = 0; i < 50; i++) {
        const section = i < 25 ? section2024A : section2024B;
        const firstName = firstNames[(i + 25) % firstNames.length];
        const lastName = lastNames[Math.floor((i + 15) / 2) % lastNames.length];
        const rollNum = `4VP24CS${String(i + 1).padStart(3, '0')}`;

        const user = await prisma.user.create({
            data: {
                email: `${rollNum.toLowerCase()}@student.edu`,
                passwordHash: demoPassword,
                name: `${firstName} ${lastName}`,
                role: 'STUDENT',
                departmentId: cseDept.id, // In CSE (past cycle)
            },
        });

        await prisma.studentProfile.create({
            data: {
                userId: user.id,
                rollNumber: rollNum,
                admissionYear: 2024,
                currentSemester: 3,
                batchId: batch2024.id,
                programId: cseProgram.id,
                sectionId: section.id,
                cycleDepartmentId: null, // Not in cycle
                optedDepartmentId: cseDept.id,
            },
        });

        // Save first student as demo
        if (i === 0) {
            demoStudent2024 = { email: user.email, rollNumber: rollNum, name: user.name };
        }

        studentCount++;
        if (studentCount % 10 === 0) {
            console.log(`  Created ${studentCount} students...`);
        }
    }

    console.log(`✅ Created ${studentCount} students total\n`);

    // Add Results (Final Marks) for Batch 2024 (completed semesters 1 & 2)
    console.log('\n📊 Creating results for Batch 2024 (completed semesters)...');

    const batch2024Students = await prisma.studentProfile.findMany({
        where: { batchId: batch2024.id },
        include: { user: true },
    });

    let resultsCount = 0;

    // Add results for Semester 1 and 2 (completed)
    for (const completedSem of [1, 2]) {
        const semCourses = createdCourses.filter(c => c.sem === completedSem);
        const deptId = completedSem === 1 ? phyDept.id : chemDept.id;

        for (const student of batch2024Students) {
            for (const course of semCourses) {
                // Generate realistic marks
                const internalMarks = generateRandomMarks(35, 50); // Out of 50
                const semesterMarks = generateRandomMarks(30, 50); // Out of 50
                const totalMarks = internalMarks + semesterMarks;
                const passed = totalMarks >= 50; // Passing threshold

                await prisma.result.create({
                    data: {
                        studentUsn: student.rollNumber,
                        courseId: course.id,
                        batchId: batch2024.id,
                        departmentId: deptId,
                        internalMarks,
                        semesterMarks,
                        totalMarks,
                        status: passed ? 'PASS' : 'FAIL',
                        isPublished: true,
                        publishedAt: new Date(),
                    },
                });

                resultsCount++;
            }
        }
    }

    console.log(`✅ Created ${resultsCount} result entries for Batch 2024`);

    // Add Internal Marks for current semester (Batch 2026 - Sem 1, Batch 2024 - Sem 3)
    console.log('\n📝 Creating internal marks for current semesters...');

    let internalMarksCount = 0;

    // Batch 2026 - Semester 1 internal marks
    const batch2026Students = await prisma.studentProfile.findMany({
        where: { batchId: batch2026.id },
        include: { user: true, section: true },
    });

    const sem1Courses = createdCourses.filter(c => c.sem === 1);
    for (const student of batch2026Students) {
        for (const course of sem1Courses) {
            const internal1 = generateRandomMarks(12, 20); // Out of 20
            const internal2 = generateRandomMarks(12, 20);
            const internal3 = generateRandomMarks(12, 20);
            const assignmentMarks = generateRandomMarks(8, 10); // Out of 10

            // Best of 2 internals + assignments
            const sortedInternals = [internal1, internal2, internal3].sort((a, b) => b - a);
            const calculatedTotal = sortedInternals[0] + sortedInternals[1] + assignmentMarks;

            await prisma.internalMarksDetail.create({
                data: {
                    studentUsn: student.rollNumber,
                    courseId: course.id,
                    batchId: batch2026.id,
                    sectionId: student.sectionId!,
                    internal1,
                    internal2,
                    internal3,
                    assignmentMarks,
                    calculatedTotal,
                    isFinalized: true,
                    mentorApprovalStatus: 'APPROVED_BY_MENTOR',
                },
            });

            internalMarksCount++;
        }
    }

    // Batch 2024 - Semester 3 internal marks
    const sem3Courses = createdCourses.filter(c => c.sem === 3);
    for (const student of batch2024Students) {
        for (const course of sem3Courses) {
            const internal1 = generateRandomMarks(12, 20);
            const internal2 = generateRandomMarks(12, 20);
            const internal3 = generateRandomMarks(12, 20);
            const assignmentMarks = generateRandomMarks(8, 10);

            const sortedInternals = [internal1, internal2, internal3].sort((a, b) => b - a);
            const calculatedTotal = sortedInternals[0] + sortedInternals[1] + assignmentMarks;

            await prisma.internalMarksDetail.create({
                data: {
                    studentUsn: student.rollNumber,
                    courseId: course.id,
                    batchId: batch2024.id,
                    sectionId: student.sectionId!,
                    internal1,
                    internal2,
                    internal3,
                    assignmentMarks,
                    calculatedTotal,
                    isFinalized: true,
                    mentorApprovalStatus: 'APPROVED_BY_MENTOR',
                },
            });

            internalMarksCount++;
        }
    }

    console.log(`✅ Created ${internalMarksCount} internal marks entries`);

    console.log('\n✅ Database seeding completed!\n');
    console.log('================================================================================');
    console.log('📋 DEMO CREDENTIALS');
    console.log('================================================================================\n');

    console.log('🔐 Admin Accounts:');
    console.log('─────────────────────────────────────────────────');
    console.log('Super Admin:       admin@college.edu / admin123');
    console.log('Admissions Admin:  admissions@college.edu / demo123');
    console.log('Admin Clerk:       clerk@college.edu / demo123');
    console.log('COE:               coe@college.edu / demo123');
    console.log('Dept Admin (CSE):  deptadmin@college.edu / demo123');
    console.log('Teacher (CSE):     teacher@college.edu / demo123\n');

    console.log('👨‍🎓 Demo Student Accounts:');
    console.log('─────────────────────────────────────────────────');
    console.log(`Batch 2026 (Sem 1): ${demoStudent2026?.email} / demo123`);
    console.log(`  Name: ${demoStudent2026?.name}`);
    console.log(`  Roll: ${demoStudent2026?.rollNumber}\n`);
    console.log(`Batch 2024 (Sem 3): ${demoStudent2024?.email} / demo123`);
    console.log(`  Name: ${demoStudent2024?.name}`);
    console.log(`  Roll: ${demoStudent2024?.rollNumber}\n`);

    console.log('📊 Database Summary:');
    console.log('─────────────────────────────────────────────────');
    console.log(`Total Students:    100 (50 per batch)`);
    console.log(`Batches:           2 (2026 Sem 1, 2024 Sem 3)`);
    console.log(`Sections:          4 (2 per batch, 25 students each)`);
    console.log(`Courses:           ${createdCourses.length} (covering all 8 semesters)`);
    console.log(`Departments:       13 (Physics, Chemistry, CSE + 10 others)`);
    console.log('================================================================================\n');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
