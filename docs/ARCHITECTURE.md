# 🏗️ Architecture Guide

> Deep-dive into the system design, data flow, and infrastructure of the Academic Ops Platform.

---

## Table of Contents

- [System Overview](#system-overview)
- [High-Level Architecture](#high-level-architecture)
- [Monorepo Structure](#monorepo-structure)
- [Backend Architecture](#backend-architecture)
  - [Layered Architecture](#layered-architecture)
  - [Request Lifecycle](#request-lifecycle)
  - [Middleware Pipeline](#middleware-pipeline)
  - [Route Organisation](#route-organisation)
  - [Service Layer](#service-layer)
  - [Data Access Layer (Repository Pattern)](#data-access-layer-repository-pattern)
- [Frontend Architecture](#frontend-architecture)
  - [App Router & Pages](#app-router--pages)
  - [State Management](#state-management)
  - [API Client](#api-client)
  - [Component Architecture](#component-architecture)
  - [Design System](#design-system)
- [Multi-Tenancy Architecture](#multi-tenancy-architecture)
  - [Tenant Isolation Model](#tenant-isolation-model)
  - [Tenant Lifecycle](#tenant-lifecycle)
  - [Data Scoping](#data-scoping)
- [Authentication & Token Architecture](#authentication--token-architecture)
  - [Token Flow](#token-flow)
  - [Token Revocation](#token-revocation)
  - [Password Reset Flow](#password-reset-flow)
- [RBAC Architecture](#rbac-architecture)
  - [Permission Model](#permission-model)
  - [Middleware Guards](#middleware-guards)
- [Database Architecture](#database-architecture)
  - [Schema Design](#schema-design)
  - [Connection Management](#connection-management)
  - [Migration Strategy](#migration-strategy)
  - [Audit Log Immutability](#audit-log-immutability)
  - [Retry & Resilience](#retry--resilience)
- [Caching Architecture](#caching-architecture)
  - [Cache Tiers](#cache-tiers)
  - [Cache Stampede Prevention](#cache-stampede-prevention)
  - [Cache Invalidation](#cache-invalidation)
- [Background Jobs & Queues](#background-jobs--queues)
- [Email & Notification Architecture](#email--notification-architecture)
- [File Storage Architecture](#file-storage-architecture)
- [Error Handling Architecture](#error-handling-architecture)
- [Infrastructure & Deployment](#infrastructure--deployment)
  - [Docker Architecture](#docker-architecture)
  - [CI/CD Pipeline](#cicd-pipeline)
  - [Production Topology](#production-topology)
- [Performance Optimisations](#performance-optimisations)
- [Observability](#observability)

---

## System Overview

Academic Ops is a **governance-first, multi-tenant academic ERP** built as a full-stack TypeScript monorepo. The system handles the complete academic lifecycle — admissions → internal assessments → semester examinations → results — with strict role-based access, immutable audit trails, and multi-institution data isolation.

### Design Principles

| Principle | How It's Applied |
|---|---|
| **Separation of Concerns** | 4-layer architecture: Routes → Services → Repositories → Prisma |
| **Zero Trust** | Every request is authenticated, tenant-validated, and role-checked |
| **Graceful Degradation** | Redis/Email/SMS are optional — system works without them |
| **Immutability** | Audit logs cannot be deleted (enforced at ORM level) |
| **Defence in Depth** | XSS sanitisation + Helmet + Rate limiting + CORS + Zod validation |

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INTERNET / CDN                              │
└───────────────────────┬─────────────────────┬───────────────────────┘
                        │                     │
                        ▼                     ▼
          ┌──────────────────────┐  ┌──────────────────────┐
          │   Netlify (SSR)      │  │   Render / Railway    │
          │   Next.js 16 Client  │  │   Express 5 Server    │
          │   Port 3001          │  │   Port 4000           │
          │                      │  │                       │
          │  ┌────────────────┐  │  │  ┌────────────────┐   │
          │  │ React 19       │  │  │  │ Middleware      │   │
          │  │ Zustand Store  │──┼──┼─▶│ Chain           │   │
          │  │ TanStack Query │  │  │  │ ┌──────────┐   │   │
          │  │ Axios Client   │  │  │  │ │Sanitize  │   │   │
          │  └────────────────┘  │  │  │ │Auth      │   │   │
          └──────────────────────┘  │  │ │Tenant    │   │   │
                                    │  │ │RBAC      │   │   │
                                    │  │ │Cache     │   │   │
                                    │  │ │RateLimit │   │   │
                                    │  │ └──────────┘   │   │
                                    │  └────────┬───────┘   │
                                    │           │           │
                                    │  ┌────────▼───────┐   │
                                    │  │ Service Layer   │   │
                                    │  │ (Business Logic)│   │
                                    │  └────────┬───────┘   │
                                    │           │           │
                                    │  ┌────────▼───────┐   │
                                    │  │ Repository      │   │
                                    │  │ (Data Access)   │   │
                                    │  └────────┬───────┘   │
                                    └───────────┼───────────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              ▼                 ▼                 ▼
                     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                     │  PostgreSQL  │  │    Redis 7   │  │  S3 / Local  │
                     │    16        │  │  (Optional)  │  │   Storage    │
                     │              │  │              │  │              │
                     │  ┌────────┐  │  │  • Cache     │  │  • Timetable │
                     │  │PgBounce│  │  │  • Rate Limit│  │  • Documents │
                     │  │  r     │  │  │  • Email Q   │  │  • Logos     │
                     │  │(pool)  │  │  │  • Sessions  │  │              │
                     │  └────────┘  │  │              │  │              │
                     └──────────────┘  └──────────────┘  └──────────────┘
```

---

## Monorepo Structure

The project uses **npm workspaces** to manage two packages from a single root:

```
academic-ops-platform/          ← Root (orchestrator)
├── package.json                ← Workspace definition + shared scripts
├── tsconfig.json               ← Project references (→ client, → server)
├── .npmrc                      ← install-strategy=hoisted, save-exact=true
│
├── client/                     ← Next.js 16 frontend
│   ├── package.json
│   ├── tsconfig.json           ← target: ES2017, module: esnext, jsx: react-jsx
│   └── src/
│
└── server/                     ← Express 5 backend
    ├── package.json
    ├── tsconfig.json           ← target: ES2022, module: NodeNext, paths: @/* → ./src/*
    └── src/
```

### Key Configuration

| Setting | Value | Rationale |
|---|---|---|
| `install-strategy` | `hoisted` | Proper workspace dependency hoisting |
| `save-exact` | `true` | Prevents version drift across environments |
| `strict-peer-deps` | `false` | Avoids peer dep failures in complex trees |
| Module System | ESM (`NodeNext`) | Server uses native ES modules |

---

## Backend Architecture

### Layered Architecture

The server follows a strict **4-layer architecture** where each layer only communicates with the layer directly below it:

```
┌─────────────────────────────────────────────────────┐
│  ROUTES (api/routes/)                               │
│  ─ HTTP contract (request parsing, response format) │
│  ─ Zod validation schemas                           │
│  ─ Middleware application (auth, role, rate limit)   │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  SERVICES (services/)                               │
│  ─ Business logic and domain rules                  │
│  ─ Orchestrates multiple repositories               │
│  ─ Audit logging, email triggers                    │
│  ─ Error throwing (ApiError.fromCode)               │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  REPOSITORIES (data-access/)                        │
│  ─ Database query abstraction                       │
│  ─ Prisma operations + tenant scoping               │
│  ─ Complex joins and aggregations                   │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  PRISMA ORM (data-access/prisma.ts)                 │
│  ─ Singleton client with Neon adapter               │
│  ─ Audit log immutability extension                 │
│  ─ Slow query monitoring (>1000ms)                  │
└─────────────────────────────────────────────────────┘
```

### Request Lifecycle

Every API request passes through this pipeline:

```
HTTP Request
  │
  ▼
┌──── Express 5 ────────────────────────────────────┐
│ 1. Body Parser (JSON, 10mb limit)                 │
│ 2. Cookie Parser                                  │
│ 3. Compression (~70% bandwidth reduction)         │
│ 4. Helmet (security headers)                      │
│ 5. CORS (explicit origin allowlist)               │
│ 6. Request ID (X-Request-Id header)               │
│ 7. Request Logger (Pino structured logging)       │
│ 8. XSS Sanitisation (body + query params)         │
│ 9. Static File Guard (blocks ../ and null bytes)  │
│ 10. Global Rate Limiter (500 req/15min prod)      │
└───────────────────────┬───────────────────────────┘
                        ▼
┌──── Route-Level Middleware ────────────────────────┐
│ 11. authenticate (JWT verification + token ver.)  │
│ 12. enforceTenant (tenant active check, cached)   │
│ 13. requireRole / requirePermission (RBAC)        │
│ 14. cacheResponse (Redis GET cache, optional)     │
│ 15. authenticatedLimiter (100 req/min per user)   │
│ 16. bulkOperationLimiter (10 req/min, optional)   │
└───────────────────────┬───────────────────────────┘
                        ▼
┌──── Route Handler ────────────────────────────────┐
│ 17. Zod schema.parse(req.body)                    │
│ 18. Service method call                           │
│ 19. res.json(result)                              │
└───────────────────────┬───────────────────────────┘
                        ▼
┌──── Error Handling ───────────────────────────────┐
│ 20. Global error handler (logs to SystemError)    │
│ 21. Prisma error mapping (P2002→409, P2025→404)   │
│ 22. Message-based status code inference           │
│ 23. 404 catch-all handler                         │
└───────────────────────────────────────────────────┘
```

### Middleware Pipeline

| Order | Middleware | File | Purpose |
|---|---|---|---|
| 1 | `express.json` | Built-in | Parse JSON bodies (10mb limit) |
| 2 | `compression` | npm | Gzip/deflate response compression |
| 3 | `helmet` | npm | 11 security headers (HSTS, CSP, etc.) |
| 4 | `cors` | Built-in | Explicit origin allowlist from env |
| 5 | `requestId` | `request-id.middleware.ts` | Generate/propagate X-Request-Id |
| 6 | `requestLogger` | `index.ts` | Structured request/response logging |
| 7 | `sanitizeRequest` | `sanitize.middleware.ts` | XSS sanitisation via `xss` library |
| 8 | `staticGuard` | `index.ts` | Block path traversal (`..`, `%00`) |
| 9 | `globalLimiter` | `index.ts` | 500 req/15min per IP (production) |
| 10 | `authenticate` | `auth.middleware.ts` | JWT verification + token version check |
| 11 | `enforceTenant` | `tenant.middleware.ts` | Verify tenant is active (cached) |
| 12 | `requireRole` | `auth.middleware.ts` | Role-based access guard |
| 13 | `cacheResponse` | `cache.middleware.ts` | Redis GET response cache |
| 14 | `authenticatedLimiter` | `rate-limiters.ts` | 100 req/min per userId |
| 15 | `bulkOperationLimiter` | `rate-limiters.ts` | 10 req/min for bulk operations |
| 16 | `exportLimiter` | `rate-limiters.ts` | 5 req/min for data exports |
| 17 | `errorHandler` | `error.middleware.ts` | Global error catch + SystemError logging |

### Route Organisation

The route aggregator (`api/routes/index.ts`) splits routes into two groups:

```
Public / Self-Authenticating Routes:
├── /api/dev/*           ─ Developer portal (own auth)
├── /api/auth/*          ─ Login, register, reset
└── /api/admissions/*    ─ Public admission forms

Tenant-Enforced Routes (authenticate → enforceTenant):
├── /api/departments     ─ Department CRUD
├── /api/semesters       ─ Semester lifecycle
├── /api/users           ─ User management
├── /api/courses         ─ Course catalogue
├── /api/subjects        ─ Subject instances
├── /api/programs        ─ Program management
├── /api/attendance      ─ Attendance records
├── /api/assignments     ─ Assignment management
├── /api/marks           ─ Marks management
├── /api/audit-logs      ─ Audit trail queries
├── /api/edit-requests   ─ Edit request workflow
├── /api/sections        ─ Section management
├── /api/batches         ─ Batch management
├── /api/clerks          ─ Clerk management
├── /api/clerk-marks     ─ Clerk marks entry
├── /api/dept-admin/*    ─ Department admin (6 sub-routers)
├── /api/teacher         ─ Teacher operations
├── /api/student         ─ Student dashboard
├── /api/coe             ─ COE operations
├── /api/semester-marks  ─ Semester marks upload
├── /api/first-year-coordinator  ─ FY allocation
├── /api/results         ─ Result finalization
├── /api/revaluations    ─ Revaluation entries
├── /api/parent          ─ Parent dashboard
├── /api/chat            ─ Parent-mentor chat
└── /api/usn-requests    ─ USN management
```

The Department Admin module is further split into **6 sub-routers**:

```
/api/dept-admin/
├── admin.routes.ts       ─ Audit logs, edit requests, mentors
├── attendance.routes.ts  ─ Attendance oversight
├── courses.routes.ts     ─ Course allocation, teacher assignment
├── marks.routes.ts       ─ Internal assessment config, marks
├── sections.routes.ts    ─ Section student management
└── timetable.routes.ts   ─ Time slot config, timetable upload
```

### Service Layer

The service layer contains **50+ files** organised by domain:

```
services/
├── Core Services
│   ├── auth.service.ts              ─ Login, JWT, password reset
│   ├── user.service.ts              ─ User CRUD, bulk creation
│   ├── tenant.service.ts            ─ Tenant management
│   └── developer.service.ts         ─ Developer portal
│
├── Academic Services
│   ├── department.service.ts
│   ├── course.service.ts
│   ├── batch.service.ts
│   ├── semester.service.ts
│   ├── section.service.ts
│   ├── subject.service.ts
│   └── program.service.ts
│
├── Operations Services
│   ├── attendance.service.ts
│   ├── assignment.service.ts
│   ├── marks.service.ts
│   ├── internal-assessment.service.ts
│   └── timetable.service.ts
│
├── Examination Services
│   ├── semester-marks.service.ts
│   ├── results.service.ts
│   ├── revaluations.service.ts
│   └── semester-progression.service.ts
│
├── Admissions (Modular Sub-Services)
│   ├── admissions/
│   │   ├── admission-core.service.ts
│   │   ├── admission-bulk.service.ts
│   │   ├── admission-query.service.ts
│   │   └── admission-usn.service.ts
│   └── form-config.service.ts
│
├── Mentorship (Modular Sub-Services)
│   └── mentor/
│       ├── mentor-assignment.service.ts
│       └── mentor-dashboard.service.ts
│
├── Teacher (Modular Sub-Services)
│   └── teacher/
│       ├── teacher-attendance.service.ts
│       └── teacher-marks.service.ts
│
├── Communication Services
│   ├── chat.service.ts
│   ├── email.service.ts
│   ├── email-queue.service.ts
│   └── sms.service.ts
│
├── Infrastructure Services
│   ├── cache.service.ts
│   ├── storage.service.ts
│   ├── excel-parser.service.ts
│   └── system-error.service.ts
│
└── Role-Specific Services
    ├── dept-admin.service.ts
    ├── student.service.ts
    ├── parent.service.ts
    ├── clerk.service.ts
    ├── clerk-marks.service.ts
    └── coe.service.ts
```

### Data Access Layer (Repository Pattern)

All database operations are abstracted behind **20 repository files**:

| Repository | Primary Model | Key Operations |
|---|---|---|
| `user.repository.ts` | User | Find by email/roll, tenant-scoped queries |
| `department.repository.ts` | Department | CRUD with cycle department support |
| `course.repository.ts` | Course | Lock/unlock, marks configuration |
| `batch.repository.ts` | Batch | Semester progression, graduation |
| `semester.repository.ts` | Semester | Lifecycle management (ACTIVE→CLOSED→ARCHIVED) |
| `section.repository.ts` | Section | Student assignment, locking |
| `subject.repository.ts` | Subject | Teacher assignment, enrollment |
| `attendance.repository.ts` | Attendance | Bulk mark, date-wise queries |
| `marks.repository.ts` | Marks | Score entry, summary aggregation |
| `internal-assessment.repository.ts` | InternalAssessmentConfig | IA config, detailed marks |
| `audit-log.repository.ts` | AuditLog | Immutable create, filtered queries |
| `edit-request.repository.ts` | EditRequest | Approval workflow |
| `assignment.repository.ts` | Assignment | CRUD with submissions |
| `mentor-assignment.repository.ts` | MentorAssignment | Semester-based pairing |
| `timetable.repository.ts` | SectionTimetable | File upload tracking |
| `course-allocation.repository.ts` | CourseAllocation | Teacher-course-section mapping |
| `first-year-coordinator.repository.ts` | CycleDepartmentAllocation | PHY/CHEM assignment |
| `program.repository.ts` | Program | Dept-program many-to-many |

---

## Frontend Architecture

### App Router & Pages

The client uses **Next.js App Router** with role-based route groups:

```
app/
├── /                           ─ Landing page (public)
├── /login                      ─ Multi-tenant login (institution picker)
├── /apply/[slug]               ─ Public admission form (per tenant)
├── /dev/login                  ─ Developer login
├── /dev/dashboard              ─ Developer super-dashboard
│
└── /dashboard/
    ├── /admin/*                ─ Super Admin (15 sub-pages)
    ├── /dept-admin/*           ─ Department Admin (15 sub-pages)
    ├── /coe/*                  ─ COE (7 sub-pages)
    ├── /teacher/*              ─ Teacher (8 sub-pages + mentorship)
    ├── /clerk/*                ─ Clerk (4 sub-pages)
    ├── /admissions/*           ─ Admissions Admin (8 sub-pages)
    ├── /student/*              ─ Student (8 sub-pages)
    ├── /parent/*               ─ Parent (4 sub-pages)
    └── /first-year-coordinator/*  ─ FYC (3 sub-pages)
```

### State Management

```
┌──────────────────────────────────────────────────┐
│                 State Architecture                │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─────────────────────┐  ┌──────────────────┐  │
│  │   Zustand Store     │  │ TanStack Query   │  │
│  │   (Client State)    │  │ (Server State)   │  │
│  │                     │  │                  │  │
│  │  • user             │  │  • API responses │  │
│  │  • token            │  │  • Cache (1min)  │  │
│  │  • isAuthenticated  │  │  • Mutations     │  │
│  │  • tenantSlug       │  │  • Pagination    │  │
│  │  • tenantType       │  │  • Background    │  │
│  │                     │  │    refetch       │  │
│  │  Persisted to       │  │                  │  │
│  │  localStorage       │  │  No refetch on   │  │
│  │  (auth-storage key) │  │  window focus    │  │
│  └─────────────────────┘  └──────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

### API Client

The centralised API client (`lib/api.ts`, 1581 lines) manages all HTTP communication:

```
┌─────────────────────────────────────────────┐
│              Axios Instance                  │
│                                             │
│  Base URL: NEXT_PUBLIC_API_URL/api          │
│                                             │
│  Request Interceptor:                       │
│  ├─ Inject Bearer token from localStorage   │
│                                             │
│  Response Interceptor:                      │
│  ├─ Retry on 502/503/504 (max 2, 2s/4s)   │
│  └─ On 401 → preserve tenant → redirect    │
│       to /login                              │
│                                             │
│  22 API Modules:                            │
│  authApi, departmentApi, semesterApi,       │
│  batchApi, userApi, courseApi, subjectApi,   │
│  programApi, attendanceApi, assignmentApi,  │
│  marksApi, auditLogApi, editRequestApi,     │
│  sectionApi, studentApi, clerkApi,          │
│  teacherApi, mentorApi, admissionsApi,      │
│  coeApi, semesterMarksApi, chatApi,         │
│  parentApi, developerApi, ...               │
└─────────────────────────────────────────────┘
```

### Component Architecture

```
components/
├── ui/                      ← Design system primitives
│   ├── Button (5 variants, 3 sizes, loading state)
│   ├── Input (label, error, helperText)
│   ├── Card + StatCard (icon, change indicator)
│   ├── Badge (6 variants + SemesterStatusBadge)
│   └── Tabs (context-based TabsList/Trigger/Content)
│
├── layout/                  ← Structural components
│   ├── DashboardShell (auth guard + sidebar + header)
│   ├── DashStat + DashStatsRow (stat cards grid)
│   └── QuickActionCard + QuickActionsGrid
│
└── domain/                  ← Feature-specific
    ├── admin/BulkUploadModal (4-step wizard, drag-drop Excel)
    ├── admin/DepartmentAdmissionStatus
    ├── clerk/SemesterMarksUpload
    ├── coe/PermanentUsnAssignment
    ├── coe/SemesterMarksReview
    └── SemesterSelectionDialog
```

### Design System

Custom-built design system (no shadcn/ui, no Radix):

| Element | Implementation |
|---|---|
| **Colours** | Curated HSL palette — Indigo/Violet primary, Teal/Emerald secondary, Cool Slate neutrals |
| **Typography** | Inter (body), Outfit (headings), JetBrains Mono (code) |
| **Effects** | Glassmorphism (`.glass`), gradient mesh backgrounds, premium card variants |
| **Animations** | Smooth transitions, hover states, loading spinners |
| **CSS Architecture** | Tailwind 4 utilities + CSS layer components in `globals.css` |

---

## Multi-Tenancy Architecture

### Tenant Isolation Model

The platform uses **row-level tenant isolation** — every data record is scoped to a `tenantId`:

```
┌──────────────────────────────────────────────────────────┐
│                    Developer Layer                        │
│  (Above all tenants — manages the platform itself)       │
│  Model: Developer                                        │
└──────────────────────┬───────────────────────────────────┘
                       │ creates
          ┌────────────┼────────────────┐
          ▼            ▼                ▼
    ┌──────────┐ ┌──────────┐    ┌──────────┐
    │ Tenant A │ │ Tenant B │    │ Tenant C │
    │ (Eng.)   │ │ (Medical)│    │ (MBA)    │
    │          │ │          │    │          │
    │ Users    │ │ Users    │    │ Users    │
    │ Depts    │ │ Depts    │    │ Depts    │
    │ Students │ │ Students │    │ Students │
    │ Marks    │ │ Marks    │    │ Marks    │
    │ ...      │ │ ...      │    │ ...      │
    └──────────┘ └──────────┘    └──────────┘
         ↕              ↕              ↕
      COMPLETE DATA ISOLATION — NO CROSS-TENANT ACCESS
```

### Tenant Lifecycle

```
Developer creates Tenant
  → Tenant slug assigned (e.g. "rvce")
  → Super Admin created for tenant
  → Tenant is ACTIVE

Tenant ACTIVE
  → Users can login via /login?tenant=rvce
  → All CRUD operations work normally
  → Public admission forms at /apply/rvce

Tenant INACTIVE (developer deactivates)
  → Login blocked ("Tenant is inactive. Contact support.")
  → enforceTenant middleware rejects all API calls
  → Data is preserved but inaccessible
```

### Data Scoping

The `enforceTenant` middleware runs **after** authentication on every tenant-scoped route:

```typescript
// 1. Extract tenantId from JWT payload
const tenantId = req.user?.tenantId;

// 2. Check tenant is active (cached in Redis for 5 min)
const cacheKey = `tenant:active:${tenantId}`;
let isActive = await cacheService.get<boolean>(cacheKey);

if (isActive === null) {
    const tenant = await tenantService.getById(tenantId);
    isActive = tenant.isActive;
    await cacheService.set(cacheKey, isActive, CacheTTL.MEDIUM);
}

// 3. Block if tenant is inactive
if (!isActive) {
    res.status(403).json({ error: 'Tenant is inactive' });
}

// 4. Attach tenantId for downstream use
req.tenantId = tenantId;
```

Every repository and service layer query then includes `tenantId` as a filter condition.

---

## Authentication & Token Architecture

### Token Flow

```
┌────────────┐                    ┌────────────────┐
│   Client   │                    │     Server     │
│            │                    │                │
│   POST /auth/login              │                │
│   {email, password, tenant}────▶│                │
│            │                    │  1. Find user  │
│            │                    │  2. Verify pwd │
│            │                    │  3. Check lock │
│            │                    │  4. Audit log  │
│            │◀────────────────── │  5. Generate:  │
│            │  {                 │     Access  (15m)
│            │    accessToken,    │     Refresh (7d)
│            │    refreshToken,   │                │
│            │    user            │                │
│            │  }                 │                │
│            │                    │                │
│  Store in  │                    │                │
│  localStorage                   │                │
│            │                    │                │
│   API call with                 │                │
│   Authorization: Bearer <access>│                │
│   ─────────────────────────────▶│  Verify JWT    │
│            │                    │  Check tokenVer│
│            │                    │  (cached 60s)  │
│            │                    │                │
│   On 401:                       │                │
│   POST /auth/refresh            │                │
│   {refreshToken} ──────────────▶│  Verify refresh│
│            │                    │  Check version │
│            │◀───────────────────│  New pair      │
│   Replace tokens                │  (rotation)    │
└────────────┘                    └────────────────┘
```

### Token Revocation

Tokens are revoked by incrementing `user.tokenVersion`:

```
Password Change → tokenVersion++ → all existing tokens invalid
Account Deactivation → isActive=false → authenticate rejects
Forced Logout → tokenVersion++ → must re-authenticate
```

The token version is **cached in Redis for 60 seconds** to avoid a DB query on every request.

### Password Reset Flow

```
1. User → POST /auth/forgot-password {email, tenantSlug}
   │  (Always returns success — never reveals email existence)
   │
2. Server → Generate 48-byte crypto token (base64url)
   │  Hash with SHA-256 → store hash in DB
   │  Raw token sent via email (1-hour expiry)
   │  Rate limit: 3 resets per user per hour
   │
3. User → POST /auth/reset-password {rawToken, newPassword}
   │  Hash rawToken → find in DB
   │  Verify not expired, not used
   │  Validate password strength
   │  Update password + tokenVersion++ (revoke all sessions)
   │  Mark token as used
   │  Invalidate all other pending tokens for this user
```

---

## RBAC Architecture

### Permission Model

The RBAC system uses a **3-dimensional permission matrix**:

```
Permission = Role × Resource × Action → Scope

Roles (10):     STUDENT, TEACHER, DEPARTMENT_ADMIN, SUPER_ADMIN,
                COE, CLERK, ADMISSIONS_ADMIN, ADMIN_CLERK,
                FIRST_YEAR_COORDINATOR, PARENT

Resources (14): USER_PROFILE, DEPARTMENT, PROGRAM, COURSE, SEMESTER,
                SUBJECT, ENROLLMENT, ASSIGNMENT, SUBMISSION,
                ATTENDANCE, MARKS, CERTIFICATE, NOTIFICATION, AUDIT_LOG

Actions (5):    CREATE, READ, UPDATE, DELETE, PUBLISH

Scopes (4):     OWN → ASSIGNED → DEPARTMENT → ALL
```

### Middleware Guards

```typescript
// Role-based guard factory
export const requireRole = (...allowedRoles: UserRole[]) =>
    (req, res, next) => {
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };

// Pre-configured guards
superAdminOnly     = requireRole('SUPER_ADMIN');
coeOnly            = requireRole('COE');
adminOnly          = requireRole('DEPARTMENT_ADMIN', 'SUPER_ADMIN', 'ADMISSIONS_ADMIN');
teacherOrAbove     = requireRole('TEACHER', 'DEPARTMENT_ADMIN', 'SUPER_ADMIN');
admissionsStaff    = requireRole('ADMISSIONS_ADMIN', 'ADMIN_CLERK');

// Permission-based guard (resource + action)
requirePermission('MARKS', 'PUBLISH')
// → checks RBAC_MATRIX[role].MARKS.actions.includes('PUBLISH')
```

---

## Database Architecture

### Schema Design

The Prisma schema (1495 lines) defines **40+ models** with these design patterns:

| Pattern | Implementation |
|---|---|
| **Multi-tenancy** | Every model has `tenantId` FK → `Tenant` |
| **Soft state** | Semesters use lifecycle enum: ACTIVE → CLOSED → ARCHIVED |
| **Audit trail** | All mutations create AuditLog entries |
| **Temporal data** | `createdAt` + `updatedAt` on every model |
| **Composite uniqueness** | `@@unique([tenantId, email])`, `@@unique([tenantId, slug])` |
| **Strategic indexes** | 50+ indexes for query performance |
| **Cascading deletes** | Parent deletion cascades to children where appropriate |

### Connection Management

```
Production:
  Client App ──▶ PgBouncer (port 6432) ──▶ PostgreSQL (port 5432)
                     │
                     ├─ Pool Mode: transaction
                     ├─ Max Client Connections: 2000
                     ├─ Default Pool Size: 50
                     ├─ Min Pool Size: 10
                     ├─ Reserve Pool Size: 20
                     ├─ Server Idle Timeout: 600s
                     └─ Client Idle Timeout: 300s

Cloud (Supabase):
  Client App ──▶ Supavisor (port 6543) ──▶ PostgreSQL (port 5432)
                 (managed pooler)

Prisma Config (dual URL):
  DATABASE_URL        = pooled connection (runtime)
  DIRECT_DATABASE_URL = direct connection (migrations only)
```

### Migration Strategy

| Environment | Approach |
|---|---|
| **Development** | `prisma migrate dev` (creates migration files) |
| **Production** | `prisma db push` (schema-push, no migration files) |
| **CI/CD** | `prisma generate` only (no DB access in CI) |

> **Note**: The project uses `prisma db push` in production for rapid iteration. The codebase recommends switching to `prisma migrate deploy` with a proper baseline once stable.

### Audit Log Immutability

Audit logs are protected at the **ORM level** using a Prisma client extension:

```typescript
const client = baseClient.$extends({
    query: {
        auditLog: {
            async delete() {
                throw new Error('Audit logs are immutable and cannot be deleted');
            },
            async deleteMany() {
                throw new Error('Audit logs are immutable and cannot be deleted');
            },
        },
    },
});
```

This means **no code path** — not even direct Prisma calls — can delete audit records.

### Retry & Resilience

The `withRetry` utility wraps database operations with exponential backoff:

```
Retryable Prisma Codes:
  P1001 ─ Can't reach database server
  P1002 ─ Database server timed out
  P1008 ─ Operations timed out
  P1017 ─ Server closed connection
  P2034 ─ Transaction deadlock

Retry Strategy:
  Attempt 1: immediate
  Attempt 2: +200ms
  Attempt 3: +400ms
  Attempt 4: +800ms (final)
```

---

## Caching Architecture

### Cache Tiers

```
┌─────────────────────────────────────────────────────────┐
│                    Cache Tiers                           │
├───────────────┬──────────┬──────────────────────────────┤
│ Tier          │ TTL      │ Data Type                    │
├───────────────┼──────────┼──────────────────────────────┤
│ SHORT         │ 60s      │ Attendance, marks, dashboard │
│ MEDIUM        │ 5 min    │ User data, subject lists     │
│ LONG          │ 30 min   │ Departments, programs, batches│
│ VERY_LONG     │ 1 hour   │ Department metadata          │
│ DAY           │ 24 hours │ Static configuration         │
└───────────────┴──────────┴──────────────────────────────┘

Cache Key Format: api:{tenantId}:{url}
  → Ensures complete tenant isolation in cache
```

### Cache Stampede Prevention

The cache service implements two stampede prevention mechanisms:

**1. Singleflight Pattern** — When N concurrent requests miss the same cache key, only the first executes the fetch function. All others await its promise:

```
Request A ──▶ cache miss ──▶ fetchFn() ──┐
Request B ──▶ cache miss ──▶ inflight.get(key) ──▶ await existing promise
Request C ──▶ cache miss ──▶ inflight.get(key) ──▶ await existing promise
                                         │
                                         ▼
                              All 3 get same result
```

**2. TTL Jitter** — ±10% random variation on cache TTL prevents synchronized mass expiry:

```
Base TTL: 300s → Actual TTL: 270s to 330s (random per key)
```

### Cache Invalidation

```
Pattern-based deletion using SCAN (safe at scale):
  await cacheService.deletePattern('api:*:/api/departments*');

Transactional invalidation after writes:
  await cacheService.invalidateOnWrite([
    'dept:123',
    'api:1:/api/departments'
  ]);
```

---

## Background Jobs & Queues

### Periodic Cleanup (6-hour interval)

The server's `setInterval` runs every 6 hours:

```
Every 6 hours:
  1. Clean expired password reset tokens
  2. Clean old email logs (>30 days, delivered)
  3. Clean resolved system errors (>7 days)
  4. Log cleanup results to Pino
```

### Email Queue (BullMQ)

```
Email Send Request
  │
  ├─ Redis available?
  │     YES → Queue via BullMQ (background worker)
  │     NO  → Direct send (blocking, fallback)
  │
  ▼
BullMQ Worker
  ├─ Attempt delivery via configured provider
  │     ├─ Brevo HTTP API (preferred for cloud)
  │     ├─ SMTP/Nodemailer (traditional)
  │     └─ Console log (development fallback)
  │
  ├─ On success → EmailLog status = SENT
  └─ On failure → EmailLog status = FAILED (retry available)
```

---

## Email & Notification Architecture

```
┌────────────────────────────────────────────────┐
│              Email Provider Chain               │
│                                                │
│  1. Brevo HTTP API (BREVO_API_KEY set?)        │
│     └─ Preferred for Railway/cloud deploy      │
│                                                │
│  2. SMTP / Nodemailer (SMTP_USER set?)         │
│     └─ Gmail, SendGrid, etc.                   │
│                                                │
│  3. Console Logger (fallback)                  │
│     └─ Prints email content to stdout          │
│                                                │
│  All emails logged to EmailLog table:          │
│  ├─ PENDING → SENT / FAILED                   │
│  ├─ Tenant-scoped                              │
│  ├─ User-linked                                │
│  └─ Retryable from developer dashboard         │
└────────────────────────────────────────────────┘

SMS Notifications (Optional):
  └─ Fast2SMS API → Parent absence alerts
```

---

## File Storage Architecture

```
┌───────────────────────────────────────┐
│         Storage Service               │
│                                       │
│  S3_ENDPOINT set?                     │
│    YES → AWS SDK S3 Client            │
│          (R2, MinIO, Backblaze, etc.) │
│    NO  → Local filesystem             │
│          (uploads/ directory)         │
│                                       │
│  Used for:                            │
│  ├─ Timetable PDFs/images            │
│  ├─ Tenant logos & login backgrounds  │
│  ├─ Admission form logos              │
│  └─ Excel uploads (semester marks)    │
└───────────────────────────────────────┘
```

---

## Error Handling Architecture

### Structured Error Codes

```typescript
// Typed error codes with HTTP status mapping
ERROR_CODES = {
    INVALID_CREDENTIALS:  { status: 401, message: '...' },
    ACCOUNT_LOCKED:       { status: 423, message: '...' },
    ACCOUNT_DEACTIVATED:  { status: 403, message: '...' },
    TOKEN_EXPIRED:        { status: 401, message: '...' },
    TOKEN_REVOKED:        { status: 401, message: '...' },
    FORBIDDEN:            { status: 403, message: '...' },
    TENANT_INACTIVE:      { status: 403, message: '...' },
    WRONG_TENANT:         { status: 404, message: '...' },  // Don't reveal cross-tenant
    VALIDATION_FAILED:    { status: 400, message: '...' },
    DUPLICATE_ENTRY:      { status: 409, message: '...' },
    NOT_FOUND:            { status: 404, message: '...' },
    RATE_LIMITED:          { status: 429, message: '...' },
    SEMESTER_LOCKED:      { status: 403, message: '...' },
    MARKS_FINALIZED:      { status: 403, message: '...' },
};

// Usage in services:
throw ApiError.fromCode('ACCOUNT_LOCKED', {
    message: `Try again in ${minutesLeft} minutes`
});
```

### Error Handler Pipeline

```
Error thrown in service/route
  │
  ├─ ApiError? → status + message + error code
  │
  ├─ PrismaClientKnownRequestError?
  │   ├─ P2002 (unique violation) → 409 Conflict
  │   ├─ P2025 (not found)        → 404 Not Found
  │   └─ P2003 (FK violation)     → 400 Bad Request
  │
  ├─ PrismaClientValidationError? → 400 (dev message in dev mode)
  │
  ├─ PrismaClientInitializationError? → 503 Service Unavailable
  │
  ├─ ZodError? → 400 + validation details
  │
  ├─ TypeError (null deref)? → 400 + safe message
  │
  ├─ Message-based inference (fallback):
  │   ├─ "not found"         → 404
  │   ├─ "invalid credentials" → 401
  │   ├─ "already exists"    → 409
  │   ├─ "unauthorized"      → 403
  │   └─ "is required"       → 400
  │
  └─ Default → 500 Internal Server Error
       (dev-only: includes error message)

ALL errors are logged to SystemError table (async, non-blocking)
```

---

## Infrastructure & Deployment

### Docker Architecture

```
┌─── docker-compose.yml ──────────────────────────────────┐
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  postgres    │  │   pgbouncer  │  │    redis     │  │
│  │  (16-alpine) │  │  (pool:txn)  │  │  (7-alpine)  │  │
│  │  Port: 5432  │──│  Port: 6432  │  │  Port: 6379  │  │
│  │  Health: ✓   │  │              │  │  Health: ✓   │  │
│  │  Vol: data   │  │              │  │  Vol: data   │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   server    │  │    client    │  │    backup    │  │
│  │  (Express)  │  │  (Next.js)  │  │  (pg_dump)   │  │
│  │  Port: 4001 │  │  Port: 3001 │  │  Daily, 7d   │  │
│  │  tini PID1  │  │  standalone  │  │  retention   │  │
│  │  non-root   │  │  non-root   │  │              │  │
│  └─────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘

Standalone Dockerfiles (for Railway/Render):
├── Dockerfile.server  (multi-stage: build → runtime)
│   └── Entrypoint: prisma db push → node dist/src/index.js
└── Dockerfile.client  (multi-stage: deps → build → runtime)
    └── Build arg: NEXT_PUBLIC_API_URL baked into JS bundle
```

### CI/CD Pipeline

```
GitHub Actions (on push/PR to main):

┌─── lint-build-test ────────────────────────────────────┐
│                                                        │
│  Service Container: PostgreSQL 16-alpine               │
│  Environment: NODE_ENV=test, LOG_LEVEL=silent          │
│                                                        │
│  Steps:                                                │
│  1. ✅ Checkout                                        │
│  2. ✅ Setup Node.js 20 (with npm cache)               │
│  3. ✅ npm ci                                          │
│  4. ✅ prisma generate (server)                        │
│  5. ✅ Lint (client)                                   │
│  6. ✅ Build server (tsc)                              │
│  7. ✅ Build client (next build)                       │
│  8. ✅ Run server tests (vitest)                       │
└────────────────────────────────────────────────────────┘
```

### Production Topology

```
┌─── Render ─────────────────────┐    ┌─── Netlify ──────────────┐
│  acadops-api                   │    │  Next.js SSR             │
│  ├─ Node.js service            │    │  ├─ @netlify/plugin-nextjs│
│  ├─ Build: prisma generate →   │    │  ├─ Base: client/        │
│  │         migrate → tsc       │    │  └─ Env: NEXT_PUBLIC_    │
│  ├─ Health: /api/health        │    │       API_URL            │
│  └─ Auto-generated secrets     │    └──────────────────────────┘
└────────────────────────────────┘
           │
           ▼
┌─── Supabase ─────────┐    ┌─── Upstash ──────────┐
│  PostgreSQL           │    │  Redis                │
│  ├─ Supavisor pooler  │    │  ├─ TLS (rediss://)   │
│  └─ Port 6543 (pool)  │    │  └─ REST API fallback │
│         5432 (direct) │    └──────────────────────┘
└───────────────────────┘
```

---

## Performance Optimisations

| Optimisation | Implementation |
|---|---|
| **Response Compression** | `compression` middleware (~70% bandwidth reduction) |
| **Connection Pooling** | PgBouncer (50 pool, 2000 max clients) |
| **Redis Caching** | Tiered TTL (1min → 24hr), tenant-scoped keys |
| **Singleflight** | Deduplicates concurrent cache misses |
| **TTL Jitter** | ±10% prevents cache stampede |
| **Database Indexes** | 50+ strategic indexes across all tables |
| **Pagination** | All list queries paginated (never unbounded) |
| **Slow Query Monitor** | Logs queries >1000ms via Prisma $on('query') |
| **Lazy Connections** | Redis connects in background — doesn't block startup |
| **Static Analysis** | Next.js standalone output for minimal Docker images |
| **Token Version Cache** | User tokenVersion cached 60s to avoid DB hit per request |

---

## Observability

| Layer | Tool | Details |
|---|---|---|
| **Structured Logging** | Pino | JSON logs with request ID, module, duration |
| **Request Tracking** | X-Request-Id | Generated per request, propagated through logs |
| **Error Tracking** | SystemError table | All errors logged with endpoint, method, stack, severity |
| **Email Monitoring** | EmailLog table | PENDING → SENT/FAILED, retry from developer dashboard |
| **Slow Queries** | Prisma $on('query') | Warns on queries >1000ms |
| **Cache Stats** | Redis INFO | Hit rate, key count, memory usage |
| **Health Endpoint** | GET /api/health | DB connectivity, Redis status, uptime, memory |
| **Audit Trail** | AuditLog table | Every state change with actor, IP, user agent, old/new values |
| **Periodic Cleanup** | setInterval (6h) | Expired tokens, old email logs, resolved errors |
