#!/bin/sh

# Script: prod-seed.sh
# Purpose: Run migrations and seed all data in production environment
# Platform: Mac/Linux (POSIX-compliant for Alpine Linux)
# Usage: ./prod-seed.sh or sh ./prod-seed.sh

set -e

echo "=========================================="
echo "RIM Admin Backend - Production Seeding"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: package.json not found!"
  echo "Please run this script from the rim-admin-backend directory."
  exit 1
fi

# Check for required environment variables
echo "🔍 Checking environment variables..."
REQUIRED_VARS="DB_HOST DB_PORT DB_USERNAME DB_PASSWORD DB_NAME"
MISSING_VARS=""

for var in $REQUIRED_VARS; do
  eval "value=\$$var"
  if [ -z "$value" ]; then
    if [ -z "$MISSING_VARS" ]; then
      MISSING_VARS="$var"
    else
      MISSING_VARS="$MISSING_VARS $var"
    fi
  fi
done

if [ -n "$MISSING_VARS" ]; then
  echo "❌ Error: Missing required environment variables:"
  for var in $MISSING_VARS; do
    echo "   - $var"
  done
  echo ""
  echo "Please set these environment variables before running the script."
  exit 1
fi

echo "✅ Environment variables check passed"
echo ""

# Check if Node.js and npm are available
if ! command -v node > /dev/null 2>&1; then
  echo "❌ Error: Node.js is not installed or not in PATH"
  exit 1
fi

if ! command -v npm > /dev/null 2>&1; then
  echo "❌ Error: npm is not installed or not in PATH"
  exit 1
fi

echo "✅ Node.js $(node --version) and npm $(npm --version) detected"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "⚠️  Warning: node_modules not found. Installing dependencies..."
  npm install --legacy-peer-deps
  echo "✅ Dependencies installed"
  echo ""
fi

# Check database connection
echo "🔍 Testing database connection..."
if command -v psql > /dev/null 2>&1; then
  if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database connection successful"
  else
    echo "⚠️  Warning: Could not verify database connection with psql"
    echo "   Continuing anyway (connection will be tested during migration)..."
  fi
else
  echo "⚠️  psql not found, skipping connection test"
  echo "   Connection will be tested during migration..."
fi
echo ""

# Run migrations first
echo "🔄 Running database migrations..."
npm run migration:run

if [ $? -eq 0 ]; then
  echo "✅ Migrations completed successfully!"
else
  echo ""
  echo "❌ Error: Migration failed!"
  echo "Please check your database connection and migration files."
  exit 1
fi

echo ""
echo "🌱 Seeding database..."
echo ""

# Track overall success
SEED_ERRORS=0

# Seed admin roles and users - MUST BE FIRST (roles are seeded before users in admin.seed.ts)
echo "   [1/6] Seeding admin roles and admin users..."
echo "   (This will seed: super_Admin, Admin, moderator roles, then admin users)"
if npm run seed:admin; then
  echo "   ✅ Admin roles and users seed completed"
else
  echo "   ⚠️  Warning: Admin seed failed (may already exist or error occurred)"
  SEED_ERRORS=$((SEED_ERRORS + 1))
fi
echo ""

# Seed user data
echo "   [2/6] Seeding user data..."
if npm run seed:user; then
  echo "   ✅ User seed completed"
else
  echo "   ⚠️  Warning: User seed failed (may already exist or error occurred)"
  SEED_ERRORS=$((SEED_ERRORS + 1))
fi
echo ""

# Seed loan config data
echo "   [3/6] Seeding loan configuration data..."
if npm run seed:loan-config; then
  echo "   ✅ Loan config seed completed"
else
  echo "   ⚠️  Warning: Loan config seed failed (may already exist or error occurred)"
  SEED_ERRORS=$((SEED_ERRORS + 1))
fi
echo ""

# Seed credit score config data
echo "   [4/6] Seeding credit score configuration data..."
if npm run seed:credit-score-config; then
  echo "   ✅ Credit score config seed completed"
else
  echo "   ⚠️  Warning: Credit score config seed failed (may already exist or error occurred)"
  SEED_ERRORS=$((SEED_ERRORS + 1))
fi
echo ""

# Seed loan data (depends on users)
echo "   [5/6] Seeding loan data..."
if npm run seed:loan; then
  echo "   ✅ Loan seed completed"
else
  echo "   ⚠️  Warning: Loan seed failed (may already exist or error occurred)"
  SEED_ERRORS=$((SEED_ERRORS + 1))
fi
echo ""

# Seed transaction data (depends on users and loans)
echo "   [6/6] Seeding transaction data..."
if npm run seed:transaction; then
  echo "   ✅ Transaction seed completed"
else
  echo "   ⚠️  Warning: Transaction seed failed (may already exist or error occurred)"
  SEED_ERRORS=$((SEED_ERRORS + 1))
fi

echo ""
echo "=========================================="
if [ "$SEED_ERRORS" -eq 0 ]; then
  echo "✅ Seeding Complete - All seeds successful!"
else
  echo "⚠️  Seeding Complete - $SEED_ERRORS seed(s) had warnings"
  echo "   (This is normal if data already exists)"
fi
echo "=========================================="
echo ""
echo "📝 Seeded data:"
echo "   - Admin roles (super_Admin, Admin, moderator) - seeded first"
echo "   - Admin users (with roles assigned)"
echo "   - Regular users"
echo "   - Loan configuration"
echo "   - Credit score configuration"
echo "   - Loans"
echo "   - Transactions"
echo ""
echo "🔑 Default admin password: Check your seed files for the default password"
echo "   (Users will be forced to set up 2FA on first login)"
echo ""
