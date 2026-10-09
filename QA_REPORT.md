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

- Full page-by-page certification of every route is not complete. Live smoke checks covered Super Admin, HOD, COE, First Year Coordinator, Admissions Admin, and Student sessions in the testing tenant. Teacher and clerk accounts still need credentialed login checks.
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
- Admissions approval could not proceed because the API returned a generic duplicate-resource response. Admission-number allocation now checks both admissions and student-profile roll numbers before choosing the next ID. This fix has automated coverage; live approval should be retried after the API deployment.
- Added a Super Admin Academic Programs screen so a degree program can be created and linked to a department before section and teacher allocation.
- The Aadhaar field's original Required setting was restored and saved after synthetic-form testing. No synthetic applicant was approved and no parent account was generated during this test pass.
