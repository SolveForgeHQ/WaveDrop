# ─────────────────────────────────────────────────────────────────────────────
# WaveDrop Backend Production Dockerfile
#
# Multi-stage build for a minimal production image.
# We build the backend workspace in the first stage and copy only
# the compiled output and prod dependencies to the final image.
# ─────────────────────────────────────────────────────────────────────────────

# --- Stage 1: Build ---
FROM node:20-alpine AS builder

# Install build tools needed for Prisma/node-gyp
RUN apk add --no-cache python3 make g++ openssl

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy root workspace configs
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy shared package
COPY shared ./shared

# Copy backend package
COPY backend ./backend

# Install all dependencies (dev + prod) using frozen lockfile
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
RUN cd backend && pnpm prisma generate

# Build the shared library (if applicable) and backend
RUN pnpm --filter @wavedrop/backend build

# --- Stage 2: Production ---
FROM node:20-alpine AS runner

# Required for Prisma in alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable

ENV NODE_ENV=production

# Copy root configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy compiled shared package and package.json
COPY --from=builder /app/shared/package.json ./shared/
# Note: if shared has a dist/ directory it should be copied, but currently it's just TS files used in workspace
COPY --from=builder /app/shared/src ./shared/src

# Copy built backend files and dependencies
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma

# Only install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Expose backend port
EXPOSE 4000

# Set working directory to backend for runtime
WORKDIR /app/backend

# Use a non-root user for security
USER node

# Start the Fastify server
CMD ["npm", "start"]
