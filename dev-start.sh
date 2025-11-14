#!/bin/bash

# Script: dev-start.sh
# Purpose: Start development Docker containers with hot reload
# Platform: Mac/Linux

set -e

echo "========================================"
echo "RIM Admin Backend - Development Startup"
echo "========================================"
echo ""

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Error: Docker is not running!"
  echo "Please start Docker Desktop and try again."
  exit 1
fi

echo "🔍 Checking for existing containers..."

if docker ps -a --format '{{.Names}}' | grep -q 'rim-.*-dev'; then
  echo "⚠️  Found existing dev containers. Stopping them first..."
  docker-compose -f docker-compose.dev.yml down
  echo "✅ Stopped existing containers"
fi

echo ""
echo "🏗️  Building and starting dev containers..."
echo "   - PostgreSQL database"
echo "   - NestJS app with hot reload"
echo ""

# Start containers and rebuild if needed
docker-compose -f docker-compose.dev.yml up --build -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if containers are running
if docker ps --format '{{.Names}}' | grep -q 'rim-admin-be-dev'; then
  echo ""
  echo "✅ Development environment is running!"
  echo ""
  echo "📍 Services:"
  echo "   - API:      http://localhost:3000"
  echo "   - Database: localhost:5432"
  echo ""
  echo "📝 Useful commands:"
  echo "   - View logs:           docker-compose -f docker-compose.dev.yml logs -f"
  echo "   - View app logs only:  docker-compose -f docker-compose.dev.yml logs -f app"
  echo "   - Run migrations:      docker-compose -f docker-compose.dev.yml exec app npm run migration:run"
  echo "   - Generate migration:  docker-compose -f docker-compose.dev.yml exec app npm run migration:generate -- src/database/migrations/MigrationName"
  echo "   - Stop containers:     docker-compose -f docker-compose.dev.yml down"
  echo ""
  echo "🔄 Hot reload is enabled - changes will rebuild automatically!"
  echo ""
  echo "To view logs, run:"
  echo "   docker-compose -f docker-compose.dev.yml logs -f app"
  echo ""
else
  echo ""
  echo "❌ Error: Containers failed to start properly"
  echo "Run 'docker-compose -f docker-compose.dev.yml logs' to see errors"
  exit 1
fi
