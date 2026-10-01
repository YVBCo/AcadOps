# ──────────────────────────────────────
# Multi-stage Docker Build
# Stage 1: Install dependencies and build
# Stage 2: Production-slim runtime
# ──────────────────────────────────────

# ── Stage 1: Builder ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install system deps needed for native modules (argon2, etc.)
RUN apk add --no-cache python3 make g++ linux-headers

# Copy package files first (cache layer)
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY tsconfig.json ./
COPY src ./src/

# Build TypeScript
RUN npm run build

# ── Stage 2: Production Runtime ───────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Install production-only system deps
RUN apk add --no-cache tini

# Copy package files and install production deps only
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --production --ignore-scripts && \
    npx prisma generate && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Use tini for proper PID 1 signal handling
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["node", "dist/src/index.js"]
