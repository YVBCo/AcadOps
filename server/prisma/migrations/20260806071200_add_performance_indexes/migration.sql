-- Performance indexes added based on query audit
-- These indexes cover the most frequently queried patterns that were doing full table scans

-- StudentProfile: admission dashboard queries
CREATE INDEX IF NOT EXISTS "student_profiles_optedDepartmentId_temporaryUsn_idx" ON "student_profiles" ("opted_department_id", "temporary_usn");
CREATE INDEX IF NOT EXISTS "student_profiles_sectionId_currentSemester_idx" ON "student_profiles" ("section_id", "current_semester");

-- Attendance: student dashboard attendance status queries
CREATE INDEX IF NOT EXISTS "attendances_studentId_status_idx" ON "attendances" ("student_id", "status");

-- Result: student results page filtered by USN + published status
CREATE INDEX IF NOT EXISTS "results_studentUsn_isPublished_idx" ON "results" ("student_usn", "is_published");

-- MentorAssignment: parent dashboard mentor lookup
CREATE INDEX IF NOT EXISTS "mentor_assignments_studentProfileId_isActive_idx" ON "mentor_assignments" ("student_profile_id", "is_active");

-- ChatMessage: unread message count per conversation
CREATE INDEX IF NOT EXISTS "chat_messages_conversationId_isRead_senderUserId_idx" ON "chat_messages" ("conversation_id", "is_read", "sender_user_id");
