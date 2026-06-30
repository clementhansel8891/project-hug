# --- Stage 1: Build ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache openssl shadow python3 make g++

# Copy package files and install dependencies
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for build)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Generate Prisma Client and Build NestJS
# Raise the V8 heap for the build step: the full NestJS compile exceeds the
# default ~2GB ceiling and OOMs ("Ineffective mark-compacts near heap limit")
# on memory-constrained build hosts. 4GB comfortably fits the current codebase.
RUN ./node_modules/.bin/prisma generate
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build

# --- Stage 2: Runner ---
FROM node:22-alpine AS runner

WORKDIR /app

# Install runtime dependencies for Prisma
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV RUNTIME=docker

# Copy production artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Create professional directory structure for persistent data
RUN mkdir -p /data/backups /data/logs /app/storage/reports /app/uploads && \
    addgroup -S zenvix && adduser -S zenvix -G zenvix && \
    chown -R zenvix:zenvix /data /app/storage /app/prisma /app/uploads

# Use non-root user
USER zenvix

EXPOSE 3001

# Healthcheck to ensure API is responsive
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Entrypoint: Apply migrations and start the server + worker
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:all"]
