# 🔒 Security Guide

> Comprehensive security architecture, threat mitigations, and access control implementation for the Academic Ops Platform.

---

## Table of Contents

- [Security Overview](#security-overview)
- [Defence-in-Depth Layers](#defence-in-depth-layers)
- [Authentication Security](#authentication-security)
  - [Password Security](#password-security)
  - [JWT Token Architecture](#jwt-token-architecture)
  - [Token Revocation](#token-revocation)
  - [Account Lockout](#account-lockout)
  - [Password Reset Security](#password-reset-security)
  - [Developer Authentication](#developer-authentication)
- [Authorisation Security (RBAC)](#authorisation-security-rbac)
  - [Permission Model](#permission-model)
  - [Scope Enforcement](#scope-enforcement)
  - [Separation of Duties](#separation-of-duties)
  - [Hierarchical Audit Log Access](#hierarchical-audit-log-access)
- [Multi-Tenant Data Isolation](#multi-tenant-data-isolation)
  - [Tenant Middleware](#tenant-middleware)
  - [Cache Isolation](#cache-isolation)
  - [Cross-Tenant Prevention](#cross-tenant-prevention)
- [Input Validation & Sanitisation](#input-validation--sanitisation)
  - [Zod Schema Validation](#zod-schema-validation)
  - [XSS Sanitisation](#xss-sanitisation)
  - [Path Traversal Prevention](#path-traversal-prevention)
- [Rate Limiting](#rate-limiting)
  - [Tiered Rate Limiters](#tiered-rate-limiters)
  - [Limiter Configuration](#limiter-configuration)
- [HTTP Security Headers](#http-security-headers)
- [CORS Policy](#cors-policy)
- [Audit Trail & Accountability](#audit-trail--accountability)
  - [Immutable Audit Logs](#immutable-audit-logs)
  - [What Gets Audited](#what-gets-audited)
  - [Audit Log Structure](#audit-log-structure)
  - [Forensic Capabilities](#forensic-capabilities)
- [Error Handling Security](#error-handling-security)
  - [Information Leakage Prevention](#information-leakage-prevention)
  - [Error Response Standardisation](#error-response-standardisation)
- [Data Integrity Controls](#data-integrity-controls)
  - [Semester Locking](#semester-locking)
  - [Section Locking](#section-locking)
  - [Course Locking](#course-locking)
  - [Graduation Lock](#graduation-lock)
  - [Edit Request Workflow](#edit-request-workflow)
- [Database Security](#database-security)
  - [Connection Security](#connection-security)
  - [Query Injection Prevention](#query-injection-prevention)
  - [Retry Resilience](#retry-resilience)
- [Infrastructure Security](#infrastructure-security)
  - [Docker Hardening](#docker-hardening)
  - [Secret Management](#secret-management)
  - [Dependency Security](#dependency-security)
- [Email Security](#email-security)
- [File Upload Security](#file-upload-security)
- [OWASP Top 10 Coverage](#owasp-top-10-coverage)
- [Security Checklist](#security-checklist)

---

## Security Overview

The Academic Ops Platform implements a **defence-in-depth** security model with multiple overlapping layers. Every request traverses at least 6 security checkpoints before reaching application logic.

### Security Principles

| Principle | Implementation |
|---|---|
| **Zero Trust** | Every request is authenticated, tenant-verified, and role-checked |
| **Least Privilege** | 10 roles with granular 4-scope permission model |
| **Defence in Depth** | 7+ security layers (see below) |
| **Fail Secure** | Errors default to 403/401, never reveal internal state |
| **Immutability** | Audit logs cannot be deleted — enforced at ORM level |
| **Separation of Duties** | Super Admin cannot manage courses; COE cannot manage users |

---

## Defence-in-Depth Layers

```
┌────────────────────────────────────────────────────────────────┐
│ Layer 1: HTTP Security Headers (Helmet)                        │
│  ├─ HSTS, X-Frame-Options, X-Content-Type-Options             │
│  ├─ Content-Security-Policy, Referrer-Policy                   │
│  └─ X-XSS-Protection, X-Permitted-Cross-Domain-Policies       │
├────────────────────────────────────────────────────────────────┤
│ Layer 2: CORS (Explicit Origin Allowlist)                      │
│  └─ Only configured origins can make API requests              │
├────────────────────────────────────────────────────────────────┤
│ Layer 3: Rate Limiting (3-tier)                                │
│  ├─ Global: 500 req/15min per IP                               │
│  ├─ Authenticated: 100 req/min per userId                      │
│  └─ Bulk/Export: 10 req/min and 5 req/min                      │
├────────────────────────────────────────────────────────────────┤
│ Layer 4: Input Sanitisation                                    │
│  ├─ XSS sanitisation (body + query params)                     │
│  ├─ Path traversal guard (../ and null bytes)                  │
│  └─ Zod schema validation per route                            │
├────────────────────────────────────────────────────────────────┤
│ Layer 5: Authentication (JWT)                                  │
│  ├─ Access token verification (15-minute expiry)               │
│  ├─ Token version check (instant revocation)                   │
│  └─ Account active status check                                │
├────────────────────────────────────────────────────────────────┤
│ Layer 6: Tenant Enforcement                                    │
│  ├─ Tenant active status check (cached 5 min)                  │
│  └─ All data queries scoped to tenantId                        │
├────────────────────────────────────────────────────────────────┤
│ Layer 7: Authorisation (RBAC)                                  │
│  ├─ Role-based route guards                                    │
│  ├─ Permission-based resource guards                           │
│  └─ Scope enforcement (OWN / ASSIGNED / DEPARTMENT / ALL)      │
├────────────────────────────────────────────────────────────────┤
│ Layer 8: Business Logic Guards                                 │
│  ├─ Semester lock checks                                       │
│  ├─ Section lock checks                                        │
│  ├─ Course lock checks                                         │
│  └─ Edit request approval workflows                            │
└────────────────────────────────────────────────────────────────┘
```

---

## Authentication Security

### Password Security

| Control | Implementation |
|---|---|
| **Hashing Algorithm** | Argon2id (memory-hard, GPU-resistant) |
| **Minimum Length** | 6 characters (configurable) |
| **Storage** | Only hash stored — raw password never persisted |
| **Comparison** | Constant-time comparison via `argon2.verify()` |
| **Change Policy** | Password change increments `tokenVersion` → revokes all sessions |

### JWT Token Architecture

```
Access Token (15 minutes)
├── Payload: userId, email, role, tenantId, tokenVersion
├── Signed with: JWT_SECRET (env variable)
└── Delivered via: Authorization: Bearer <token>

Refresh Token (7 days)
├── Payload: userId, tokenVersion
├── Signed with: JWT_REFRESH_SECRET (env variable)
├── Delivered via: JSON response body
└── Purpose: Obtain new access token without re-login
```

**Token Rotation**: When a refresh token is used, BOTH a new access token AND a new refresh token are issued. The old refresh token cannot be reused because the `tokenVersion` is checked against the database.

### Token Revocation

The platform uses a **token version** strategy for instant revocation without a token blacklist:

```typescript
// JWT payload includes tokenVersion
const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    tokenVersion: user.tokenVersion,  // ← This is the key
};

// On every request, authenticate middleware checks:
// 1. Verify JWT signature
// 2. Extract userId and tokenVersion from payload
// 3. Fetch user.tokenVersion from DB (cached 60s in Redis)
// 4. If payload.tokenVersion !== user.tokenVersion → REJECT

// To revoke all sessions: increment tokenVersion
await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
});
// → All existing tokens are immediately invalid
```

**Revocation Triggers:**
- Password change → `tokenVersion++`
- Account deactivation → `isActive = false` (separate check)
- Admin force-logout → `tokenVersion++`
- Password reset → `tokenVersion++`

**Cache Tradeoff**: Token version is cached in Redis for 60 seconds. This means a revoked token may work for up to 60 seconds after revocation. This is an acceptable trade-off for the massive reduction in database queries (every API call would otherwise hit the DB).

### Account Lockout

```
Login Failure Tracking:
  Each failed attempt → failedLoginAttempts++, lastFailedAt = now

  After 5 consecutive failures:
    → Account locked for 15 minutes
    → Returns: "Account locked. Try again in X minutes"
    → Timer based on lastFailedAt + 15 minutes

  Successful login:
    → Reset failedLoginAttempts = 0
    → Reset lastFailedAt = null
```

### Password Reset Security

| Control | Detail |
|---|---|
| **Token Generation** | 48-byte `crypto.randomBytes` → Base64url encoded |
| **Token Storage** | SHA-256 hash stored in DB — raw token only sent via email |
| **Token Expiry** | 1 hour from generation |
| **Single Use** | Token marked as `used` after consumption |
| **Rate Limit** | Max 3 reset requests per user per hour |
| **Enumeration Prevention** | Always returns success — never reveals if email exists |
| **Post-Reset Actions** | `tokenVersion++` (revokes all sessions) + invalidates all other pending tokens |
| **Email Timing** | No timing side-channel — response time is constant |

### Developer Authentication

Developer accounts use a completely separate authentication flow:

| Aspect | Developer Auth | User Auth |
|---|---|---|
| **Model** | `Developer` | `User` |
| **Login Endpoint** | `/api/dev/login` | `/api/auth/login` |
| **Token Storage** | `dev-token` (localStorage) | `auth-storage` (localStorage) |
| **Tenant Context** | None (above tenants) | Always scoped to a tenant |
| **Registration** | Manual DB seed only | Via Admin/Admissions |
| **Password Hash** | Argon2id | Argon2id |

---

## Authorisation Security (RBAC)

### Permission Model

The RBAC system uses a **3-dimensional permission matrix**:

```
Permission = Role × Resource × Action → Scope

10 Roles × 14 Resources × 5 Actions → 4 Scope Levels

Scopes (ascending privilege):
  OWN       → Only the user's own records
  ASSIGNED  → Records for subjects/students assigned to the user
  DEPARTMENT→ All records within the user's department
  ALL       → All records across the entire tenant
```

### Scope Enforcement

Scope enforcement happens at **two levels**:

**1. Route-level guards** (who can call the endpoint):
```typescript
// Only these roles can access the route
router.get('/', requireRole('SUPER_ADMIN', 'DEPARTMENT_ADMIN'));

// Or using permission-based check
router.post('/', requirePermission('MARKS', 'CREATE'));
```

**2. Service-level data filtering** (what data they see):
```typescript
// Dept Admin sees only their department's data
if (user.role === 'DEPARTMENT_ADMIN') {
    where.departmentId = user.departmentId;
}

// Teacher sees only assigned subjects
if (user.role === 'TEACHER') {
    where.teacherProfileId = user.teacherProfile.id;
}

// Student sees only own data
if (user.role === 'STUDENT') {
    where.studentId = user.studentProfile.id;
}
```

### Separation of Duties

Critical operations are split across roles to prevent single-point abuse:

```
┌─────────────────────────────────────────────────────────────┐
│              Separation of Duties Matrix                     │
├─────────────────────┬───────────────┬───────────────────────┤
│ Operation           │ Who CAN       │ Who CANNOT            │
├─────────────────────┼───────────────┼───────────────────────┤
│ Create courses      │ COE           │ Super Admin (read-only)│
│ Lock courses        │ COE           │ All others             │
│ Assign permanent USN│ COE, Clerk    │ Admissions Admin       │
│ Assign temp USN     │ Admissions    │ COE, Clerk             │
│ Delete users        │ Super Admin   │ Dept Admin (dept only) │
│ Manage semesters    │ Super Admin   │ COE (read only)        │
│ Publish marks       │ Dept Admin,   │ Teacher                │
│                     │ Super Admin   │                        │
│ Enter internal marks│ Teacher       │ Dept Admin (edit only) │
│ Enter semester marks│ Clerk         │ All others             │
│ Approve results     │ COE           │ All others             │
│ Delete audit logs   │ NOBODY        │ EVERYONE (ORM-level)   │
└─────────────────────┴───────────────┴───────────────────────┘
```

### Hierarchical Audit Log Access

Audit log visibility follows the organisational hierarchy. Each role can **only** see logs from their direct subordinates:

```
Hierarchy:
  Super Admin → sees ALL logs (every role in tenant)
  COE → sees CLERK logs
  Admissions Admin → sees ADMIN_CLERK logs
  Department Admin → sees TEACHER logs (within department)
  FY Coordinator → sees logs from cycle (basic science) departments

Nobody can see Super Admin's own logs (except the Super Admin themselves).
```

---

## Multi-Tenant Data Isolation

### Tenant Middleware

The `enforceTenant` middleware runs after JWT verification:

```typescript
export const enforceTenant = async (req, res, next) => {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
        return res.status(403).json({ error: 'Tenant context missing' });
    }

    // Cached check — avoids DB hit on every request
    const cacheKey = `tenant:active:${tenantId}`;
    let isActive = await cacheService.get<boolean>(cacheKey);

    if (isActive === null) {
        const tenant = await tenantService.getById(tenantId);
        isActive = tenant?.isActive ?? false;
        await cacheService.set(cacheKey, isActive, CacheTTL.MEDIUM);
    }

    if (!isActive) {
        return res.status(403).json({
            error: 'Tenant is inactive. Contact support.'
        });
    }

    req.tenantId = tenantId;
    next();
};
```

### Cache Isolation

All Redis cache keys are namespaced by tenant:

```
Cache key format: api:{tenantId}:{url}

Example:
  Tenant 1: api:1:/api/departments      ← Tenant 1's departments
  Tenant 2: api:2:/api/departments      ← Tenant 2's departments
  
  These are COMPLETELY SEPARATE cache entries.
  No tenant can read another tenant's cached data.
```

### Cross-Tenant Prevention

| Layer | Protection |
|---|---|
| **JWT** | `tenantId` embedded in token payload — cannot be changed |
| **Middleware** | `enforceTenant` validates tenant is active |
| **Repository** | Every query includes `WHERE tenantId = ?` |
| **Cache** | Keys prefixed with `tenantId` |
| **Error Messages** | Cross-tenant access returns "Not found" (404), NOT "Forbidden" (403) — prevents tenant enumeration |
| **Audit Logs** | `tenantId` stored on every log — prevents cross-tenant log leakage |

---

## Input Validation & Sanitisation

### Zod Schema Validation

Every route that accepts user input uses **Zod schemas** for strict runtime validation:

```typescript
const createDepartmentSchema = z.object({
    name: z.string().min(1).max(255),
    code: z.string().min(2).max(10).regex(/^[A-Z]+$/),
    description: z.string().optional(),
    isCycleDepartment: z.boolean().default(false),
});

// In route handler:
const data = createDepartmentSchema.parse(req.body);
// If validation fails → ZodError → errorHandler → 400 with details
```

**Validation characteristics:**
- Type checking (string, number, boolean, enum)
- Length constraints (min, max)
- Pattern matching (regex for codes, USNs, emails)
- Enum validation (role names, status values)
- Optional fields with defaults
- Nested object validation

### XSS Sanitisation

The `sanitizeRequest` middleware sanitises all incoming data:

```typescript
import xss from 'xss';

export function sanitizeRequest(req, res, next) {
    // Sanitise request body (recursively)
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }

    // Sanitise query params
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }

    next();
}

function sanitizeObject(obj) {
    // Recursively walk the object
    // For every string value: xss(value)
    // Strips: <script>, onclick=, javascript:, etc.
}
```

**What gets stripped:**
- `<script>` tags and their content
- Event handlers (`onclick`, `onerror`, etc.)
- `javascript:` protocol URLs
- HTML entities that could execute code
- Malformed HTML that browsers might interpret as executable

### Path Traversal Prevention

A static file guard runs on every request before routing:

```typescript
// Block path traversal attempts
if (req.path.includes('..') || req.path.includes('%00')) {
    return res.status(400).json({ error: 'Invalid path' });
}
```

---

## Rate Limiting

### Tiered Rate Limiters

```
                          ┌────────────────────┐
                          │  Global Limiter     │
                          │  500 req / 15 min   │
                          │  Per IP address     │
                          └─────────┬──────────┘
                                    │
                                    ▼
                          ┌────────────────────┐
                          │  Auth Limiter       │
                          │  100 req / 1 min    │
                          │  Per userId         │
                          └─────────┬──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
          ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
          │ Bulk Limiter │ │Export Limiter │ │ Login Limiter│
          │ 10 req/min   │ │ 5 req/min    │ │ Account lock │
          │ Per userId   │ │ Per userId   │ │ after 5 fails│
          └──────────────┘ └──────────────┘ └──────────────┘
```

### Limiter Configuration

| Limiter | Window | Max Requests | Key | Store |
|---|---|---|---|---|
| **Global** | 15 minutes | 500 (prod) / 1000 (dev) | IP address | Memory / Redis |
| **Authenticated** | 1 minute | 100 | `userId` | Memory / Redis |
| **Bulk Operations** | 1 minute | 10 | `userId` | Memory / Redis |
| **Data Export** | 1 minute | 5 | `userId` | Memory / Redis |
| **Login Attempts** | Cumulative | 5 (then 15-min lock) | `userId` | Database |
| **Password Reset** | 1 hour | 3 | `userId` | Database |

**Redis vs Memory**: When Redis is available, rate limit counters are stored in Redis (shared across server instances). When Redis is unavailable, in-memory stores are used (per-instance, less accurate in multi-instance deployments).

---

## HTTP Security Headers

The platform uses **Helmet.js** which sets 11 security headers:

| Header | Value | Purpose |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Force HTTPS for 1 year |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | Prevent clickjacking via iframes |
| `X-XSS-Protection` | `0` | Disable buggy browser XSS filter (CSP used instead) |
| `Content-Security-Policy` | `default-src 'self'` | Restrict resource loading sources |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `X-Permitted-Cross-Domain-Policies` | `none` | Block Flash/PDF cross-domain access |
| `X-DNS-Prefetch-Control` | `off` | Prevent DNS prefetch information leakage |
| `X-Download-Options` | `noopen` | Prevent IE from opening downloads |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolate cross-origin windows |
| `Cross-Origin-Resource-Policy` | `same-origin` | Block cross-origin resource loading |

---

## CORS Policy

```typescript
const corsOptions = {
    origin: process.env.CORS_ORIGINS?.split(',') || [
        'http://localhost:3001',  // Dev client
    ],
    credentials: true,           // Allow cookies/auth headers
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    maxAge: 86400,               // Preflight cache: 24 hours
};
```

**Key controls:**
- **Explicit allowlist** — No wildcards (`*`) in production
- **Credentials enabled** — Required for cookie-based auth headers
- **Limited methods** — Only necessary HTTP methods allowed
- **Specific headers** — Only Content-Type, Authorization, X-Request-Id

---

## Audit Trail & Accountability

### Immutable Audit Logs

Audit log immutability is enforced at the **ORM level**, not just the application layer:

```typescript
// In prisma.ts — Prisma client extension
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

**This means:**
- ✅ `prisma.auditLog.create()` — works
- ✅ `prisma.auditLog.findMany()` — works
- ❌ `prisma.auditLog.delete()` — **throws error**
- ❌ `prisma.auditLog.deleteMany()` — **throws error**
- No code path in the entire application can delete audit records
- Even if a developer accidentally writes a delete query, it will be blocked

### What Gets Audited

Every state-changing operation creates an audit log entry:

| Category | Events |
|---|---|
| **Authentication** | Login success, login failure, password change, password reset, logout |
| **User Management** | User create, update, deactivate, role change, bulk import |
| **Academic Structure** | Department CRUD, program CRUD, course CRUD, semester lifecycle |
| **Enrollment** | Student admission, section assignment, subject enrollment |
| **Assessment** | Marks entry, marks edit, marks finalise, marks publish |
| **Attendance** | Attendance mark, attendance edit, attendance lock |
| **Course Operations** | Course lock, course allocation, teacher assignment |
| **Administrative** | Edit request create/approve/reject, section lock, batch graduation |
| **USN Management** | Temporary USN allocation, permanent USN assignment |
| **Mentorship** | Mentor assignment, observation creation, interaction logging |

### Audit Log Structure

```typescript
interface AuditLog {
    id: number;
    tenantId: number;           // Tenant isolation
    actorId: number;            // Who performed the action (FK → User)
    action: string;             // e.g., "UPDATE_MARKS", "LOGIN_SUCCESS"
    entityType: string;         // e.g., "User", "Marks", "Attendance"
    entityId: number;           // ID of the affected entity
    oldValue: JsonValue;        // Previous state (for updates)
    newValue: JsonValue;        // New state
    ipAddress: string;          // Client IP address
    userAgent: string;          // Client browser/device info
    timestamp: DateTime;        // UTC timestamp (auto-set)
}
```

### Forensic Capabilities

The audit log system supports forensic queries:

| Query | Endpoint | Access |
|---|---|---|
| **Hierarchical list** | `GET /audit-logs` | Super Admin (ALL), COE (Clerks), Admissions Admin (Admin Clerks), Dept Admin (Teachers), FYC (cycle depts) |
| **By entity** | `GET /audit-logs/entity/:type/:id` | All 5 admin roles |
| **By actor** | `GET /audit-logs/actor/:actorId` | Super Admin only |
| **By department** | `GET /audit-logs/department/:departmentId` | Super Admin (any), Dept Admin (own), FYC (cycle depts only) |
| **Statistics** | `GET /audit-logs/stats` | Super Admin only |

---

## Error Handling Security

### Information Leakage Prevention

```typescript
// Production error responses NEVER include:
// ❌ Stack traces
// ❌ Database error details
// ❌ Internal file paths
// ❌ SQL queries
// ❌ Prisma model names (in raw form)

// Development mode CAN include error messages for debugging
if (process.env.NODE_ENV === 'development') {
    errorResponse.detail = error.message;
}
```

**Specific mitigations:**

| Scenario | Production Response |
|---|---|
| Database error (Prisma) | Generic "Internal server error" (500) |
| Cross-tenant access attempt | "Not found" (404) — NOT "Forbidden" |
| Invalid email on login | "Invalid credentials" (401) — NOT "Email not found" |
| Password reset for unknown email | "If account exists, email was sent" (200) |
| Rate limit exceeded | "Too many requests" (429) with `Retry-After` header |
| Validation error | 400 with field-level details (safe — user's own input) |

### Error Response Standardisation

All errors flow through a centralised error handler that:

1. **Maps known errors** to appropriate HTTP status codes
2. **Logs the full error** (including stack trace) to the `SystemError` table
3. **Returns a sanitised response** to the client
4. **Never exposes internal details** in production

```typescript
// Error code system prevents accidental information leakage
throw ApiError.fromCode('WRONG_TENANT');
// → Returns 404 "Not found" (intentionally misleading)
// → Attacker cannot distinguish between "wrong tenant" and "doesn't exist"
```

---

## Data Integrity Controls

### Semester Locking

```
When a batch progresses from Semester N to N+1:
  → All Semester N data becomes READ-ONLY
  → Marks, attendance, submissions are frozen
  → Only exceptions: makeup exams, revaluations

  Guard: Services check semester status before writes
    if (semester.status !== 'ACTIVE') {
        throw ApiError.fromCode('SEMESTER_LOCKED');
    }
```

### Section Locking

```
When a section is locked:
  → Student roster is frozen
  → No add/remove student operations
  → Course allocations and attendance still work

  Guard: Section lock check before student operations
    if (section.isLocked) {
        throw new Error('Section is locked. Cannot modify roster.');
    }
```

### Course Locking

```
When COE locks a course:
  → Course details (name, code, credits) become immutable
  → Marks split (internal/external) becomes immutable
  → Marks CAN still be entered against the course

  Guard: Lock check before course edits
    if (course.isLocked) {
        throw new Error('Course is locked by COE');
    }
```

### Graduation Lock

```
When a batch is graduated:
  → ALL data across ALL semesters → READ-ONLY
  → No modifications allowed (no exceptions)
  → Most restrictive lock in the system

  Guard: Batch graduation check
    if (batch.status === 'GRADUATED') {
        throw new Error('Cannot modify data for graduated batch');
    }
```

### Edit Request Workflow

When data is locked, edits require an approval workflow:

```
Teacher wants to edit locked attendance:
  1. Teacher creates EditRequest (reason, proposed changes)
  2. EditRequest status = PENDING
  3. Dept Admin reviews:
     ├─ APPROVED → system applies the change, logs both old and new values
     └─ REJECTED → no change, teacher notified

  All steps are audit-logged with full old/new value tracking.
```

---

## Database Security

### Connection Security

| Control | Implementation |
|---|---|
| **TLS** | Database connections use SSL/TLS in production |
| **Connection Pooling** | PgBouncer (50 pool size, transaction mode) |
| **Credential Storage** | `DATABASE_URL` in environment variables only |
| **Dual URLs** | Pooled URL for runtime, direct URL for migrations |
| **Idle Timeout** | 300s client-side, 600s server-side |

### Query Injection Prevention

**Prisma ORM** provides parameterised queries by default:

```typescript
// This is SAFE — Prisma parameterises the input
const user = await prisma.user.findUnique({
    where: { email: userInput },  // Parameterised, not string-concatenated
});

// Raw queries (if any) use tagged templates:
const result = await prisma.$queryRaw`
    SELECT * FROM "User" WHERE email = ${userInput}
`;
// The ${userInput} is parameterised, NOT string-interpolated
```

**No raw SQL string concatenation exists in the codebase.**

### Retry Resilience

Database operations use exponential backoff for transient failures:

```
Retryable errors: P1001, P1002, P1008, P1017, P2034
  Attempt 1: immediate
  Attempt 2: 200ms delay
  Attempt 3: 400ms delay
  Attempt 4: 800ms delay (final)

Non-retryable errors: fail immediately (validation, constraint violations)
```

---

## Infrastructure Security

### Docker Hardening

| Control | Implementation |
|---|---|
| **Non-root user** | Containers run as `node` user (UID 1001), not root |
| **PID 1 handling** | `tini` used as init process (proper signal handling) |
| **Multi-stage builds** | Build dependencies not present in runtime image |
| **Minimal base** | `node:22-alpine` (smallest attack surface) |
| **Read-only layers** | Docker layers cached and immutable |
| **Health checks** | Docker HEALTHCHECK configured for auto-restart |

### Secret Management

```
Environment Variables (NEVER committed to git):
├── JWT_SECRET              ← Token signing key
├── JWT_REFRESH_SECRET      ← Refresh token signing key
├── DATABASE_URL            ← Database connection (with credentials)
├── DIRECT_DATABASE_URL     ← Direct DB connection (migrations)
├── REDIS_URL               ← Redis connection
├── BREVO_API_KEY           ← Email provider API key
├── SMTP_USER / SMTP_PASS   ← SMTP credentials
├── FAST2SMS_API_KEY        ← SMS provider API key
├── S3_ACCESS_KEY_ID        ← Object storage credentials
├── S3_SECRET_ACCESS_KEY    ← Object storage credentials
└── DEV_PASSWORD            ← Developer portal password

.gitignore includes:
├── .env
├── .env.local
├── .env.production
└── .env.*.local
```

### Dependency Security

| Control | Implementation |
|---|---|
| **Lock file** | `package-lock.json` committed — exact versions |
| **Exact versions** | `save-exact=true` in `.npmrc` |
| **CI install** | `npm ci` (not `npm install`) — reproducible builds |
| **Audit** | `npm audit` in CI pipeline |

---

## Email Security

| Control | Implementation |
|---|---|
| **Provider Chain** | Brevo API → SMTP → Console (graceful degradation) |
| **Email Logging** | All emails tracked in `EmailLog` table with status |
| **Reset Tokens** | SHA-256 hashed before storage — raw token only in email |
| **Rate Limiting** | 3 password reset emails per user per hour |
| **Template Safety** | All dynamic content XSS-sanitised before email render |
| **Queue Isolation** | BullMQ workers process emails asynchronously |
| **Retry** | Failed emails can be retried from developer dashboard |

---

## File Upload Security

| Control | Implementation |
|---|---|
| **Size Limits** | JSON body limited to 10MB via Express |
| **Type Validation** | File type checked before processing (Excel, PDF, images) |
| **Storage Isolation** | Files stored with tenant-scoped paths |
| **Access Control** | Storage service respects RBAC (only authorised roles can upload) |
| **Path Sanitisation** | File names sanitised to prevent directory traversal |

---

## OWASP Top 10 Coverage

| # | Vulnerability | Mitigation |
|---|---|---|
| **A01** | Broken Access Control | 10-role RBAC with 4-level scope enforcement, tenant isolation |
| **A02** | Cryptographic Failures | Argon2id for passwords, JWT with proper secrets, SHA-256 for reset tokens |
| **A03** | Injection | Prisma ORM (parameterised queries), Zod validation, XSS sanitisation |
| **A04** | Insecure Design | Separation of duties, edit request workflows, immutable audit logs |
| **A05** | Security Misconfiguration | Helmet headers, strict CSP (frontend + backend), explicit CORS, non-root Docker, env-based config |
| **A06** | Vulnerable Components | `npm ci` with lock file, `save-exact=true`, `npm audit` in CI |
| **A07** | Auth Failures | Account lockout, token versioning, rate limiting, refresh rotation |
| **A08** | Data Integrity Failures | Semester/section/course locking, graduation lock, ORM-level immutability |
| **A09** | Logging & Monitoring | Structured Pino logging, SystemError table, audit trail, request IDs |
| **A10** | SSRF | No user-controlled URL fetching, external APIs only server-side |

---

## Security Checklist

### Before Deployment

- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are strong, unique, and independently generated (min 32 chars each)
- [ ] `JWT_REFRESH_SECRET` is different from `JWT_SECRET` (enforced at startup)
- [ ] `DATABASE_URL` uses SSL/TLS connection
- [ ] `CORS_ORIGINS` is set to exact production domains (no wildcards)
- [ ] `.env` files are NOT in the git repository
- [ ] Docker containers run as non-root user
- [ ] Rate limiter Redis store is configured (not just in-memory)
- [ ] Helmet CSP is configured for production (explicit directives, no `'unsafe-inline'` on backend)
- [ ] Frontend CSP (`next.config.ts`) includes correct `connect-src` for production API
- [ ] `NODE_ENV=production` is set (disables verbose error messages)
- [ ] PgBouncer is configured between app and database
- [ ] SSL certificates are valid and auto-renewing

### Ongoing Monitoring

- [ ] SystemError table is reviewed regularly
- [ ] Audit log volume is monitored (>100k alert)
- [ ] Failed login attempts are tracked (account lockout working)
- [ ] Rate limit hits are logged and reviewed
- [ ] Dependencies are updated monthly (`npm audit`)
- [ ] Redis connection health is monitored
- [ ] Database connection pool utilisation is tracked
