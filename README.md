# 🎓 Academic Ops Platform

> **Governance-first, multi-tenant academic operations system for engineering colleges.**

A full-stack platform that digitises the complete academic lifecycle — from student admissions through internal assessments, semester examinations, mentorship tracking, and result publication — with strict role-based access, immutable audit logging, and multi-tenant isolation.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [User Roles & RBAC](#user-roles--rbac)
- [Feature Modules](#feature-modules)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Local Development](#local-development)
  - [Docker Compose](#docker-compose)
  - [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Deployment](#deployment)
  - [Render (Backend)](#render-backend)
  - [Netlify (Frontend)](#netlify-frontend)
  - [Docker Production](#docker-production)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Security](#security)
- [License](#license)

---

## Overview

Academic Ops is an **Engineering College ERP** designed to replace spreadsheet-driven academic workflows with a secure, auditable, real-time system. It serves **10 distinct user roles** across multiple institutions (tenants), each with tightly scoped permissions.

### Key Design Principles

| Principle | Implementation |
|---|---|
| **Multi-Tenancy** | Full data isolation per institution via `tenantId` scoping |
| **Governance-First** | Immutable audit logs, edit-request approval workflows, semester locking |
| **Role-Based Access** | 10 roles with granular RBAC matrix (OWN / ASSIGNED / DEPARTMENT / ALL scopes) |
| **Separation of Duties** | Clerks enter data → COE approves → Admin publishes |
| **Zero-Trust** | JWT access + refresh tokens, Argon2 hashing, XSS sanitisation, rate limiting |

---

## Architecture

```
┌─────────────────────────────┐       ┌─────────────────────────────┐
│       Next.js 16 Client     │       │      Express 5 Server       │
│   (React 19 + TailwindCSS)  │◄─────►│     (TypeScript + Prisma)   │
│       Port 3001              │  API  │       Port 4000             │
└─────────────────────────────┘       └──────────┬──────────────────┘
                                                  │
                                    ┌─────────────┼─────────────┐
                                    ▼             ▼             ▼
                              ┌──────────┐ ┌──────────┐ ┌──────────┐
                              │PostgreSQL│ │  Redis   │ │S3 / Local│
                              │   16     │ │    7     │ │ Storage  │
                              │(Supabase)│ │(Upstash) │ │          │
                              └──────────┘ └──────────┘ └──────────┘
```

### Monorepo Structure

The project uses **npm workspaces** with two packages:

| Workspace | Description |
|---|---|
| `client/` | Next.js 16 frontend (React 19, Tailwind CSS 4, Zustand, TanStack Query) |
| `server/` | Express 5 backend (Prisma 7, Zod, BullMQ, Pino) |

---

## Tech Stack

### Frontend (`client/`)

| Technology | Version | Purpose |
|---|---|---|
| [Next.js](https://nextjs.org) | 16.1.6 | React framework with SSR, app router |
| [React](https://react.dev) | 19.2.x | UI library |
| [Tailwind CSS](https://tailwindcss.com) | 4.2.x | Utility-first CSS framework |
| [Zustand](https://zustand-demo.pmnd.rs) | 5.x | Lightweight state management (auth store) |
| [TanStack Query](https://tanstack.com/query) | 5.x | Server-state caching, mutations, pagination |
| [Axios](https://axios-http.com) | 1.x | HTTP client with interceptors |
| [Lucide React](https://lucide.dev) | 0.577 | Icon library |
| [Sonner](https://sonner.emilkowal.dev) | 2.x | Toast notifications |
| [clsx](https://github.com/lukeed/clsx) + [tailwind-merge](https://github.com/dcastil/tailwind-merge) | — | Conditional class merging |

### Backend (`server/`)

| Technology | Version | Purpose |
|---|---|---|
| [Express](https://expressjs.com) | 5.2.x | HTTP server framework |
| [Prisma](https://www.prisma.io) | 7.4.x | Type-safe ORM + migrations |
| [PostgreSQL](https://www.postgresql.org) | 16 | Primary database |
| [Redis](https://redis.io) / [ioredis](https://github.com/redis/ioredis) | 7 / 5.x | Caching, rate limiting, email queue |
| [Zod](https://zod.dev) | 4.x | Runtime schema validation |
| [Argon2](https://github.com/ranisalt/node-argon2) | 0.44 | Password hashing |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | 9.x | JWT access/refresh tokens |
| [BullMQ](https://bullmq.io) | 5.x | Background job queue (email delivery) |
| [Nodemailer](https://nodemailer.com) | 8.x | SMTP email transport |
| [ExcelJS](https://github.com/exceljs/exceljs) | 4.x | Excel parsing (marks upload) |
| [Multer](https://github.com/expressjs/multer) | 2.x | File upload handling |
| [AWS SDK (S3)](https://aws.amazon.com/sdk-for-javascript/) | 3.x | S3-compatible object storage |
| [Helmet](https://helmetjs.github.io) | 8.x | HTTP security headers |
| [Pino](https://getpino.io) | 10.x | Structured JSON logging |
| [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) + [rate-limit-redis](https://github.com/express-rate-limit/rate-limit-redis) | 8.x / 4.x | Rate limiting (Redis-backed in production) |
| [Swagger UI Express](https://github.com/scottie1984/swagger-ui-express) | 5.x | API documentation (dev only) |
| [XSS](https://github.com/leizongmin/js-xss) | 1.x | Input sanitisation |
| [Vitest](https://vitest.dev) | 4.x | Unit & integration testing |

### Infrastructure

| Tool | Purpose |
|---|---|
| Docker + Docker Compose | Local & production containerisation |
| PgBouncer | Connection pooling (transaction mode) |
| GitHub Actions | CI pipeline (lint → build → test) |
| Render | Backend deployment (API + auto-migrations) |
| Netlify | Frontend deployment (SSR via @netlify/plugin-nextjs) |
| Supabase | Managed PostgreSQL (Supavisor pooling) |
| Upstash | Managed Redis |
| Fast2SMS | SMS notifications to parents (optional) |
| Brevo | HTTP email API (cloud alternative to SMTP) |

---

## User Roles & RBAC

The platform implements a strict **10-role hierarchy** with granular, scoped permissions:

| Role | Scope | Key Responsibilities |
|---|---|---|
| **Developer** | Global (above tenants) | Tenant provisioning, system monitoring, error tracking |
| **Super Admin** | All (within tenant) | User management, departments, programs, batches, semesters |
| **COE** (Controller of Examinations) | All | Course catalogue, marks approval, results finalization, permanent USN assignment |
| **Department Admin** | Department | Teacher/student management, course allocation, internal assessment config, timetable, mentorship, attendance/marks oversight |
| **Admissions Admin** | All | Admission entries, form configuration, department closure, temporary USN allocation |
| **Admin Clerk** | Limited | Admission data entry under Admissions Admin supervision |
| **Clerk** | Assigned | Semester-end marks entry, revaluation data entry (under COE) |
| **First Year Coordinator** | Assigned | Physics/Chemistry cycle allocation for first-year students |
| **Teacher** | Assigned subjects | Attendance marking, internal marks entry, assignment management, mentor observations |
| **Student** | Own data | View attendance, marks, results, timetable, profile |
| **Parent** | Own child | View child's attendance, marks; chat with mentor |

### Permission Scopes

- **OWN** — Can only access their own records
- **ASSIGNED** — Can access records for subjects/students assigned to them
- **DEPARTMENT** — Can access all records within their department
- **ALL** — Can access all records within the tenant

---

## Feature Modules

### 🏛️ Multi-Tenancy & Developer Portal

- Institution (tenant) provisioning with slug-based routing
- Configurable tenant type (Engineering, Medical, MBA, Law, etc.)
- Per-tenant user limits, branding (logo, login background)
- Developer dashboard with system error tracking and email logs
- Cross-tenant analytics

### 👤 Authentication & User Management

- JWT access + refresh token flow (15m access / 7d refresh)
- Argon2 password hashing with strength validation
- Account lockout after failed attempts
- Token version tracking for forced logout
- Password reset via email (SHA-256 hashed tokens)
- Role-based user creation (bulk & individual)
- Profile management per role type

### 🎓 Academic Structure

- **Departments** — with cycle department support (PHY/CHEM for first year)
- **Programs** — many-to-many with departments, configurable duration
- **Courses** — catalogue with internal/external marks split, lockable
- **Batches** — year-wise cohorts with semester progression & graduation
- **Semesters** — lifecycle management (ACTIVE → CLOSED → ARCHIVED)
- **Sections** — department + batch scoped, lockable after finalization
- **Subjects** — course instances per semester with teacher assignments

### 📝 Attendance Management

- Teacher marks attendance (PRESENT / ABSENT / LATE / EXCUSED)
- Department Admin can lock attendance records
- Edit request workflow (teacher → admin approval)
- Student & parent read-only access
- Date-wise and subject-wise tracking

### 📊 Internal Assessment System

- **Configurable assessments** — number of internals, max marks, best-of-N
- **Component types** — Internals, Assignments, Labs (with weightage)
- **Per-course configuration** per semester
- **Detailed breakdown** — individual internal scores before finalization
- **Mentor approval workflow** — Teacher submits → Mentor reviews → Admin finalizes
- **Auto-calculation** — best-of-N selection + weighted total

### 📋 Semester Examination (COE Workflow)

- **Course catalogue management** — COE creates/locks courses
- **Marks entry** — Clerk uploads semester-end marks via Excel
- **Excel parsing** — Smart column detection with self-learning corrections
- **Approval pipeline** — Clerk uploads → COE reviews → COE posts
- **Result finalization** — Internal + External marks → Pass/Fail/Makeup
- **Revaluation** — Clerk enters → COE approves

### 🎒 Admissions System

- **Dynamic form builder** — Configurable admission form fields per tenant
- **Multi-page application** — Personal details, education, documents, declarations
- **Admission workflow** — Clerk enters → Admin reviews → Approve/Reject
- **Department closure** — triggers automatic temporary USN allocation
- **Student account creation** — approved admissions become student profiles
- **Lateral entry support**
- **USN management** — Temporary USN (department-scoped) → Permanent USN (COE assigns)
- **Public application portal** — slug-based public forms (`/apply/[slug]`)
- **Student edit requests** — Clerk proposes changes → Admin approves

### 👨‍🏫 Mentorship System

- **Semester-based assignments** — one mentor per student per semester
- **Mentor observation cards** — personality, curricular, co-curricular, extra-curricular
- **Student interaction logs** — meeting records (personal, academic, career aspects)
- **Parent interaction logs** — call/meeting records with purpose tracking
- **Overall assessment** — Satisfactory / Moderate / Needs Improvement
- **Mentor marks approval** — mentors review internal marks for their mentees

### 💬 Parent-Mentor Chat

- **Real-time messaging** between parents and assigned mentors
- **Conversation management** — ACTIVE / RESOLVED / ARCHIVED
- **Escalation support** — escalate to Department Admin
- **Read tracking** — unread message indicators
- **Student-linked** — each conversation tied to a specific student

### 🗓️ Timetable Management

- Department-level time slot configuration
- Section-wise timetable upload (PDF/image)
- Semester-scoped with active tracking

### 📧 Email & SMS Notifications

- **Multi-provider email** — SMTP (Gmail), Brevo (HTTP API), console logging fallback
- **BullMQ queue** — background email delivery with retries
- **Email logging** — full delivery tracking (PENDING / SENT / FAILED)
- **SMS notifications** — Fast2SMS integration for parent absence alerts
- **Welcome emails** — on user creation
- **Password reset emails** — secure token-based flow

### 🔍 Audit & Governance

- **Immutable audit logs** — every state change recorded with actor, IP, user agent
- **Old/new value diff** — complete change history
- **100k+ record monitoring** — alerts when audit table needs archival
- **Periodic cleanup** — expired tokens, old email logs, resolved errors (6-hour cycle)

### ⚡ Performance & Caching

- **Redis caching** — with auto-fallback to in-memory when Redis unavailable
- **Response compression** — ~70% bandwidth reduction
- **PgBouncer** — connection pooling for database connections
- **Database indexes** — 50+ strategic indexes across all tables
- **Pagination** — all list queries are paginated

---

## Database Schema

The Prisma schema defines **40+ models** organized into these domains:

### Core Models

| Model | Description |
|---|---|
| `Developer` | Super-admin above all tenants |
| `Tenant` | Institution/college entity |
| `User` | All users with role-based access |
| `StudentProfile` | Student-specific data (roll number, USN, admission year) |
| `TeacherProfile` | Teacher-specific data (employee ID, designation) |
| `ParentProfile` | Parent linked to a student |

### Academic Structure

| Model | Description |
|---|---|
| `Department` | Academic departments (with cycle department flag) |
| `Program` | Degree programs (B.Tech, M.Tech, etc.) |
| `Course` | Course catalogue with internal/external marks config |
| `Batch` | Year-wise student cohorts with semester progression |
| `Semester` | Academic periods with lifecycle status |
| `Section` | Student sections within department + batch |
| `Subject` | Course instance in a specific semester |
| `SubjectTeacher` | Teacher assignments to subjects |
| `Enrollment` | Student-subject enrollment records |

### Operations

| Model | Description |
|---|---|
| `Attendance` | Daily attendance records per student per subject |
| `Assignment` | Assignments with due dates and max scores |
| `Submission` | Student assignment submissions |
| `Marks` | Exam marks (Midterm, Final, Quiz, Practical, Internal) |
| `Certificate` | Student certificates (Bonafide, Completion, etc.) |

### Assessment & Results

| Model | Description |
|---|---|
| `InternalAssessmentConfig` | Per-course assessment configuration |
| `InternalMarksDetail` | Detailed internal marks with mentor approval |
| `InternalMarksSubmission` | Finalized internal marks for COE |
| `SemesterEndMarks` | Semester exam marks (Clerk → COE approval) |
| `SemesterMarkUpload` | Excel upload tracking |
| `SemesterMarkEntry` | Individual marks from uploads |
| `ParsingCorrection` | Self-learning Excel parsing corrections |
| `Result` | Final calculated results |
| `Revaluation` | Re-examination mark adjustments |
| `CourseAllocation` | Course → Section → Teacher allocation |

### Mentorship

| Model | Description |
|---|---|
| `MentorAssignment` | Semester-based mentor-student pairings |
| `MentorObservation` | Mentor assessment cards |
| `MentorStudentInteraction` | Student meeting logs |
| `MentorParentInteraction` | Parent interaction logs |

### Admissions

| Model | Description |
|---|---|
| `AdmissionData` | Full admission records (personal, education, documents) |
| `AdmissionFormConfig` | Dynamic form configuration per tenant |
| `USNRequest` | Permanent USN assignment requests |
| `StudentEditRequest` | Student data edit proposals |
| `CycleDepartmentAllocation` | First-year cycle department assignments |

### Communication & Audit

| Model | Description |
|---|---|
| `ChatConversation` | Parent-mentor conversations with escalation |
| `ChatMessage` | Individual chat messages |
| `Notification` | In-app notifications |
| `AuditLog` | Immutable change tracking |
| `EditRequest` | Attendance/marks edit approval workflow |
| `EmailLog` | Email delivery tracking |
| `SystemError` | Error monitoring for developer dashboard |
| `PasswordResetToken` | Secure password reset tokens |
| `DepartmentTimeSlotConfig` | Timetable time slot settings |
| `SectionTimetable` | Uploaded timetable files |

---

## Project Structure

```
academic-ops-platform/
├── .github/
│   └── workflows/
│       └── ci.yml                    # GitHub Actions CI pipeline
├── client/                           # ── Next.js Frontend ──────────
│   ├── src/
│   │   ├── app/                      # App Router pages
│   │   │   ├── layout.tsx            # Root layout
│   │   │   ├── page.tsx              # Landing page (/)
│   │   │   ├── login/                # Authentication page
│   │   │   ├── apply/                # Public admission portal
│   │   │   │   └── [slug]/           # Tenant-specific application form
│   │   │   ├── dev/                  # Developer portal
│   │   │   │   ├── login/            # Developer login
│   │   │   │   └── dashboard/        # Tenant management
│   │   │   └── dashboard/            # Role-based dashboards
│   │   │       ├── admin/            # Super Admin dashboard
│   │   │       │   ├── admissions-admin/  # Admissions management
│   │   │       │   ├── audit-logs/        # Audit log viewer
│   │   │       │   ├── batches/           # Batch management
│   │   │       │   ├── coe/               # COE management
│   │   │       │   ├── courses/           # Course catalogue
│   │   │       │   ├── departments/       # Department management
│   │   │       │   ├── edit-requests/     # Edit request reviews
│   │   │       │   ├── first-year-coordinator/  # FY coordinator
│   │   │       │   ├── programs/          # Program management
│   │   │       │   ├── sections/          # Section management
│   │   │       │   ├── semesters/         # Semester lifecycle
│   │   │       │   ├── settings/          # Tenant settings
│   │   │       │   ├── students/          # Student management
│   │   │       │   └── users/             # User management
│   │   │       ├── teacher/          # Teacher dashboard
│   │   │       │   ├── attendance/        # Mark attendance
│   │   │       │   ├── chat/              # Parent-mentor chat
│   │   │       │   ├── courses/           # Assigned courses
│   │   │       │   ├── internal-marks/    # Enter internal marks
│   │   │       │   ├── mentorship/        # Mentor observations
│   │   │       │   └── subjects/          # Subject management
│   │   │       ├── student/          # Student dashboard
│   │   │       │   ├── attendance/        # View attendance
│   │   │       │   ├── courses/           # Enrolled courses
│   │   │       │   ├── history/           # Academic history
│   │   │       │   ├── internal-marks/    # View IA marks
│   │   │       │   ├── profile/           # Student profile
│   │   │       │   ├── results/           # View results
│   │   │       │   └── subjects/          # Current subjects
│   │   │       ├── dept-admin/       # Department Admin dashboard
│   │   │       │   ├── allocations/       # Course allocations
│   │   │       │   ├── assessment-config/ # IA configuration
│   │   │       │   ├── attendance/        # Attendance oversight
│   │   │       │   ├── audit-logs/        # Department audit logs
│   │   │       │   ├── chat/              # Chat oversight
│   │   │       │   ├── courses/           # Department courses
│   │   │       │   ├── edit-requests/     # Edit request reviews
│   │   │       │   ├── internal-marks/    # IA marks management
│   │   │       │   ├── mentor-tracking/   # Mentor progress
│   │   │       │   ├── mentors/           # Mentor assignments
│   │   │       │   ├── sections/          # Section management
│   │   │       │   ├── students/          # Department students
│   │   │       │   ├── teachers/          # Department teachers
│   │   │       │   └── timetable/         # Timetable upload
│   │   │       ├── coe/              # COE dashboard
│   │   │       │   ├── clerks/            # Manage clerks
│   │   │       │   ├── courses/           # Course catalogue
│   │   │       │   ├── internal-marks/    # View internal marks
│   │   │       │   ├── results/           # Result finalization
│   │   │       │   ├── revaluations/      # Revaluation mgmt
│   │   │       │   └── semester-marks/    # Semester marks approval
│   │   │       ├── clerk/            # Clerk dashboard
│   │   │       │   ├── revaluations/      # Enter revaluations
│   │   │       │   ├── semester-marks/    # Upload semester marks
│   │   │       │   └── submissions/       # Track submissions
│   │   │       ├── admissions/       # Admissions Admin dashboard
│   │   │       │   ├── applications/      # Review applications
│   │   │       │   ├── clerks/            # Manage admin clerks
│   │   │       │   ├── edit-requests/     # Student edit requests
│   │   │       │   ├── form-config/       # Form builder
│   │   │       │   ├── new/               # New admission entry
│   │   │       │   ├── students/          # Admitted students
│   │   │       │   └── usn-requests/      # USN requests
│   │   │       ├── parent/           # Parent dashboard
│   │   │       │   ├── attendance/        # Child's attendance
│   │   │       │   ├── chat/              # Chat with mentor
│   │   │       │   └── marks/             # Child's marks
│   │   │       └── first-year-coordinator/  # FY Coordinator
│   │   │           ├── cycle-allocation/  # PHY/CHEM allocation
│   │   │           └── students/          # First-year students
│   │   ├── components/               # Reusable UI components
│   │   │   ├── ui/                   # Design system primitives
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   └── tabs.tsx
│   │   │   ├── layout/              # Layout components
│   │   │   │   ├── DashboardShell.tsx    # Sidebar + content shell
│   │   │   │   ├── DashStat.tsx          # Dashboard stat cards
│   │   │   │   └── QuickActionCard.tsx   # Quick action tiles
│   │   │   ├── admin/               # Admin-specific components
│   │   │   ├── clerk/               # Clerk-specific components
│   │   │   ├── coe/                 # COE-specific components
│   │   │   ├── first-year-coordinator/  # FY coordinator components
│   │   │   ├── providers.tsx        # React Query + Auth providers
│   │   │   └── SemesterSelectionDialog.tsx
│   │   └── lib/                     # Shared utilities
│   │       ├── api.ts               # Axios client + all API functions
│   │       ├── auth-store.ts        # Zustand auth state
│   │       ├── config.ts            # App configuration
│   │       └── utils.ts             # Helper utilities
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   ├── postcss.config.mjs
│   └── package.json
├── server/                           # ── Express Backend ───────────
│   ├── src/
│   │   ├── index.ts                 # Server entry point
│   │   ├── api/
│   │   │   ├── routes/              # 29 route modules
│   │   │   │   ├── index.ts             # Route aggregator
│   │   │   │   ├── auth.routes.ts       # Login, register, refresh, reset
│   │   │   │   ├── user.routes.ts       # User CRUD
│   │   │   │   ├── student.routes.ts    # Student operations
│   │   │   │   ├── teacher.routes.ts    # Teacher operations
│   │   │   │   ├── department.routes.ts # Department CRUD
│   │   │   │   ├── program.routes.ts    # Program CRUD
│   │   │   │   ├── course.routes.ts     # Course catalogue
│   │   │   │   ├── batch.routes.ts      # Batch management
│   │   │   │   ├── semester.routes.ts   # Semester lifecycle
│   │   │   │   ├── section.routes.ts    # Section management
│   │   │   │   ├── subject.routes.ts    # Subject instances
│   │   │   │   ├── attendance.routes.ts # Attendance marking
│   │   │   │   ├── assignment.routes.ts # Assignments
│   │   │   │   ├── marks.routes.ts      # Marks management
│   │   │   │   ├── coe.routes.ts        # COE-specific routes
│   │   │   │   ├── clerk.routes.ts      # Clerk operations
│   │   │   │   ├── clerk-marks.routes.ts  # Clerk marks entry
│   │   │   │   ├── semester-marks.routes.ts  # Semester marks upload
│   │   │   │   ├── results.routes.ts    # Result finalization
│   │   │   │   ├── revaluations.routes.ts   # Revaluations
│   │   │   │   ├── admissions.routes.ts # Admissions system
│   │   │   │   ├── edit-request.routes.ts   # Edit requests
│   │   │   │   ├── chat.routes.ts       # Parent-mentor chat
│   │   │   │   ├── parent.routes.ts     # Parent operations
│   │   │   │   ├── audit-logs.routes.ts # Audit log queries
│   │   │   │   ├── developer.routes.ts  # Developer portal
│   │   │   │   ├── usn-request.routes.ts # USN management
│   │   │   │   ├── first-year-coordinator.routes.ts  # FY coordinator
│   │   │   │   └── dept-admin/          # Dept admin sub-routes
│   │   │   ├── middleware/          # Express middleware
│   │   │   │   ├── auth.middleware.ts        # JWT authentication
│   │   │   │   ├── cache.middleware.ts       # Response caching
│   │   │   │   ├── error.middleware.ts       # Error handler
│   │   │   │   ├── rate-limiters.ts         # Endpoint rate limits
│   │   │   │   ├── request-id.middleware.ts  # Request ID tracking
│   │   │   │   ├── sanitize.middleware.ts    # XSS sanitisation
│   │   │   │   └── tenant.middleware.ts      # Tenant isolation
│   │   │   └── docs/
│   │   │       └── swagger.js       # Swagger UI (dev only)
│   │   ├── services/                # Business logic (50+ files)
│   │   │   ├── auth.service.ts          # Authentication logic
│   │   │   ├── user.service.ts          # User management
│   │   │   ├── student.service.ts       # Student operations
│   │   │   ├── teacher.service.ts       # Teacher operations
│   │   │   ├── department.service.ts    # Department CRUD
│   │   │   ├── course.service.ts        # Course management
│   │   │   ├── batch.service.ts         # Batch lifecycle
│   │   │   ├── semester.service.ts      # Semester management
│   │   │   ├── section.service.ts       # Section management
│   │   │   ├── subject.service.ts       # Subject management
│   │   │   ├── attendance.service.ts    # Attendance logic
│   │   │   ├── assignment.service.ts    # Assignments logic
│   │   │   ├── marks.service.ts         # Marks logic
│   │   │   ├── internal-assessment.service.ts  # IA system
│   │   │   ├── semester-marks.service.ts  # Semester marks upload
│   │   │   ├── semester-progression.service.ts  # Batch progression
│   │   │   ├── results.service.ts       # Result finalization
│   │   │   ├── revaluations.service.ts  # Revaluations
│   │   │   ├── admissions.service.ts    # Admissions workflow
│   │   │   ├── form-config.service.ts   # Dynamic form config
│   │   │   ├── usn-request.service.ts   # USN management
│   │   │   ├── student-migration.service.ts  # Student data migration
│   │   │   ├── chat.service.ts          # Chat messaging
│   │   │   ├── parent.service.ts        # Parent operations
│   │   │   ├── tenant.service.ts        # Tenant management
│   │   │   ├── developer.service.ts     # Developer operations
│   │   │   ├── dept-admin.service.ts    # Dept admin logic
│   │   │   ├── clerk.service.ts         # Clerk operations
│   │   │   ├── clerk-marks.service.ts   # Clerk marks entry
│   │   │   ├── coe.service.ts           # COE operations
│   │   │   ├── edit-request.service.ts  # Edit requests
│   │   │   ├── first-year-coordinator.service.ts  # FY coordinator
│   │   │   ├── email.service.ts         # Multi-provider email
│   │   │   ├── email-queue.service.ts   # BullMQ email queue
│   │   │   ├── sms.service.ts           # SMS notifications
│   │   │   ├── cache.service.ts         # Redis cache (with fallback)
│   │   │   ├── storage.service.ts       # S3/local file storage
│   │   │   ├── excel-parser.service.ts  # Excel column detection
│   │   │   ├── system-error.service.ts  # Error tracking
│   │   │   └── mentor/                  # Mentor sub-services
│   │   ├── data-access/             # Repository layer (20 files)
│   │   │   ├── prisma.ts               # Prisma client singleton
│   │   │   ├── user.repository.ts
│   │   │   ├── attendance.repository.ts
│   │   │   ├── assignment.repository.ts
│   │   │   ├── audit-log.repository.ts
│   │   │   ├── batch.repository.ts
│   │   │   ├── course.repository.ts
│   │   │   ├── course-allocation.repository.ts
│   │   │   ├── department.repository.ts
│   │   │   ├── edit-request.repository.ts
│   │   │   ├── first-year-coordinator.repository.ts
│   │   │   ├── internal-assessment.repository.ts
│   │   │   ├── marks.repository.ts
│   │   │   ├── mentor-assignment.repository.ts
│   │   │   ├── program.repository.ts
│   │   │   ├── section.repository.ts
│   │   │   ├── semester.repository.ts
│   │   │   ├── subject.repository.ts
│   │   │   └── timetable.repository.ts
│   │   ├── config/                  # Configuration
│   │   │   ├── env.ts                  # Zod-validated environment
│   │   │   ├── rbac.ts                 # RBAC permission matrix
│   │   │   └── error-codes.ts          # Standardised error codes
│   │   ├── utils/                   # Shared utilities
│   │   │   ├── logger.ts               # Pino logger
│   │   │   ├── db-retry.ts             # Database retry logic
│   │   │   ├── password-validator.ts   # Password strength rules
│   │   │   ├── param-utils.ts          # Query parameter parsing
│   │   │   └── semester-lock.ts        # Semester write-lock guard
│   │   ├── types/                   # TypeScript type definitions
│   │   ├── scripts/                 # Debug & admin scripts
│   │   └── __tests__/               # Test suites
│   ├── prisma/
│   │   ├── schema.prisma            # Database schema (1495 lines, 40+ models)
│   │   ├── seed.ts                  # Development seed data
│   │   ├── seed-production.ts       # Production seed data
│   │   └── migrations/              # 24+ migration files
│   ├── scripts/
│   │   └── migrate-production.mjs   # Safe production migration
│   ├── vitest.config.ts
│   ├── prisma.config.ts
│   └── package.json
├── docker-compose.yml               # Full stack (Postgres + PgBouncer + Redis + Server + Client + Backup)
├── Dockerfile.client                # Next.js multi-stage build
├── Dockerfile.server                # Express multi-stage build
├── pgbouncer.ini                    # Connection pooler config
├── render.yaml                      # Render IaC blueprint
├── netlify.toml                     # Netlify frontend config
├── .npmrc                           # npm workspace config
├── tsconfig.json                    # Root TypeScript config
├── .env.example                     # Environment variable template
└── package.json                     # Root workspace package
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20.0.0
- **PostgreSQL** 16 (or Supabase/Neon cloud)
- **Redis** 7 (optional — gracefully degrades)
- **npm** ≥ 9

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/your-org/academic-ops-platform.git
cd academic-ops-platform

# 2. Copy environment variables
cp .env.example server/.env

# 3. Update server/.env with your database URL
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/academic_ops

# 4. Install all dependencies (root + client + server)
npm install

# 5. Generate Prisma client
cd server && npx prisma generate && cd ..

# 6. Run database migrations
cd server && npx prisma migrate dev && cd ..

# 7. Seed development data (optional)
cd server && npx tsx prisma/seed.ts && cd ..

# 8. Start both client and server
npm run dev
```

This starts:
- **Client** → `http://localhost:3001`
- **Server** → `http://localhost:4000`
- **API** → `http://localhost:4000/api`
- **Swagger** → `http://localhost:4000/api-docs` (dev only)

### Docker Compose

```bash
# Development (all services with hot-reload)
docker compose up

# Production
docker compose --profile production up

# Just infrastructure (Postgres + Redis)
docker compose up postgres redis
```

The Docker stack includes:
- **PostgreSQL 16** with health checks
- **PgBouncer** connection pooling (port 6432)
- **Redis 7** with AOF persistence
- **Express server** (port 4001)
- **Next.js client** (port 3001)
- **Daily database backups** (retained 7 days)

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection (pooled, port 6543 for Supabase) |
| `DIRECT_DATABASE_URL` | ❌ | — | Direct connection for migrations (port 5432) |
| `REDIS_URL` | ❌ | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | ✅ | — | Access token signing key (≥32 chars) |
| `JWT_REFRESH_SECRET` | ❌ | `{JWT_SECRET}_refresh` | Refresh token signing key |
| `JWT_ACCESS_EXPIRES_IN` | ❌ | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | ❌ | `7d` | Refresh token TTL |
| `PORT` | ❌ | `4000` | Server port |
| `NODE_ENV` | ❌ | `development` | Environment mode |
| `ALLOWED_ORIGINS` | ❌ | `http://localhost:3001` | CORS origins (comma-separated) |
| `LOG_LEVEL` | ❌ | `info` | Pino log level |
| `SMTP_HOST` | ❌ | `smtp.gmail.com` | SMTP server |
| `SMTP_PORT` | ❌ | `587` | SMTP port |
| `SMTP_USER` | ❌ | — | SMTP username |
| `SMTP_PASS` | ❌ | — | SMTP password |
| `SMTP_FROM` | ❌ | `Academic Ops <noreply@acadops.edu>` | Sender email |
| `BREVO_API_KEY` | ❌ | — | Brevo HTTP email API key |
| `BREVO_FROM` | ❌ | — | Brevo sender email |
| `S3_ENDPOINT` | ❌ | — | S3-compatible endpoint (R2, MinIO) |
| `S3_ACCESS_KEY` | ❌ | — | S3 access key |
| `S3_SECRET_KEY` | ❌ | — | S3 secret key |
| `S3_BUCKET` | ❌ | — | S3 bucket name |
| `SMS_ENABLED` | ❌ | `false` | Enable SMS notifications |
| `FAST2SMS_API_KEY` | ❌ | — | Fast2SMS API key |
| `SMS_SENDER_ID` | ❌ | `ACADOP` | SMS sender ID |
| `FRONTEND_URL` | ❌ | `http://localhost:3000` | Frontend URL for email links |

---

## API Reference

All endpoints are prefixed with `/api`. Authentication is via `Authorization: Bearer <access_token>` header.

### Health Check

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | ❌ | Server health (DB + Redis + memory metrics) |

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | ❌ | Login (returns access + refresh tokens) |
| `POST` | `/api/auth/refresh` | ❌ | Refresh access token |
| `POST` | `/api/auth/forgot-password` | ❌ | Request password reset email |
| `POST` | `/api/auth/reset-password` | ❌ | Reset password with token |
| `POST` | `/api/auth/change-password` | ✅ | Change own password |
| `GET` | `/api/auth/me` | ✅ | Get current user profile |

### Users

| Method | Endpoint | Auth | Roles |
|---|---|---|---|
| `GET` | `/api/users` | ✅ | SUPER_ADMIN |
| `POST` | `/api/users` | ✅ | SUPER_ADMIN |
| `POST` | `/api/users/bulk` | ✅ | SUPER_ADMIN, DEPT_ADMIN |
| `PATCH` | `/api/users/:id` | ✅ | SUPER_ADMIN |
| `DELETE` | `/api/users/:id` | ✅ | SUPER_ADMIN |

### Academic Structure

| Resource | Endpoints | Key Roles |
|---|---|---|
| Departments | `GET/POST/PATCH/DELETE /api/departments` | SUPER_ADMIN |
| Programs | `GET/POST/PATCH/DELETE /api/programs` | SUPER_ADMIN |
| Courses | `GET/POST/PATCH/DELETE /api/courses` | COE |
| Batches | `GET/POST/PATCH/DELETE /api/batches` | SUPER_ADMIN |
| Semesters | `GET/POST/PATCH/DELETE /api/semesters` | SUPER_ADMIN |
| Sections | `GET/POST/PATCH/DELETE /api/sections` | SUPER_ADMIN, DEPT_ADMIN |
| Subjects | `GET/POST/PATCH /api/subjects` | DEPT_ADMIN |

### Operations

| Resource | Endpoints | Key Roles |
|---|---|---|
| Attendance | `GET/POST/PATCH /api/attendance` | TEACHER, DEPT_ADMIN |
| Assignments | `GET/POST/PATCH/DELETE /api/assignments` | TEACHER |
| Marks | `GET/POST/PATCH /api/marks` | TEACHER, DEPT_ADMIN |
| Internal Marks | `GET/POST /api/dept-admin/internal-marks` | DEPT_ADMIN, TEACHER |
| Semester Marks | `POST/GET /api/semester-marks` | CLERK, COE |
| Results | `GET/POST /api/results` | COE |
| Revaluations | `GET/POST /api/revaluations` | CLERK, COE |

### Admissions

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/admissions` | ✅ | Create admission entry |
| `GET` | `/api/admissions` | ✅ | List admissions |
| `PATCH` | `/api/admissions/:id/approve` | ✅ | Approve admission |
| `PATCH` | `/api/admissions/:id/reject` | ✅ | Reject admission |
| `POST` | `/api/admissions/close-department` | ✅ | Close dept + assign temp USNs |

### Developer Portal

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/developer/login` | ❌ | Developer login |
| `GET` | `/api/developer/tenants` | ✅ | List all tenants |
| `POST` | `/api/developer/tenants` | ✅ | Create tenant |
| `GET` | `/api/developer/system-errors` | ✅ | System error logs |
| `GET` | `/api/developer/email-logs` | ✅ | Email delivery logs |

### Chat

| Method | Endpoint | Auth | Roles |
|---|---|---|---|
| `GET` | `/api/chat/conversations` | ✅ | PARENT, TEACHER, DEPT_ADMIN |
| `POST` | `/api/chat/conversations` | ✅ | PARENT |
| `POST` | `/api/chat/messages` | ✅ | PARENT, TEACHER |
| `POST` | `/api/chat/:id/escalate` | ✅ | PARENT, TEACHER |

### Audit Logs

| Method | Endpoint | Auth | Roles |
|---|---|---|---|
| `GET` | `/api/audit-logs` | ✅ | SUPER_ADMIN, DEPT_ADMIN, COE |

---

## Deployment

### Render (Backend)

The `render.yaml` blueprint configures:
- **Service**: `acadops-api` (Node.js, Singapore region, Starter plan)
- **Build**: `prisma generate → migrate → tsc`
- **Health check**: `/api/health`
- **Auto-generated secrets**: `JWT_SECRET`, `JWT_REFRESH_SECRET`

```bash
# Deploy via Render Dashboard
# 1. Connect GitHub repo
# 2. Render auto-detects render.yaml
# 3. Set DATABASE_URL and ALLOWED_ORIGINS in dashboard
```

### Netlify (Frontend)

The `netlify.toml` configures:
- **Base directory**: `client/`
- **Build command**: `npm install && npm run build`
- **Plugin**: `@netlify/plugin-nextjs` (handles SSR/ISR/middleware)

```bash
# Set in Netlify Dashboard:
# NEXT_PUBLIC_API_URL = https://your-render-api.onrender.com/api
```

### Docker Production

```bash
# Build and run all services
docker compose --profile production up -d

# Required environment variables
export JWT_SECRET="your-secret-key-at-least-32-characters"
export DB_PASSWORD="strong-database-password"
export ALLOWED_ORIGINS="https://your-domain.com"
```

---

## Testing

The server uses **Vitest** for unit and integration testing.

```bash
# Run all server tests
npm run test --workspace=server

# Watch mode
npm run test:watch --workspace=server

# Run specific test
cd server && npx vitest run src/services/auth.service.test.ts
```

### Test Coverage

| Area | Tests |
|---|---|
| `auth.service.test.ts` | Authentication flows, token generation, password reset |
| `course.service.test.ts` | Course CRUD, locking, validation |
| `email.service.test.ts` | Multi-provider email delivery |
| `storage.service.test.ts` | File upload, S3 integration |
| `error.middleware.test.ts` | Error handling, status codes |
| `request-id.middleware.test.ts` | Request ID propagation |
| `sanitize.middleware.test.ts` | XSS prevention |
| `db-retry.test.ts` | Database retry logic |

---

## CI/CD

GitHub Actions runs on every push/PR to `main`:

```yaml
Jobs: lint-build-test
├── PostgreSQL 16 service container
├── npm ci
├── Prisma generate
├── Lint (client)
├── Build server
├── Build client
└── Run server tests
```

---

## Security

| Layer | Implementation |
|---|---|
| **Authentication** | JWT access (15m) + refresh (7d) tokens |
| **Password Hashing** | Argon2 with configurable strength |
| **Password Policy** | Minimum length, complexity validation |
| **Account Lockout** | Progressive lockout after failed attempts |
| **Token Revocation** | Token version tracking for forced logout |
| **CORS** | Explicit origin allowlist |
| **Rate Limiting** | Global (500 req/15min prod) + endpoint-specific (Redis-backed) |
| **Helmet** | HSTS, CSP, X-Content-Type-Options, Referrer-Policy |
| **XSS Protection** | Request body sanitisation via `xss` library |
| **Input Validation** | Zod schemas on all API endpoints |
| **SQL Injection** | Prisma parameterised queries |
| **Path Traversal** | Static file middleware blocks `..` and null bytes |
| **RBAC** | 10-role matrix with 4 scope levels |
| **Multi-Tenancy** | Data isolation via `tenantId` on all queries |
| **Audit Trail** | Immutable logs with IP, user agent, old/new values |
| **Request Timeout** | 30-second server timeout |
| **Graceful Shutdown** | SIGTERM/SIGINT handlers with 10s force-exit |

---

## Scripts Reference

| Command | Description |
|---|---|
| `npm run dev` | Start both client and server (concurrent) |
| `npm run dev:client` | Start Next.js dev server (port 3001) |
| `npm run dev:server` | Start Express dev server with hot-reload |
| `npm run build` | Build both workspaces for production |
| `npm run lint` | Lint all workspaces |
| `npm run test` | Run tests in all workspaces |
| `npm run clean` | Remove node_modules, .next, dist |

### Server-specific

| Command | Description |
|---|---|
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema changes (no migration) |
| `npm run db:migrate` | Create and run migrations |
| `npm run db:seed` | Seed development data |

---

## License

This project is private and proprietary. All rights reserved.
