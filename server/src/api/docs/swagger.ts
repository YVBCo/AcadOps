/**
 * OpenAPI / Swagger Documentation Configuration
 * ──────────────────────────────────────
 * Auto-generates API documentation from Zod schemas.
 * Available at /api-docs in development mode.
 */
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Teacher ERP — Backend API',
        version: '2.0.0',
        description: `
Multi-tenant academic operations API for engineering colleges, degree programs, and MBA institutions.

## Authentication
All protected endpoints require a Bearer JWT token in the Authorization header:
\`\`\`
Authorization: Bearer <access_token>
\`\`\`

## Multi-Tenancy
Every authenticated request is scoped to a tenant. The tenant is determined from the JWT payload.

## Rate Limiting
- **Global**: 200 requests per 15-minute window per IP
- **Auth endpoints**: Stricter limits apply (10 req/15min for login)
        `,
        contact: {
            name: 'API Support',
        },
    },
    servers: [
        {
            url: '/api',
            description: 'API Base Path',
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'JWT access token obtained from /api/auth/login',
            },
        },
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string', description: 'Error message' },
                    details: { type: 'object', description: 'Additional error details' },
                },
            },
            LoginRequest: {
                type: 'object',
                required: ['identifier', 'password'],
                properties: {
                    identifier: { type: 'string', description: 'Email or roll number' },
                    password: { type: 'string', description: 'User password' },
                    tenantSlug: { type: 'string', description: 'Institution slug (optional for super admin)' },
                },
            },
            LoginResponse: {
                type: 'object',
                properties: {
                    user: {
                        type: 'object',
                        properties: {
                            id: { type: 'integer' },
                            email: { type: 'string' },
                            name: { type: 'string' },
                            role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'COE', 'DEPARTMENT_ADMIN', 'TEACHER', 'STUDENT', 'CLERK', 'PARENT'] },
                        },
                    },
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                },
            },
            HealthResponse: {
                type: 'object',
                properties: {
                    status: { type: 'string', enum: ['ok', 'degraded'] },
                    checks: {
                        type: 'object',
                        properties: {
                            server: { type: 'string' },
                            database: { type: 'string' },
                            cache: { type: 'string' },
                        },
                    },
                },
            },
            Course: {
                type: 'object',
                properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    code: { type: 'string' },
                    credits: { type: 'integer' },
                    departmentId: { type: 'integer' },
                    tenantId: { type: 'integer' },
                    isLocked: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            CreateCourse: {
                type: 'object',
                required: ['name', 'code', 'credits', 'departmentId'],
                properties: {
                    name: { type: 'string', minLength: 1 },
                    code: { type: 'string', minLength: 1 },
                    credits: { type: 'integer', minimum: 1 },
                    departmentId: { type: 'integer' },
                },
            },
        },
    },
    security: [{ bearerAuth: [] }],
    paths: {
        '/health': {
            get: {
                tags: ['System'],
                summary: 'Health check',
                description: 'Returns server, database, and cache connectivity status',
                security: [],
                responses: {
                    '200': {
                        description: 'System healthy',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
                    },
                    '503': { description: 'System degraded' },
                },
            },
        },
        '/auth/login': {
            post: {
                tags: ['Authentication'],
                summary: 'User login',
                description: 'Authenticate with email/roll number and password. Returns JWT tokens.',
                security: [],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
                },
                responses: {
                    '200': {
                        description: 'Login successful',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } },
                    },
                    '401': { description: 'Invalid credentials' },
                    '429': { description: 'Too many login attempts' },
                },
            },
        },
        '/auth/refresh': {
            post: {
                tags: ['Authentication'],
                summary: 'Refresh access token',
                description: 'Exchange a valid refresh token for a new access token pair.',
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['refreshToken'],
                                properties: { refreshToken: { type: 'string' } },
                            },
                        },
                    },
                },
                responses: {
                    '200': { description: 'New token pair issued' },
                    '401': { description: 'Invalid or expired refresh token' },
                },
            },
        },
        '/courses': {
            get: {
                tags: ['Courses'],
                summary: 'List courses',
                description: 'Get all courses for the authenticated tenant',
                parameters: [
                    { name: 'departmentId', in: 'query', schema: { type: 'integer' }, description: 'Filter by department' },
                ],
                responses: {
                    '200': {
                        description: 'Course list',
                        content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Course' } } } },
                    },
                },
            },
            post: {
                tags: ['Courses'],
                summary: 'Create a course',
                description: 'Create a new course (COE or Admin only)',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateCourse' } } },
                },
                responses: {
                    '201': { description: 'Course created' },
                    '409': { description: 'Course code already exists' },
                },
            },
        },
        '/departments': {
            get: {
                tags: ['Departments'],
                summary: 'List departments',
                description: 'Get all departments for the tenant',
                responses: { '200': { description: 'Department list' } },
            },
        },
        '/dept-admin/students': {
            get: {
                tags: ['Department Admin'],
                summary: 'List students',
                description: 'Get students for the department, optionally filtered by batch/section',
                parameters: [
                    { name: 'batchId', in: 'query', schema: { type: 'integer' } },
                    { name: 'sectionId', in: 'query', schema: { type: 'integer' } },
                    { name: 'unassignedOnly', in: 'query', schema: { type: 'boolean' } },
                ],
                responses: { '200': { description: 'Student list with pagination' } },
            },
        },
        '/dept-admin/sections': {
            get: {
                tags: ['Department Admin'],
                summary: 'List sections',
                responses: { '200': { description: 'Section list' } },
            },
            post: {
                tags: ['Department Admin'],
                summary: 'Create section',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'batchId'],
                                properties: {
                                    name: { type: 'string', maxLength: 50 },
                                    batchId: { type: 'integer' },
                                },
                            },
                        },
                    },
                },
                responses: { '201': { description: 'Section created' } },
            },
        },
        '/dept-admin/teachers': {
            get: {
                tags: ['Department Admin'],
                summary: 'List department teachers',
                responses: { '200': { description: 'Teacher list' } },
            },
            post: {
                tags: ['Department Admin'],
                summary: 'Create teacher account',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'name', 'employeeId'],
                                properties: {
                                    email: { type: 'string', format: 'email' },
                                    name: { type: 'string' },
                                    employeeId: { type: 'string' },
                                    designation: { type: 'string' },
                                },
                            },
                        },
                    },
                },
                responses: { '201': { description: 'Teacher created with email notification' } },
            },
        },
        '/dept-admin/internal-marks': {
            post: {
                tags: ['Department Admin - Marks'],
                summary: 'Record internal marks',
                responses: { '201': { description: 'Marks recorded' } },
            },
        },
        '/dept-admin/internal-marks/bulk': {
            post: {
                tags: ['Department Admin - Marks'],
                summary: 'Bulk record internal marks',
                responses: { '200': { description: 'Bulk marks recorded' } },
            },
        },
        '/dept-admin/mentor-assignments': {
            get: {
                tags: ['Department Admin - Mentors'],
                summary: 'List mentor assignments',
                responses: { '200': { description: 'Assignment list' } },
            },
            post: {
                tags: ['Department Admin - Mentors'],
                summary: 'Assign mentor to students',
                responses: { '201': { description: 'Mentor assigned' } },
            },
        },
    },
    tags: [
        { name: 'System', description: 'Health and system endpoints' },
        { name: 'Authentication', description: 'Login, registration, token refresh' },
        { name: 'Courses', description: 'Course management' },
        { name: 'Departments', description: 'Department management' },
        { name: 'Department Admin', description: 'Department admin operations' },
        { name: 'Department Admin - Marks', description: 'Internal assessment marks' },
        { name: 'Department Admin - Mentors', description: 'Mentor assignment and tracking' },
    ],
};

const docsRouter = Router();

docsRouter.use('/', swaggerUi.serve);
docsRouter.get('/', swaggerUi.setup(openApiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Teacher ERP API Documentation',
}));

// Also expose raw JSON spec for tooling
docsRouter.get('/spec.json', (_req, res) => {
    res.json(openApiSpec);
});

export default docsRouter;
