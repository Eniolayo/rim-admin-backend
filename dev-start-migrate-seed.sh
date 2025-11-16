#!/bin/bash

# Script: dev-start-migrate-seed.sh
# Purpose: Start development Docker containers, run migrations, and seed the database
# Platform: Mac/Linux

set -e

echo "=========================================="
echo "RIM Admin Backend - Dev Start & Setup"
echo "=========================================="
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
  echo ""
fi

echo "🏗️  Building and starting dev containers..."
echo "   - PostgreSQL database"
echo "   - Redis cache"
echo "   - NestJS app with hot reload"
echo ""

# Start containers and rebuild if needed
docker-compose -f docker-compose.dev.yml up --build -d

echo ""
echo "⏳ Waiting for services to be ready..."

# Wait for postgres to be ready
echo "   Waiting for PostgreSQL..."
until docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U ${DB_USERNAME:-postgres} > /dev/null 2>&1; do
  echo "   ⏳ PostgreSQL is not ready yet..."
  sleep 2
done
echo "   ✅ PostgreSQL is ready!"

# Wait for redis to be ready
echo "   Waiting for Redis..."
until docker-compose -f docker-compose.dev.yml exec -T redis redis-cli ping > /dev/null 2>&1; do
  echo "   ⏳ Redis is not ready yet..."
  sleep 2
done
echo "   ✅ Redis is ready!"

# Wait a bit more for the app container to be fully ready
echo "   Waiting for app container..."
sleep 5

echo ""
echo "🔄 Running database migrations..."
docker-compose -f docker-compose.dev.yml exec -T app npm run migration:run

if [ $? -eq 0 ]; then
  echo "✅ Migrations completed successfully!"
else
  echo ""
  echo "❌ Error: Migration failed!"
  echo "Check logs with: docker-compose -f docker-compose.dev.yml logs app"
  exit 1
fi

echo ""
echo "🌱 Seeding database..."

# Run seeds in order (admin first, then others)
echo "   Seeding admin data..."
docker-compose -f docker-compose.dev.yml exec -T app npm run seed:admin

if [ $? -eq 0 ]; then
  echo "   ✅ Admin seed completed"
else
  echo "   ⚠️  Warning: Admin seed failed (may already exist)"
fi

echo "   Seeding user data..."
docker-compose -f docker-compose.dev.yml exec -T app npm run seed:user

if [ $? -eq 0 ]; then
  echo "   ✅ User seed completed"
else
  echo "   ⚠️  Warning: User seed failed (may already exist)"
fi

echo "   Seeding loan data..."
docker-compose -f docker-compose.dev.yml exec -T app npm run seed:loan

if [ $? -eq 0 ]; then
  echo "   ✅ Loan seed completed"
else
  echo "   ⚠️  Warning: Loan seed failed (may already exist)"
fi

echo "   Seeding transaction data..."
docker-compose -f docker-compose.dev.yml exec -T app npm run seed:transaction

if [ $? -eq 0 ]; then
  echo "   ✅ Transaction seed completed"
else
  echo "   ⚠️  Warning: Transaction seed failed (may already exist)"
fi

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "📍 Services:"
echo "   - API:      http://localhost:${PORT:-3000}"
echo "   - Database: localhost:${DB_PORT:-5432}"
echo "   - Redis:    localhost:${REDIS_PORT:-6379}"
echo ""
echo "📝 Useful commands:"
echo "   - View logs:           docker-compose -f docker-compose.dev.yml logs -f"
echo "   - View app logs only:  docker-compose -f docker-compose.dev.yml logs -f app"
echo "   - Run migrations:      docker-compose -f docker-compose.dev.yml exec app npm run migration:run"
echo "   - Revert migration:    docker-compose -f docker-compose.dev.yml exec app npm run migration:revert"
echo "   - Generate migration:  docker-compose -f docker-compose.dev.yml exec app npm run migration:generate -- src/database/migrations/MigrationName"
echo "   - Run seeds:           docker-compose -f docker-compose.dev.yml exec app npm run seed:admin"
echo "   - Stop containers:     docker-compose -f docker-compose.dev.yml down"
echo ""
echo "🔄 Hot reload is enabled - changes will rebuild automatically!"
echo ""
