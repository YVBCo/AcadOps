export { authService, type RegisterData, type LoginData, type JwtPayload, type AuthResult } from './auth.service.js';
export { departmentService } from './department.service.js';
export { semesterService } from './semester.service.js';
export { userService } from './user.service.js';
export { courseService } from './course.service.js';
export { subjectService } from './subject.service.js';
export { emailService } from './email.service.js';
export { editRequestService } from './edit-request.service.js';
export { sectionService } from './section.service.js';
export { batchService } from './batch.service.js';
export { semesterProgressionService } from './semester-progression.service.js';

// Department Admin services
export { internalAssessmentService } from './internal-assessment.service.js';
export { timetableService } from './timetable.service.js';
export { deptAdminService } from './dept-admin.service.js';

// Teacher service (modularized)
export { teacherService, teacherMarksService, teacherAttendanceService } from './teacher/index.js';

// Student service
export { studentService } from './student.service.js';

// Mentor service (modularized)
export { mentorService, mentorAssignmentService, mentorDashboardService } from './mentor/index.js';

// Admissions services (modularized)
export {
    admissionsService,
    admissionCoreService,
    admissionUsnService,
    admissionBulkService,
    admissionQueryService,
} from './admissions/index.js';
export { usnRequestService } from './usn-request.service.js';

// SMS service
export { smsService } from './sms.service.js';
