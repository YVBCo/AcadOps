
import { prisma } from '../data-access/prisma.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ module: 'cleanup-db' });

async function main() {
    log.info('🧹 Starting FULL database cleanup...');

    try {
        // ── Phase 1: Chat & Messaging ──
        log.info('Phase 1: Clearing chat data...');
        await prisma.chatMessage.deleteMany({});
        await prisma.chatConversation.deleteMany({});

        // ── Phase 2: Audit, Logs & Notifications ──
        log.info('Phase 2: Clearing logs & notifications...');
        await prisma.auditLog.deleteMany({});
        await prisma.notification.deleteMany({});
        await prisma.emailLog.deleteMany({});
        await prisma.systemError.deleteMany({});
        await prisma.editRequest.deleteMany({});

        // ── Phase 3: COE & Marks ──
        log.info('Phase 3: Clearing marks & results...');
        await prisma.revaluation.deleteMany({});
        await prisma.result.deleteMany({});
        await prisma.parsingCorrection.deleteMany({});
        await prisma.semesterMarkEntry.deleteMany({});
        await prisma.semesterMarkUpload.deleteMany({});
        await prisma.semesterEndMarks.deleteMany({});
        await prisma.internalMarksDetail.deleteMany({});
        await prisma.internalAssessmentConfig.deleteMany({});
        await prisma.internalMarksSubmission.deleteMany({});
        await prisma.certificate.deleteMany({});
        await prisma.marks.deleteMany({});

        // ── Phase 4: Assignments & Attendance ──
        log.info('Phase 4: Clearing academic operations...');
        await prisma.submission.deleteMany({});
        await prisma.assignment.deleteMany({});
        await prisma.attendance.deleteMany({});
        await prisma.enrollment.deleteMany({});

        // ── Phase 5: Admissions ──
        log.info('Phase 5: Clearing admissions data...');
        await prisma.uSNRequest.deleteMany({});
        await prisma.studentEditRequest.deleteMany({});
        await prisma.admissionData.deleteMany({});
        await prisma.admissionFormConfig.deleteMany({});

        // ── Phase 6: Mentor & Cycle ──
        log.info('Phase 6: Clearing mentor & cycle assignments...');
        await prisma.mentorAssignment.deleteMany({});
        await prisma.cycleDepartmentAllocation.deleteMany({});
        await prisma.courseAllocation.deleteMany({});

        // ── Phase 7: Profiles ──
        log.info('Phase 7: Clearing profiles...');
        await prisma.parentProfile.deleteMany({});
        await prisma.studentProfile.deleteMany({});
        await prisma.teacherProfile.deleteMany({});

        // ── Phase 8: Academic Structure ──
        log.info('Phase 8: Clearing academic structure...');
        await prisma.subjectTeacher.deleteMany({});
        await prisma.subject.deleteMany({});
        await prisma.sectionTimetable.deleteMany({});
        await prisma.departmentTimeSlotConfig.deleteMany({});
        await prisma.section.deleteMany({});
        await prisma.course.deleteMany({});
        await prisma.semester.deleteMany({});
        await prisma.batch.deleteMany({});
        await prisma.program.deleteMany({});
        await prisma.department.deleteMany({});

        // ── Phase 9: Users ──
        log.info('Phase 9: Clearing users (keeping Super Admins)...');
        await prisma.passwordResetToken.deleteMany({});
        const deletedUsers = await prisma.user.deleteMany({
            where: {
                role: { not: 'SUPER_ADMIN' },
            },
        });

        // Clear department links from remaining Super Admins (departments are gone)
        await prisma.user.updateMany({
            where: { role: 'SUPER_ADMIN' },
            data: { departmentId: null },
        });

        log.info({ deletedUsers: deletedUsers.count }, '✅ Full database cleanup complete!');
        log.info('All data cleared. Super Admin accounts preserved.');

    } catch (error) {
        log.error({ err: error }, '❌ Error during cleanup');
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
