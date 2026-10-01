-- CreateIndex
CREATE INDEX "batches_name_idx" ON "batches"("name");

-- CreateIndex
CREATE INDEX "batches_current_semester_is_graduated_idx" ON "batches"("current_semester", "is_graduated");

-- CreateIndex
CREATE INDEX "batches_start_year_idx" ON "batches"("start_year");

-- CreateIndex
CREATE INDEX "course_allocations_section_id_semester_number_idx" ON "course_allocations"("section_id", "semester_number");

-- CreateIndex
CREATE INDEX "course_allocations_teacher_id_idx" ON "course_allocations"("teacher_id");

-- CreateIndex
CREATE INDEX "course_allocations_course_id_idx" ON "course_allocations"("course_id");

-- CreateIndex
CREATE INDEX "courses_code_idx" ON "courses"("code");

-- CreateIndex
CREATE INDEX "courses_department_id_semester_number_idx" ON "courses"("department_id", "semester_number");

-- CreateIndex
CREATE INDEX "courses_program_id_semester_number_idx" ON "courses"("program_id", "semester_number");

-- CreateIndex
CREATE INDEX "courses_is_locked_idx" ON "courses"("is_locked");

-- CreateIndex
CREATE INDEX "internal_marks_details_batch_id_course_id_idx" ON "internal_marks_details"("batch_id", "course_id");

-- CreateIndex
CREATE INDEX "internal_marks_details_section_id_course_id_idx" ON "internal_marks_details"("section_id", "course_id");

-- CreateIndex
CREATE INDEX "internal_marks_details_student_usn_batch_id_idx" ON "internal_marks_details"("student_usn", "batch_id");

-- CreateIndex
CREATE INDEX "internal_marks_details_is_finalized_idx" ON "internal_marks_details"("is_finalized");

-- CreateIndex
CREATE INDEX "sections_department_id_batch_id_idx" ON "sections"("department_id", "batch_id");

-- CreateIndex
CREATE INDEX "sections_batch_id_is_locked_idx" ON "sections"("batch_id", "is_locked");

-- CreateIndex
CREATE INDEX "semester_end_marks_department_id_batch_id_course_id_idx" ON "semester_end_marks"("department_id", "batch_id", "course_id");

-- CreateIndex
CREATE INDEX "semester_end_marks_student_usn_idx" ON "semester_end_marks"("student_usn");

-- CreateIndex
CREATE INDEX "semesters_status_idx" ON "semesters"("status");

-- CreateIndex
CREATE INDEX "semesters_start_date_idx" ON "semesters"("start_date");

-- CreateIndex
CREATE INDEX "semesters_end_date_idx" ON "semesters"("end_date");

-- CreateIndex
CREATE INDEX "student_profiles_roll_number_idx" ON "student_profiles"("roll_number");

-- CreateIndex
CREATE INDEX "student_profiles_admission_year_current_semester_idx" ON "student_profiles"("admission_year", "current_semester");

-- CreateIndex
CREATE INDEX "student_profiles_batch_id_section_id_idx" ON "student_profiles"("batch_id", "section_id");

-- CreateIndex
CREATE INDEX "student_profiles_permanent_usn_idx" ON "student_profiles"("permanent_usn");

-- CreateIndex
CREATE INDEX "student_profiles_temporary_usn_idx" ON "student_profiles"("temporary_usn");

-- CreateIndex
CREATE INDEX "student_profiles_cycle_department_id_idx" ON "student_profiles"("cycle_department_id");

-- CreateIndex
CREATE INDEX "student_profiles_opted_department_id_idx" ON "student_profiles"("opted_department_id");

-- CreateIndex
CREATE INDEX "student_profiles_admission_id_idx" ON "student_profiles"("admission_id");

-- CreateIndex
CREATE INDEX "users_email_is_active_idx" ON "users"("email", "is_active");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE INDEX "users_department_id_role_idx" ON "users"("department_id", "role");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");
