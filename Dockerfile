# Use an official Node.js runtime as the base image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for caching
COPY package*.json ./

RUN npm install -g @nestjs/cli

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy rest of the code
COPY . .

# Build NestJS app
RUN npm run build

# ---- Development stage ----
FROM node:20-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Expose the port your Nest app runs on
EXPOSE 3000

# Start command with hot reload using nodemon
CMD ["npm", "run", "start:dev:nodemon"]

# ---- Production stage ----
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev --legacy-peer-deps

# IMPORTANT: Install TypeORM CLI and ts-node for migrations
# These are needed to run migrations in production
RUN npm install typeorm ts-node tsconfig-paths @types/node typescript --legacy-peer-deps

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# IMPORTANT: Copy source files needed for migrations and seeds
# TypeORM migrations and seeds need the original .ts files
COPY --from=builder /app/src/database/migrations ./src/database/migrations
COPY --from=builder /app/src/database/seeds ./src/database/seeds
COPY --from=builder /app/src/database/data-source.ts ./src/database/data-source.ts

# Copy entity files needed by seeds and migrations
COPY --from=builder /app/src/entities ./src/entities

# Copy module files needed by seeds
COPY --from=builder /app/src/modules ./src/modules

# Copy config files needed by seeds and data-source
COPY --from=builder /app/src/config ./src/config

# Copy tsconfig for ts-node to work
COPY tsconfig.json ./

# Copy ormconfig.ts needed for TypeORM migrations
COPY --from=builder /app/ormconfig.ts ./


# Create logs directory
RUN mkdir -p logs

# Expose the port your Nest app runs on
EXPOSE 3000

# Start command
CMD ["node", "dist/src/main.js"]
