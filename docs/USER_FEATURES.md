# 👥 User Features by Role

> Complete guide to what each role can do in the Academic Ops Platform.

---

## Table of Contents

- [Role Hierarchy Overview](#role-hierarchy-overview)
- [RBAC Permission Matrix](#rbac-permission-matrix)
- [Developer](#-developer)
- [Super Admin](#-super-admin)
- [COE (Controller of Examinations)](#-coe-controller-of-examinations)
- [Department Admin](#-department-admin)
- [Admissions Admin](#-admissions-admin)
- [Admin Clerk](#-admin-clerk)
- [First Year Coordinator](#-first-year-coordinator)
- [Clerk](#-clerk)
- [Teacher](#-teacher)
- [Student](#-student)
- [Parent](#-parent)
- [Approval Workflows](#approval-workflows)
- [Data Locking Rules](#data-locking-rules)

---

## Role Hierarchy Overview

```
                    ┌──────────────┐
                    │  DEVELOPER   │ ← Platform-level (above tenants)
                    └──────┬───────┘
                           │ creates tenants
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌─────────────────────────────────────────────┐
   │              TENANT BOUNDARY                 │
   │                                              │
   │   ┌──────────────┐                           │
   │   │ SUPER ADMIN  │ ← Full tenant control     │
   │   └──────┬───────┘                           │
   │          │                                    │
   │   ┌──────┴──────────────────┐                │
   │   ▼              ▼         ▼                 │
   │ ┌─────┐  ┌───────────┐  ┌──────────────┐    │
   │ │ COE │  │ DEPT ADMIN │  │ ADMISSIONS   │    │
   │ └──┬──┘  └─────┬─────┘  │ ADMIN        │    │
   │    │           │         └──────┬───────┘    │
   │    ▼           ▼                ▼            │
   │ ┌───────┐ ┌─────────┐   ┌─────────────┐    │
   │ │ CLERK │ │ TEACHER  │   │ ADMIN CLERK │    │
   │ └───────┘ └────┬─────┘   └─────────────┘    │
   │                │                              │
   │          ┌─────┴─────┐                       │
   │          ▼           ▼                       │
   │     ┌─────────┐ ┌────────┐                   │
   │     │ STUDENT │ │ PARENT │                   │
   │     └─────────┘ └────────┘                   │
   │                                              │
   │   ┌────────────────────────┐                 │
   │   │ FIRST YEAR COORDINATOR │ ← Specialised  │
   │   └────────────────────────┘                 │
   └──────────────────────────────────────────────┘
```

---

## RBAC Permission Matrix

Each cell shows allowed **Actions** and **Scope**:
- **C** = Create, **R** = Read, **U** = Update, **D** = Delete, **P** = Publish
- **OWN** = own records only, **ASN** = assigned records, **DEPT** = department-wide, **ALL** = tenant-wide

| Resource | Student | Teacher | Dept Admin | Super Admin | COE | Clerk | Admissions Admin | Admin Clerk | FYC | Parent |
|---|---|---|---|---|---|---|---|---|---|---|
| **User Profile** | RU/OWN | RU/OWN | CRUD/DEPT | CRUD/ALL | RU/OWN | RU/OWN | CRU/ALL | RU/OWN | RU/ASN | RU/OWN |
| **Department** | R/OWN | R/ASN | R/DEPT | CRUD/ALL | R/ALL | R/ALL | R/ALL | R/ALL | R/ALL | — |
| **Program** | R/OWN | R/ASN | R/DEPT | CRUD/ALL | R/ALL | — | R/ALL | R/ALL | — | — |
| **Course** | R/OWN | R/ASN | CRUD/DEPT | R/ALL | CRUD/ALL | R/ALL | R/ALL | — | R/ASN | — |
| **Semester** | — | — | R/DEPT | CRUD/ALL | R/ALL | — | R/ALL | — | R/ALL | — |
| **Subject** | R/OWN | R/ASN | CRUD/DEPT | CRUD/ALL | — | — | — | — | — | — |
| **Enrollment** | R/OWN | R/ASN | CRUD/DEPT | CRUD/ALL | — | — | — | — | — | — |
| **Assignment** | R/OWN | CRUD/ASN | R/DEPT | CRUD/ALL | — | — | — | — | — | — |
| **Submission** | CRU/OWN | RU/ASN | R/DEPT | RU/ALL | — | — | — | — | — | — |
| **Attendance** | R/OWN | CRU/ASN | RU/DEPT | CRUD/ALL | — | — | — | — | — | R/OWN |
| **Marks** | R/OWN | CRU/ASN | RP/DEPT | CRUDP/ALL | R/ALL | CRU/ASN | — | — | — | R/OWN |
| **Certificate** | R/OWN | R/ASN | CRU/DEPT | CRUD/ALL | — | — | — | — | — | — |
| **Notification** | RU/OWN | CR/ASN | CR/DEPT | CRUD/ALL | — | — | CR/ALL | R/OWN | CR/ASN | R/OWN |
| **Audit Log** | — | — | R/DEPT | R/ALL | R/ALL | — | R/ALL | — | R/ASN | — |

---

## 🔧 Developer

> **Platform-level super user** — operates above all tenants. Separate authentication flow from regular users.

**Dashboard**: `/dev/dashboard`

### Features

| Category | Feature | Description |
|---|---|---|
| **Tenant Management** | Create tenant | Provision new institutions with slug, type, name |
| | View all tenants | List every tenant with user counts, status |
| | Edit tenant | Update name, type, slug, user limits |
| | Activate / Deactivate | Enable or disable an entire institution |
| | Upload branding | Set tenant logo and login background image |
| **System Health** | Health dashboard | Real-time DB connectivity, Redis status, uptime, memory |
| | System stats | Aggregate metrics across all tenants |
| **Error Monitoring** | View system errors | Paginated list of all errors with stack traces |
| | Resolve errors | Mark errors as resolved (individually or bulk) |
| | Filter by severity | WARNING / ERROR classification |
| **Email Monitoring** | View email logs | All sent/failed/pending emails across tenants |
| | Email statistics | Delivery rates, failure analysis |
| | Retry failed emails | Re-queue failed emails for delivery |
| | Cleanup old logs | Purge delivered logs older than 30 days |

### Access Model

- **Login**: Separate endpoint (`/api/dev/login`)
- **Token**: Stored as `dev-token` in localStorage (separate from user token)
- **Database model**: `Developer` (not `User`) — completely isolated from tenant user base

---

## 🏛️ Super Admin

> **Institutional administrator** — manages the academic structure, users, and settings for one tenant.

**Dashboard**: `/dashboard/admin`

### Features

| Category | Feature | Description |
|---|---|---|
| **Departments** | CRUD | Create, edit, delete departments |
| | Cycle department flag | Mark departments for first-year PHY/CHEM cycle |
| **Programs** | CRUD | Create degree programs (B.Tech, M.Tech, MBA, etc.) |
| | Link to departments | Many-to-many department-program associations |
| | Duration config | Set program duration in years |
| **Batches** | CRUD | Create year-wise student cohorts |
| | Semester progression | Advance batch to next semester |
| | Graduation | Mark batch as graduated (locks all data) |
| | Batch → Department view | Drill into department-level batch details |
| **Semesters** | CRUD + Lifecycle | Create semesters with ACTIVE → CLOSED → ARCHIVED flow |
| | Open / Close / Archive | Control semester state transitions |
| **Sections** | CRUD | Create sections per department + batch |
| | Lock / Unlock | Lock sections after finalization |
| | Student assignment | Assign/remove students from sections |
| **Users** | Create all roles | Create Super Admin, COE, Dept Admin, Teachers, Students, Parents |
| | Bulk student upload | Import students via Excel/CSV |
| | Activation toggle | Activate/deactivate any user account |
| | View student details | Full student profile with academic history |
| **Courses** | Read only | View course catalogue (creation is COE-exclusive) |
| **COE Management** | Create COE user | Appoint Controller of Examinations |
| **Admissions Admin** | Create role | Appoint Admissions Administrator |
| **FY Coordinator** | Create role | Appoint First Year Coordinator |
| **Settings** | Tenant config | Manage institution-level settings |
| **Audit Logs** | Full access | View all audit logs across the tenant |
| **Edit Requests** | Review | Approve/reject edit requests from teachers and dept admins |

### Key Constraint

> ⚠️ **Super Admin CANNOT create or modify courses.** Course management is exclusively reserved for the COE role to enforce separation of duties.

---

## 📋 COE (Controller of Examinations)

> **Examination authority** — manages the course catalogue, semester marks, result finalization, and permanent USN assignments.

**Dashboard**: `/dashboard/coe`

### Features

| Category | Feature | Description |
|---|---|---|
| **Course Catalogue** | Create courses | Define courses with code, name, credits |
| | Configure marks split | Set internal/external marks ratio |
| | Lock courses | Lock course configuration after exam setup |
| | Delete courses | Remove courses (if no dependencies) |
| **Clerk Management** | Create clerks | Appoint data-entry clerks |
| | View clerks | List all assigned clerks |
| **Internal Marks** | View submissions | See department-submitted internal marks |
| | Cross-department view | Compare internal marks across departments |
| **Semester Marks** | Review uploads | Review clerk-uploaded semester-end marks |
| | Approve / Reject | Approve or reject marks with comments |
| | Post results | Publish approved marks to result engine |
| | Edit entries | Correct individual mark entries |
| **Results** | Finalize results | Calculate final results (internal + external) |
| | Pass/Fail determination | Automatic pass/fail based on thresholds |
| | Publish results | Make results visible to students |
| **Revaluations** | Review | Review revaluation requests from clerks |
| | Approve | Approve revaluation mark adjustments |
| **USN Assignment** | View awaiting students | List students awaiting permanent USN |
| | Assign permanent USN | Replace temporary with permanent University Seat Number |
| **Audit Logs** | Clerk logs | View audit logs of subordinate Clerks |

### Key Privileges

> 🔑 **COE and Clerk are the ONLY roles that can assign permanent USNs.** Admissions Admin can only assign temporary USNs.

---

## 🏢 Department Admin

> **Department head** — manages all academic operations within their department: teachers, students, courses, marks, mentorship, and timetables.

**Dashboard**: `/dashboard/dept-admin`

### Features

| Category | Feature | Description |
|---|---|---|
| **Teacher Management** | View teachers | List all teachers in department |
| | Assign to subjects | Map teachers to course sections |
| **Student Management** | View students | List all students in department |
| | Student profiles | Detailed student information |
| **Course Allocations** | Allocate courses | Map courses to sections for the semester |
| | Assign teachers | Assign teachers to allocated courses |
| | Remove allocations | Remove course-section-teacher mappings |
| **Sections** | CRUD | Create/manage department sections |
| | Student assignment | Assign students to sections |
| | View section details | Drill into section roster |
| **Assessment Configuration** | Configure IA | Set number of internals, max marks, best-of-N |
| | Component weights | Configure assignment/lab weightage |
| | Per-course config | Different IA config per course per semester |
| **Internal Marks** | View all marks | See marks across all teachers in department |
| | Edit marks | Correct internal marks entries |
| | Finalize marks | Lock marks for COE submission |
| | Submit to COE | Send finalized internal marks to COE |
| **Attendance** | View records | Department-wide attendance overview |
| | Semester marks view | Cross-sectional attendance summary |
| **Mentorship** | Assign mentors | Pair teachers with students for the semester |
| | Expire assignments | End mentor assignments |
| | Track progress | View mentor observation completion |
| | Mentor history | Historical mentor assignments |
| **Timetable** | Configure time slots | Set department-level period timings |
| | Upload timetable | Upload PDF/image timetable per section |
| | Manage timetables | View/update/delete uploaded timetables |
| **Chat Oversight** | View conversations | See parent-mentor conversations |
| | Respond to escalations | Handle chats escalated by parents or mentors |
| **Edit Requests** | Review | Approve/reject attendance and marks edit requests |
| **Audit Logs** | Teacher logs | View audit logs of Teachers within the department |

---

## 🎓 Admissions Admin

> **Admissions authority** — manages the entire admission pipeline: applications, form configuration, department closure, temporary USN assignment, and student account creation.

**Dashboard**: `/dashboard/admissions`

### Features

| Category | Feature | Description |
|---|---|---|
| **Dashboard** | Stats overview | Admission counts by status, department, program |
| **Applications** | View all | Paginated list with status filters |
| | Review details | Full application with personal, education, document details |
| | Submit for review | Move application through approval pipeline |
| | Approve / Reject | Final admission decision |
| | Edit application | Modify application details |
| | Print view | Printer-friendly application format |
| **New Admissions** | Manual entry | Create admission entry with full details |
| | Bulk upload | Import admissions via Excel with smart parsing |
| **Form Configuration** | Dynamic form builder | Configure admission form fields per tenant |
| | Logo upload | Set admission form branding |
| | Field management | Add/remove/reorder form fields |
| **Department Management** | Close admissions | Close department admissions (triggers temp USN allocation) |
| | Reopen admissions | Reopen department for additional admissions |
| **Students** | View admitted students | List all admitted students |
| | Edit student info | Update student details post-admission |
| | Branch change | Transfer student to different department/program |
| **Admin Clerks** | Create clerks | Appoint data-entry clerks for admissions |
| | View clerks | List all admission clerks |
| **Edit Requests** | Create requests | Propose student data changes |
| | Review requests | Approve/reject clerk-submitted edit requests |
| **USN Requests** | View requests | List permanent USN requests |
| | Process requests | Forward USN requests to COE |
| **Audit Logs** | Admin Clerk logs | View audit logs of subordinate Admin Clerks |

### Key Constraint

> ⚠️ **Admissions Admin can only assign TEMPORARY USNs** (auto-generated during department closure). Permanent USN assignment is restricted to COE and Clerk.

---

## 📝 Admin Clerk

> **Data entry assistant** under the Admissions Admin — handles admission form data entry and student edit proposals.

**Dashboard**: `/dashboard/admissions` (shared with Admissions Admin, restricted features)

### Features

| Category | Feature | Description |
|---|---|---|
| **Admissions** | Data entry | Enter new admission applications |
| | View applications | See assigned applications |
| | Edit applications | Update application details |
| **Student Edits** | Propose changes | Submit student data edit requests |
| | View own requests | Track status of submitted edit requests |

### Constraints

- **Cannot** approve/reject admissions
- **Cannot** close/reopen department admissions
- **Cannot** configure admission forms
- **Cannot** assign any USNs

---

## 📅 First Year Coordinator

> **Specialised role** for managing first-year student allocation to Physics/Chemistry cycle departments.

**Dashboard**: `/dashboard/first-year-coordinator`

### Features

| Category | Feature | Description |
|---|---|---|
| **Cycle Allocation** | Allocate students | Assign first-year students to PHY or CHEM cycle department |
| | View allocations | See current cycle department assignments |
| | Modify allocations | Change student cycle assignments |
| **Students** | View first-year students | List all first-year students across departments |
| **Audit Logs** | Cycle department logs | View audit logs from basic science (PHY/CHEM/MATH) departments |
| | Student details | View individual student information |

### Context

In Indian engineering colleges, first-year students rotate between Physics and Chemistry departments before joining their core branch in the second year. The FY Coordinator manages this assignment process.

---

## 📊 Clerk

> **Data entry operator** under the COE — enters semester-end examination marks and revaluation data.

**Dashboard**: `/dashboard/clerk`

### Features

| Category | Feature | Description |
|---|---|---|
| **Semester Marks** | Upload Excel | Upload semester-end marks via Excel file |
| | View uploads | Track upload status (PENDING → APPROVED → POSTED) |
| | View entries | See individual mark entries from uploads |
| **Submissions** | Track submissions | Monitor which courses have been submitted |
| | View status | Check approval status per submission |
| **Revaluations** | Enter marks | Input revaluation mark adjustments |
| | View history | Track revaluation submissions |

### Excel Upload Workflow

```
1. Clerk downloads template or uses existing format
2. Uploads Excel file for a specific course
3. System auto-detects columns (smart parser):
   ├─ USN column
   ├─ Marks columns
   └─ Self-learning corrections from past uploads
4. Clerk reviews parsed data, fixes any mismatches
5. Confirms and submits for COE approval
6. COE reviews → Approves/Rejects → Posts to results
```

---

## 👨‍🏫 Teacher

> **Faculty member** — marks attendance, enters internal marks, manages assignments, and mentors assigned students.

**Dashboard**: `/dashboard/teacher`

### Features

| Category | Feature | Description |
|---|---|---|
| **Dashboard** | Overview | Quick stats: allocated courses, attendance summary, pending tasks |
| **Courses** | View allocations | See all assigned course-section pairs |
| | Student roster | View students in each allocated section |
| **Attendance** | Mark attendance | Mark PRESENT / ABSENT / LATE / EXCUSED per session |
| | Bulk mark | Mark attendance for entire class |
| | View history | Date-wise and student-wise attendance records |
| | Submit attendance | Finalize attendance for the day |
| **Internal Marks** | Record marks | Enter internal assessment marks per student |
| | Bulk entry | Enter marks for entire class at once |
| | Submit marks | Finalize marks for mentor/admin review |
| | View history | Track marks across all internals (IA1, IA2, IA3) |
| **Edit Requests** | Request marks edit | Propose changes to locked marks with reason |
| | Request attendance edit | Propose changes to locked attendance |
| | View requests | Track status of own edit requests |
| **Subjects** | View details | Detailed subject information with enrolled students |
| **Timetable** | View timetable | See section-wise timetable |

### Mentorship Features

| Category | Feature | Description |
|---|---|---|
| **Mentor Dashboard** | Status overview | Mentee count, observation completion, pending approvals |
| | Mentor profile | View own mentor assignment details |
| **Students** | View mentees | List all assigned mentee students |
| | Student details | Full student profile with academic data |
| | Academic data | View mentee attendance, marks, courses |
| **Observations** | Create observation | Write mentor observation card |
| | | Aspects: personality, curricular, co-curricular, extra-curricular |
| | View observations | History of observations per student |
| **Student Interactions** | Log meeting | Record student meeting (personal, academic, career) |
| | View history | Track all student interaction logs |
| **Parent Interactions** | Log interaction | Record parent call/meeting (purpose, outcomes) |
| | View history | Track all parent interaction logs |
| **Marks Approval** | View pending | See internal marks awaiting mentor approval |
| | Approve marks | Approve internal marks for mentee students |
| | Reject marks | Reject with reason for teacher to revise |
| | Edit marks | Correct individual mark entries |
| **Chat** | View conversations | See conversations with parents of mentees |
| | Send messages | Respond to parent messages |
| | Escalate | Escalate conversation to Department Admin |
| | Resolve | Mark conversation as resolved |

---

## 🎒 Student

> **Read-only academic access** — views own attendance, marks, results, profile, and timetable.

**Dashboard**: `/dashboard/student`

### Features

| Category | Feature | Description |
|---|---|---|
| **Dashboard** | Overview | Quick stats: attendance %, GPA, enrolled courses |
| **Profile** | View profile | Personal details, USN, roll number, department, batch |
| | Edit profile | Update contact information (limited fields) |
| **Courses** | View enrolled | List of currently enrolled courses |
| **Subjects** | Subject details | Detailed view per subject with teacher info |
| **Attendance** | View attendance | Subject-wise attendance percentage |
| | Date-wise view | Calendar view of attendance records |
| **Internal Marks** | View IA marks | Internal assessment scores (IA1, IA2, IA3, assignments) |
| | Best-of-N | See calculated best-of-N internal marks |
| **Results** | View results | Semester-end results with pass/fail status |
| | Grade breakdown | Internal + external marks breakdown |
| **Academic History** | Full history | 4-year academic history across all semesters |
| | Previous semesters | Marks and results from past semesters |

### Login Methods

Students can login using:
1. **Email** — standard email/password
2. **Roll Number** — roll number/password (case-insensitive, auto-uppercased)
3. **Temporary USN** — temp USN as identifier (before permanent USN is assigned)

---

## 👨‍👩‍👧 Parent

> **Read-only access to child's academic data** — plus chat with assigned mentor.

**Dashboard**: `/dashboard/parent`

### Features

| Category | Feature | Description |
|---|---|---|
| **Dashboard** | Overview | Linked children summary, attendance alerts |
| **Student Data** | View child profile | Child's personal and academic information |
| | View attendance | Child's subject-wise attendance records |
| | View marks | Child's internal assessment marks |
| **Chat** | Start conversation | Initiate chat with child's assigned mentor |
| | Send messages | Communicate with mentor |
| | View conversations | History of all conversations |
| | Escalate | Escalate to Department Admin if needed |
| | Mark read | Clear unread message indicators |
| **Notifications** | SMS alerts | Receive SMS when child is marked absent (if enabled) |

### Access Model

- Parent account is linked to exactly **one StudentProfile**
- Access is scoped to their child's data only
- Cannot view other students' data
- Cannot modify any academic records

---

## Approval Workflows

The platform implements multiple **maker-checker** approval workflows to ensure data integrity:

### 1. Internal Marks Approval

```
Teacher enters marks
  │
  ▼
Teacher submits marks
  │
  ▼
Mentor reviews marks for mentees
  ├─ Approve → marks locked
  └─ Reject → teacher revises
  │
  ▼
Dept Admin reviews department marks
  ├─ Finalize → marks locked for department
  └─ Send back → teacher/mentor revises
  │
  ▼
Dept Admin submits to COE
  │
  ▼
COE receives final internal marks
```

### 2. Semester Marks Approval

```
Clerk uploads Excel file
  │
  ▼
System parses columns (auto-detection)
  │
  ▼
Clerk reviews + confirms parsed data
  │
  ▼
Clerk submits for approval
  │
  ▼
COE reviews submission
  ├─ Approve → marks accepted
  ├─ Reject → clerk re-uploads
  └─ Edit → COE corrects individual entries
  │
  ▼
COE posts results (internal + external → final)
```

### 3. Attendance Edit Request

```
Teacher requests edit (locked attendance)
  │ (includes reason, proposed changes)
  ▼
Dept Admin reviews request
  ├─ Approve → attendance record updated
  └─ Reject → no change
```

### 4. Admission Workflow

```
Admin Clerk / Admissions Admin enters application
  │
  ▼
Application submitted for review
  │
  ▼
Admissions Admin reviews
  ├─ Approve → student account created
  ├─ Reject → application archived
  └─ Request changes → applicant/clerk updates
  │
  ▼
Department closure → temporary USN assigned
  │
  ▼
COE assigns permanent USN (separate process)
```

### 5. Student Data Edit Request

```
Admin Clerk proposes student data change
  │ (includes field, old value, new value, reason)
  ▼
Admissions Admin reviews
  ├─ Approve → student record updated
  └─ Reject → no change
```

---

## Data Locking Rules

The platform enforces strict data immutability rules:

### Semester Lock

```
Batch progresses from Semester N to Semester N+1
  → All data for Semester N becomes READ-ONLY
  → EXCEPTIONS:
     ├─ Makeup exams
     ├─ Revaluations
     └─ Rewrites
     (these can modify locked semester data)
```

### Section Lock

```
Admin locks a section
  → Student roster becomes frozen
  → No students can be added/removed
  → Attendance and marks entry still allowed
```

### Course Lock

```
COE locks a course
  → Course details (name, code, credits) become frozen
  → Internal/external marks split cannot change
  → Marks can still be entered against the course
```

### Graduation Lock

```
Batch is marked as GRADUATED
  → ALL data for ALL semesters becomes READ-ONLY
  → No modifications allowed (no exceptions)
```

### Audit Log Immutability

```
Audit logs CANNOT be deleted — ever
  → Enforced at ORM level (Prisma client extension)
  → No code path can execute DELETE on AuditLog
  → Cleanup alert at 100k+ records
```
