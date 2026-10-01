/**
 * Global Test Setup
 * ──────────────────────────────────────
 * Runs before all test suites. Sets up environment variables
 * and global mocks required by the application.
 */

// Set test environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-64-characters-long-for-testing-only!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-64-characters-long-for-testing!!';
process.env.JWT_EXPIRES_IN = '15m';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PORT = '4999';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent'; // Suppress logs in tests
