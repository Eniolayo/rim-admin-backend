#!/bin/bash

# MNO Endpoints Test Runner
# This script runs the MNO endpoints test suite

set -e

echo "🧪 Running MNO Endpoints Test Suite"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the rim-admin-backend directory"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the tests using e2e config
echo "🚀 Starting tests..."
echo ""

npm run test:e2e -- --testPathPatterns=mno-endpoints

echo ""
echo "✅ Test execution complete!"
echo ""
echo "For more information, see: test/MNO_TEST_README.md"

