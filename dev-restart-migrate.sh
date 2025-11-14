#!/bin/bash

# Script: dev-restart-migrate.sh
# Purpose: Stop containers, restart them, and run migrations
# Platform: Mac/Linux

set -e

echo "=========================================="
echo "RIM Admin Backend - Restart & Migrate"
echo "=========================================="
echo ""

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Error: Docker is not running!"
  echo "Please start Docker Desktop and try again."
  exit 1
fi

echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.dev.yml down

echo "✅ Containers stopped"
echo ""

# Optional: Remove volumes (uncomment to reset database)
# echo "🗑️  Removing volumes (database will be reset)..."
# docker-compose -f docker-compose.dev.yml down -v
# echo "✅ Volumes removed"
# echo ""

echo "🏗️  Starting fresh containers..."
docker-compose -f docker-compose.dev.yml up --build -d

echo ""

echo "⏳ Waiting for database to be ready..."
sleep 10

# Check if postgres is ready
until docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U ${DB_USERNAME:-postgres} > /dev/null 2>&1; do
  echo "⏳ Waiting for PostgreSQL..."
  sleep 2
done

echo "✅ PostgreSQL is ready!"
echo ""

echo "🔄 Running database migrations..."
docker-compose -f docker-compose.dev.yml exec -T app npm run migration:run

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migrations completed successfully!"
  echo ""
  echo "📍 Services:"
  echo "   - API:      http://localhost:${PORT:-3000}"
  echo "   - Database: localhost:${DB_PORT:-5432}"
  echo ""
  echo "📝 Useful commands:"
  echo "   - View logs:           docker-compose -f docker-compose.dev.yml logs -f"
  echo "   - View app logs only:  docker-compose -f docker-compose.dev.yml logs -f app"
  echo "   - Revert migration:    docker-compose -f docker-compose.dev.yml exec app npm run migration:revert"
  echo "   - Generate migration:  docker-compose -f docker-compose.dev.yml exec app npm run migration:generate"
  echo "   - Stop containers:     docker-compose -f docker-compose.dev.yml down"
  echo ""
else
  echo ""
  echo "❌ Error: Migration failed!"
  echo "Check logs with: docker-compose -f docker-compose.dev.yml logs app"
  exit 1
fi

