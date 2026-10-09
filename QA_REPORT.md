# ERP / No-Due / PlacePro QA Report

Date: 2026-10-09

## Fixes completed

- Department admins now enter through the department dashboard. Login routes DEPARTMENT_ADMIN to /dashboard/dept-admin; tenant context is saved and reused if an authenticated request expires.
- PlacePro company, job, drive, application, profile, and analytics queries now scope records to the active tenant and enforce company ownership where applicable.
- PlacePro UI requests now match the API/database fields. Company users can maintain their profile, post jobs, review applications, and upload a PDF CV. Administrators can approve jobs and schedule drives.
- Student profile saves, CV upload, and availability declaration now call working APIs. Placement statistics now return the fields used by the dashboards.
- No-Due queues now filter by the requested approval stage, scope HOD work to the admin's department, and include a principal approval queue.
- No-Due screens now use the database's actual clearance stages, student relationships, due fields, and statuses. Student status includes subject clearances; waived account/library dues no longer block clearance.
- No-Due due creation validates student ownership within the tenant. The student-specific enrollment endpoint is now restricted to teachers assigned to that enrollment or super admins.
- Added focused service tests for tenant scoping, job and CV eligibility, company ownership, selection-to-placement updates, no-due stage counts, and waived dues.

## Verification

- Production builds: client Next.js build and server TypeScript build passed.
- Lint: passed.
- Tests: 16 files passed, 117 tests passed.

## End-to-end limits

- Full page-by-page certification of every route is not complete. Live smoke checks covered Super Admin, HOD, COE, First Year Coordinator, Admissions Admin, Student, and Parent sessions in the testing tenant. Teacher and clerk role sign-ins still need their invitation credentials; the test teacher is present and assigned to QA101, and the COE clerk is present and active.
- The No-Due payment API currently creates internal orders but does not implement a configured payment provider or signature-verified payment callback. The inactive Pay Now control was removed so the UI does not imply that payment is complete.
- The checks cover core paths in ERP, No-Due, and PlacePro. They do not certify every page in the wider ERP.

## Department-admin login follow-up

- The API issues both access and refresh tokens, but the browser had only saved the access token and immediately cleared the session on any authenticated 401. Added refresh-token persistence, a shared refresh request for concurrent failures, and a single retry of the failed request. Failed refreshes still return to the tenant's login page.
- Department-admin role routing remains `/dashboard/dept-admin`; permission failures (403) are not treated as expired sessions.
- Follow-up checks: client lint, client and server TypeScript checks, production build, and server tests passed.
- Live sign-in succeeded for the supplied HOD account and the role dashboard loaded. Passwords are intentionally omitted from this report.

## Admissions and course workflow follow-up

- A course code of `1` is rejected by the server's 2–10 character code rule. A valid test course (`QA101`) was created, appeared in COE and HOD views, was locked by COE with the user's approval, and allocated to a test section by HOD.
- The test tenant initially had no non-cycle department, which left the required branch selector blank. A synthetic QA department was added in that test tenant; the branch then appeared in the admissions form. The form now explains the missing-branch condition instead of showing a blank required field.
- Admissions approval initially returned a generic duplicate-resource response. Admission-number allocation was changed to check globally unique IDs across all tenants, matching the global database constraints. The pushed Render API fix was verified live: the synthetic QA application was approved as `ADM0003`.
- Added a Super Admin Academic Programs screen so a degree program can be created and linked to a department before section and teacher allocation.
- The Aadhaar field's original Required setting was restored and saved after synthetic-form testing.

## Live end-to-end retest

- Re-ran the server suite after the FYC tenant-isolation change: 17 test files and 121 tests passed. The server TypeScript build passed.
- Closed admissions for the synthetic QA Computer Science department. The deployed service allocated `QACS001` and confirmed creation of one parent account. The generated student and parent accounts both signed in successfully; the parent dashboard showed the linked QA student, and its attendance and marks pages loaded their empty states correctly.
- The student submitted a synthetic No-Due clearance request successfully. The HOD approvals page loaded and correctly showed no requests at the HOD stage because the new request is still at faculty review. A complete multi-role clearance chain remains unverified.
- Student PlacePro landing, jobs, and profile pages loaded. The jobs view correctly showed an empty state because the testing tenant has no active jobs.
- HOD saw QA101 in the Chemistry course catalog, and teacher assignment succeeded for the existing QA Teacher. The QA student is in the separate QA Computer Science department, so QA101 is not that student's course. The student's profile currently has no program or section assignment; the test tenant needs a matching course and section assignment before that student can show enrolled courses.
- Super Admin Academic Terms shows the active QA Test Term 2026. Creating another term is disabled until the active term is closed; closing a term is separate from advancing Batch 2026 from Semester 1.
- The deployed FYC screen initially showed batches/departments from outside the testing tenant. The tenant-scoped fix is now live: after the Render service restarted on the pushed build, the FYC page shows only Batch 2026 and QA Computer Science from the testing tenant. Automated tenant-isolation tests pass.
- Teacher and clerk dashboard sign-ins remain unverified because their passwords were not included with the other test-role credentials.

## Extended live workflow sweep

- Reviewed the available Super Admin, HOD, COE, Admissions Admin, FYC, Student, and Parent dashboards in the testing tenant. Earlier route sweeps covered their linked pages and empty states, including sections, course allocation, marks/results, admissions, FYC cycle allocation, student records, parent attendance/marks, No-Due queues, audit logs, and PlacePro analytics.
- PlacePro was exercised end to end in the live testing tenant: created `QA E2E Test Company 2026-10-09`, posted `QA E2E Test Role (Testing Only)`, approved the job as HOD, then signed in as the QA student and applied. The student application page showed the APPLIED record; the HOD applications page showed the same record. Fixed the HOD table's `Unknown` student display, pushed it, and verified the live page now shows `QA Parent Workflow Student`.
- The live section-assignment dialog was empty, but claimed all students in the batch were already assigned. Corrected this to say no students are available for the current department and batch, pushed it, and verified the updated message live.
- Production client build passed after those UI fixes. GitHub Actions CI for commit `a2d3a25` passed. The server TypeScript build and 124 server tests passed; No-Due Super Admin queue and tenant-scoped FYC results were also verified after deployment.

## Remaining verification / constraints

- This is a broad live smoke and key-workflow test, not a claim that every button and every possible data permutation in every route is certified. Empty records prevent exercising student section allocation, class attendance entry, assessments/marks publication, timetables, and the full multi-role No-Due approval chain end to end.
- Teacher and clerk sign-ins have since been verified using the test accounts supplied by the user. The Teacher dashboard and its course, attendance, internal marks, mentorship, timetable, chat, and No-Due faculty pages load. The COE Clerk dashboard, semester marks, revaluation search, and submissions pages load. The Admissions Clerk dashboard, student list, and edit-request queue load. Empty data prevents exercising marks submission and attendance recording.
- Admissions Clerk live testing found that `/dashboard/admissions/new` could not load its form configuration because the read endpoint only allowed Admissions Admins, even though clerks are allowed to create admissions. The endpoint now allows Admissions Staff to read the form configuration; writes and logo uploads remain restricted to Admissions Admins. The form now shows a retryable error if configuration loading fails.
- The Admissions Clerk dashboard counted one admission while its Applications page showed zero; this discrepancy needs verification against current tenant data/API responses. The New Admission page was still stuck loading before the permission fix; post-deployment verification is pending. The company-user dashboard is also unverified because there is no PLACEMENT_COMPANY login; the HOD company/job creation and student application path did pass.
- No-Due payment cannot be completed without a configured payment provider and verified callback. FYC, admissions, and parent/student main paths were live-tested; service/payment provider behavior and every low-level control remain outside the verified scope.
- Commit `a2d3a25` is pushed to `main`, GitHub Actions CI passed, and both UI fixes were verified on the live Vercel app. Render's backend fixes had previously been pushed and live-verified. Local shell deployment checks remain blocked by restricted DNS; production verification was done in the browser.

## Clerk and Admissions Clerk live verification

- The supplied COE Clerk and Teacher accounts both signed in successfully. COE Clerk revaluation search correctly reports no published result for the test student; the submissions page exposes All, Pending, Approved, and Locked filters. The Teacher account sees its QA101 allocation, and empty student enrollment is explained in the marks and attendance screens. No empty marks were submitted.
- The supplied Admissions Clerk account signed in successfully. Its dashboard shows one admission and three approved students; the Students page lists Batch 2026 with three students, and the edit-request queue correctly shows no pending requests. The Applications page reported zero total despite the dashboard count of one; this is recorded as a live data/API discrepancy rather than treating the applications workflow as fully verified.
- Build verification after the form-config permission change: client production build and server TypeScript build passed. Server tests passed: 17 files, 124 tests. The build reports the pre-existing duplicate-lockfile root warning. Deployment and live post-fix verification are pending.
