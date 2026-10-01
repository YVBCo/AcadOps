# Teacher ERP — Backend Server

A production-grade, multi-tenant academic operations backend for engineering colleges, degree programs, and MBA institutions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | Node.js 20+ with TypeScript (strict mode) |
| **Framework** | Express 5 |
| **Database** | PostgreSQL 16 via Prisma ORM |
| **Cache** | Redis 7 (BullMQ-compatible) |
| **Auth** | JWT (access + refresh) with Argon2id hashing |
| **Validation** | Zod schemas on all endpoints |
| **Logging** | Pino (structured JSON in production) |
| **Testing** | Vitest with mock factories |

## Architecture

```
src/
├── api/
│   ├── middleware/      # Auth, error, sanitize, tenant, cache, request-id
│   └── routes/          # Express route handlers (thin controllers)
├── config/              # Environment, RBAC permissions
├── data-access/         # Prisma repositories (database abstraction)
├── services/            # Business logic (domain services)
│   ├── admissions/      # Admission workflow (CRUD, bulk, USN, queries)
│   ├── teacher/         # Teacher marks & attendance
│   └── mentor/          # Mentor assignment & dashboard
├── utils/               # Logger, param parsing, helpers
└── __tests__/           # Test setup, mocks, factories
```

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- Redis 7+ (optional — gracefully degrades)

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# Edit .env with your database credentials

# 3. Generate Prisma client & push schema
npx prisma generate
npx prisma db push

# 4. (Optional) Seed the database
npm run db:seed

# 5. Start development server
npm run dev
```

### Docker (Recommended)

```bash
# Start everything (app + postgres + redis)
docker compose up -d

# Run database migrations
docker compose exec app npx prisma db push

# View logs
docker compose logs -f app
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run production build |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:push` | Push schema changes to DB |
| `npm run db:migrate` | Create migration |
| `npm run db:seed` | Seed database |

## Environment Variables

See [`.env.example`](.env.example) for all required variables.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Access token signing key (64+ chars) |
| `JWT_REFRESH_SECRET` | ✅ | Refresh token signing key (64+ chars, different from JWT_SECRET) |
| `JWT_EXPIRES_IN` | ✅ | Access token expiry (e.g., `15m`, `7d`) |
| `REDIS_URL` | ❌ | Redis connection (degrades gracefully) |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated CORS origins |
| `PORT` | ❌ | Server port (default: 4000) |

## Security Features

- **Argon2id** password hashing (OWASP recommended)
- **XSS sanitization** via `xss` library on all inputs
- **Helmet** with HSTS, CSP, and referrer policy
- **Rate limiting** — global + per-route (Redis-backed in production)
- **CORS** locked to specific origins
- **Separate JWT secrets** for access (15min) and refresh (7d) tokens
- **Account lockout** after 5 failed login attempts (15min cooldown)
- **Tenant isolation** — enforced globally via middleware
- **Audit trail** — immutable logs (delete-protected via Prisma middleware)
- **Request ID** — UUID per request for distributed tracing

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npx vitest run --coverage

# Run specific test file
npx vitest run src/services/auth.service.test.ts
```

## API Health Check

```bash
curl http://localhost:4000/health
# Returns: { "status": "ok", "checks": { "server": "ok", "database": "ok", "cache": "ok" } }
```

## Multi-Tenancy

Every request is scoped to a tenant. The `enforceTenant` middleware validates the tenant is active before processing. Tenant-unaware routes (auth, public admissions) are explicitly excluded.

## License

Proprietary — All rights reserved.
