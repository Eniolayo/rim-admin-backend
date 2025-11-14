# Docker Multi-Stage Build Guide

## Overview

The optimized multi-stage Dockerfile creates three stages:

1. **Builder Stage**: Contains all build tools and dependencies
2. **Production Stage**: Ultra-minimal runtime image (~150-200MB vs ~500MB+)
3. **Migrator Stage**: Optional stage for running database migrations separately

## Benefits

### 🚀 Size Reduction

- **Before**: ~500-600MB (with TypeScript, ts-node, all source files)
- **After**: ~150-200MB (only compiled JS + production dependencies)
- **Savings**: ~60-70% smaller image

### 🔒 Security

- Runs as non-root user (`nestjs` user)
- No build tools in production image
- Minimal attack surface

### ⚡ Performance

- Faster image pulls
- Faster container startup
- Better cache utilization

## Usage

### Building the Production Image

```bash
# Build production image (default target)
docker build -t rim-admin-backend:latest .

# Or explicitly specify production stage
docker build --target production -t rim-admin-backend:latest .
```

### Building the Migrator Image

```bash
# Build migrator image for running migrations
docker build --target migrator -t rim-admin-backend:migrator .
```

### Running the Production Container

```bash
docker run -d \
  --name rim-admin \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_USERNAME=postgres \
  -e DB_PASSWORD=secret \
  -e DB_NAME=rim_db \
  -e JWT_SECRET=your-secret-min-32-chars \
  -e JWT_EXPIRATION=1h \
  -e JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars \
  -e JWT_REFRESH_EXPIRATION=7d \
  rim-admin-backend:latest
```

### Running Migrations

#### Option 1: Separate Migration Job (Recommended)

```bash
# Run migrations as a one-time job
docker run --rm \
  --name rim-migrator \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_USERNAME=postgres \
  -e DB_PASSWORD=secret \
  -e DB_NAME=rim_db \
  rim-admin-backend:migrator
```

#### Option 2: Using Docker Compose

```yaml
services:
  migrator:
    build:
      context: .
      dockerfile: Dockerfile
      target: migrator
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USERNAME: postgres
      DB_PASSWORD: secret
      DB_NAME: rim_db
    depends_on:
      - postgres
    restart: 'no' # Run once and exit
    command: npm run migration:run
```

## Production Deployment Best Practices

### 1. Run Migrations Before App Startup

In your CI/CD pipeline or deployment script:

```bash
# Step 1: Run migrations
docker run --rm \
  --network rim-network \
  rim-admin-backend:migrator

# Step 2: Start the app
docker run -d \
  --network rim-network \
  rim-admin-backend:latest
```

### 2. Use Health Checks

The Dockerfile includes a health check. Monitor it:

```bash
# Check health status
docker ps  # Look for health status column
```

### 3. Security Considerations

- ✅ Image runs as non-root user
- ✅ No build tools in production
- ✅ Minimal dependencies
- ✅ Pass secrets via environment variables, not files

### 4. Size Comparison

```bash
# Check image sizes
docker images rim-admin-backend

# Example output:
# rim-admin-backend:latest      200MB   (production)
# rim-admin-backend:migrator    350MB   (with migration tools)
```

## Image Layers Breakdown

### Production Image Contains:

- ✅ Node.js 20 Alpine (~50MB)
- ✅ Production npm packages (~100-150MB)
- ✅ Compiled JavaScript code (~5-10MB)
- ✅ Logs directory structure

### Not Included:

- ❌ TypeScript compiler
- ❌ TypeScript source files
- ❌ Dev dependencies
- ❌ Test files
- ❌ Build tools
- ❌ Source maps (optional, can be added if needed)

## Troubleshooting

### If migrations are needed in production image

If you must run migrations from the production container, you can modify the production stage to include migration tools. However, this increases image size:

```dockerfile
# Not recommended, but if needed:
RUN npm install typeorm ts-node tsconfig-paths @types/node typescript --legacy-peer-deps
COPY --from=builder /app/src/database ./src/database
COPY --from=builder /app/tsconfig.json ./
```

**Better approach**: Use the separate `migrator` stage as shown above.
