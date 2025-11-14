# =============================================================================
# Multi-stage Dockerfile for NestJS Application
# =============================================================================
# Builder stage: Contains all build tools and dependencies
# Production stage: Minimal runtime image with only compiled code
# Migrator stage: Optional stage for running database migrations
# =============================================================================

# ---- Builder Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install NestJS CLI globally for building
RUN npm install -g @nestjs/cli

# Install all dependencies (including dev dependencies for building)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies from node_modules to reduce size
RUN npm prune --production

# ---- Production Stage (Ultra-minimal) ----
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --legacy-peer-deps && \
    npm cache clean --force

# Copy compiled application from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Create logs directory with proper permissions
RUN mkdir -p logs && \
    chown -R nestjs:nodejs logs

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check (simple port check - can be customized if you add a health endpoint)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api', (r) => {process.exit(r.statusCode < 500 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/src/main.js"]

# ---- Migrator Stage (Optional - for running migrations separately) ----
FROM node:20-alpine AS migrator

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies plus migration tools
RUN npm ci --omit=dev --legacy-peer-deps && \
    npm install typeorm ts-node tsconfig-paths @types/node typescript --legacy-peer-deps && \
    npm cache clean --force

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Copy source files needed for migrations (TypeORM needs .ts files)
COPY --from=builder /app/src/database ./src/database
COPY --from=builder /app/src/entities ./src/entities
COPY --from=builder /app/src/config ./src/config
COPY --from=builder /app/tsconfig.json ./

# Default command: run migrations
CMD ["npm", "run", "migration:run"]
