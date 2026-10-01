export { prisma } from './prisma.js';
export { userRepository, type UserRepository, type CreateUserData, type UpdateUserData } from './user.repository.js';
export { departmentRepository, type DepartmentRepository, type CreateDepartmentData, type UpdateDepartmentData } from './department.repository.js';
export { semesterRepository, type SemesterRepository, type CreateSemesterData, type UpdateSemesterData } from './semester.repository.js';
export { auditLogRepository, type AuditLogRepository, type CreateAuditLogData } from './audit-log.repository.js';
export { programRepository, type ProgramRepository, type CreateProgramData, type UpdateProgramData } from './program.repository.js';
export { courseRepository, type CourseRepository, type CreateCourseData, type UpdateCourseData } from './course.repository.js';
export { subjectRepository, type SubjectRepository, type CreateSubjectData, type UpdateSubjectData } from './subject.repository.js';
export { editRequestRepository, type EditRequestRepository, type CreateEditRequestData } from './edit-request.repository.js';
export { sectionRepository, type SectionRepository, type CreateSectionData } from './section.repository.js';
export { batchRepository, type BatchRepository, type CreateBatchData, type UpdateBatchData } from './batch.repository.js';

// Department Admin repositories
export { internalAssessmentRepository, internalMarksDetailRepository } from './internal-assessment.repository.js';
export { departmentTimeSlotConfigRepository, sectionTimetableRepository } from './timetable.repository.js';
export { courseAllocationRepository } from './course-allocation.repository.js';

// Mentor repositories
export { mentorAssignmentRepository } from './mentor-assignment.repository.js';
