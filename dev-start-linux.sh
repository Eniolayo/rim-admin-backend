#!/bin/bash

# Script: dev-start-linux.sh
# Purpose: Start development Docker containers with hot reload (Linux optimized)
# Platform: Linux

set -e

echo "========================================"
echo "RIM Admin Backend - Development Startup"
echo "Linux-Optimized Version"
echo "========================================"
echo ""

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
  echo "⚠️  Warning: This script is optimized for Linux"
  echo "   Detected OS: $OSTYPE"
  echo ""
fi

# Check if docker is installed
if ! command -v docker &> /dev/null; then
  echo "❌ Error: Docker is not installed!"
  echo ""
  echo "Install Docker on Linux:"
  echo "   Ubuntu/Debian: sudo apt-get update && sudo apt-get install docker.io docker-compose"
  echo "   Fedora/RHEL:   sudo dnf install docker docker-compose"
  echo "   Arch:          sudo pacman -S docker docker-compose"
  echo ""
  echo "After installation, add your user to docker group:"
  echo "   sudo usermod -aG docker \$USER"
  echo "   (Then log out and log back in)"
  exit 1
fi

# Detect docker-compose command (v1 or v2)
if command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
  DOCKER_COMPOSE_CMD="docker compose"
else
  echo "❌ Error: docker-compose is not installed!"
  echo ""
  echo "Install docker-compose:"
  echo "   Ubuntu/Debian: sudo apt-get install docker-compose"
  echo "   Or install Docker Compose V2 (included with Docker):"
  echo "      sudo apt-get install docker-compose-plugin"
  echo "   Or use: sudo curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose"
  exit 1
fi

echo "✅ Using: $DOCKER_COMPOSE_CMD"

# Check if docker daemon is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Error: Docker daemon is not running!"
  echo ""
  echo "Start Docker service on Linux:"
  echo "   sudo systemctl start docker"
  echo "   sudo systemctl enable docker  # Enable auto-start on boot"
  echo ""
  echo "If you get permission denied errors, ensure your user is in the docker group:"
  echo "   sudo usermod -aG docker \$USER"
  echo "   (Then log out and log back in)"
  exit 1
fi

# Check if user has permission to run docker (Linux-specific)
if ! docker ps > /dev/null 2>&1; then
  echo "❌ Error: Permission denied accessing Docker!"
  echo ""
  echo "Add your user to the docker group:"
  echo "   sudo usermod -aG docker \$USER"
  echo ""
  echo "Then log out and log back in, or run:"
  echo "   newgrp docker"
  exit 1
fi

echo "✅ Docker is installed and running"
echo ""

# Check for .env file (optional - docker-compose.dev.yml has defaults)
if [ ! -f .env ]; then
  echo "ℹ️  Info: .env file not found"
  echo "   Creating empty .env file (using defaults from docker-compose.dev.yml)"
  touch .env
  if [ -f .env.example ]; then
    echo "   💡 Tip: Copy .env.example to .env to customize settings:"
    echo "      cp .env.example .env"
  fi
  echo ""
else
  echo "✅ Found .env file"
  echo ""
fi

echo "🔍 Checking for existing containers..."

# Check for existing containers using Linux-optimized grep
if docker ps -a --format '{{.Names}}' | grep -qE 'rim-(postgres|redis|admin-be|prometheus|grafana)-dev'; then
  echo "⚠️  Found existing dev containers. Stopping them first..."
  $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml down
  echo "✅ Stopped existing containers"
  echo ""
fi

# Clean up any orphaned containers (Linux-specific optimization)
echo "🧹 Cleaning up orphaned resources..."
$DOCKER_COMPOSE_CMD -f docker-compose.dev.yml down --remove-orphans 2>/dev/null || true
echo "✅ Cleanup complete"
echo ""

echo "🏗️  Building and starting dev containers..."
echo "   - PostgreSQL database"
echo "   - Redis cache"
echo "   - NestJS app with hot reload"
echo "   - Prometheus metrics"
echo "   - Grafana dashboards"
echo ""

# Start containers and rebuild if needed
echo "📦 Starting containers (this may take a moment on first run)..."
if ! $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml up --build -d; then
  echo ""
  echo "❌ Error: Failed to start containers"
  echo ""
  echo "This might be due to:"
  echo "   - Network timeout during npm install (try again)"
  echo "   - Build errors (check logs below)"
  echo "   - Insufficient disk space"
  echo ""
  echo "Check the error messages above for details."
  echo "You can retry by running: ./dev-start-linux.sh"
  echo ""
  exit 1
fi

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 3

# Wait for postgres to be healthy (Linux-optimized check)
echo "🔍 Checking PostgreSQL health..."
for i in {1..30}; do
  if docker exec rim-postgres-dev pg_isready -U ${DB_USERNAME:-postgres} > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "⚠️  PostgreSQL took longer than expected to start"
  else
    sleep 1
  fi
done

# Wait for redis to be healthy
echo "🔍 Checking Redis health..."
for i in {1..30}; do
  if docker exec rim-redis-dev redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "⚠️  Redis took longer than expected to start"
  else
    sleep 1
  fi
done

echo ""
sleep 2

# Check if containers are running
if docker ps --format '{{.Names}}' | grep -q 'rim-admin-be-dev'; then
  echo ""
  echo "✅ Development environment is running!"
  echo ""
  echo "📍 Services:"
  echo "   - API:          http://localhost:3000"
  echo "   - API Docs:     http://localhost:3000/api/docs"
  echo "   - Prometheus:   http://localhost:9090"
  echo "   - Grafana:      http://localhost:3001 (Admin: admin / admin)"
  echo "   - Metrics:      http://localhost:3000/api/metrics"
  echo "   - Database:     localhost:5432"
  echo "   - Redis:        localhost:6379"
  echo ""
  echo "📝 Useful commands:"
  echo "   - View logs:           $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml logs -f"
  echo "   - View app logs only:  $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml logs -f app"
  echo "   - View db logs:        $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml logs -f postgres"
  echo "   - Run migrations:      $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml exec app npm run migration:run"
  echo "   - Generate migration:  $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml exec app npm run migration:generate -- src/database/migrations/MigrationName"
  echo "   - Run tests:           $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml exec app npm test"
  echo "   - Run e2e tests:       $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml exec app npm run test:e2e"
  echo "   - Stop containers:     $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml down"
  echo "   - Stop & remove data:  $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml down -v"
  echo ""
  echo "🔄 Hot reload is enabled - changes will rebuild automatically!"
  echo ""
  echo "📊 Container status:"
  docker ps --filter "name=rim-.*-dev" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  echo "To view logs, run:"
  echo "   $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml logs -f app"
  echo ""
else
  echo ""
  echo "❌ Error: Containers failed to start properly"
  echo ""
  
  # Check for common build errors
  BUILD_ERROR=$(docker-compose -f docker-compose.dev.yml logs app 2>/dev/null | grep -i "timeout\|EIDLETIMEOUT\|network\|npm error" | tail -1 || true)
  if [ -n "$BUILD_ERROR" ]; then
    echo "🔍 Detected potential network/timeout issue during build"
    echo ""
    echo "Common solutions:"
    echo "   1. Network timeout (npm install):"
    echo "      - Check internet connection"
    echo "      - Try again: ./dev-start-linux.sh"
    echo "      - Or increase npm timeout in Dockerfile.dev"
    echo ""
    echo "   2. If npm install keeps failing:"
    echo "      - Clear Docker build cache: docker builder prune -a"
    echo "      - Try building manually: $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml build --no-cache app"
    echo ""
  fi
  
  echo "Debugging steps:"
  echo "   1. Check build logs: $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml logs app"
  echo "   2. Check all logs: $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml logs"
  echo "   3. Check container status: docker ps -a"
  echo "   4. Check Docker service: sudo systemctl status docker"
  echo "   5. Check disk space: df -h"
  echo "   6. Check Docker resources: docker system df"
  echo "   7. Retry the build: $DOCKER_COMPOSE_CMD -f docker-compose.dev.yml build --no-cache"
  echo ""
  exit 1
fi

