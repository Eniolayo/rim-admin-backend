#!/usr/bin/env node

/**
 * Simple smoke test to verify endpoints are accessible
 * This doesn't require k6 or Artillery to be installed
 * 
 * Automatically loads .env.test if available
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

// Load .env.test if it exists (silently fail if not found)
const envTestPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(envTestPath)) {
  try {
    require('dotenv').config({ path: envTestPath });
  } catch (e) {
    // dotenv not available, continue without it
  }
}
// Also try to load .env as fallback
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  try {
    require('dotenv').config({ path: envPath });
  } catch (e) {
    // dotenv not available, continue without it
  }
}

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const JWT_TOKEN = process.env.JWT_TOKEN || '';

if (!JWT_TOKEN) {
  console.error('❌ JWT_TOKEN environment variable is required');
  console.error('Run: npm run perf:get-token');
  process.exit(1);
}

function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${JWT_TOKEN}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data,
          headers: res.headers,
        });
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function testEndpoint(name, path, method = 'GET', body = null) {
  try {
    const start = Date.now();
    const response = await makeRequest(path, method, body);
    const duration = Date.now() - start;
    
    const success = response.statusCode >= 200 && response.statusCode < 300;
    const status = success ? '✅' : '❌';
    const color = success ? '\x1b[32m' : '\x1b[31m';
    
    console.log(`${color}${status}\x1b[0m ${name} - ${response.statusCode} (${duration}ms)`);
    
    if (!success) {
      console.log(`   Response: ${response.body.substring(0, 100)}`);
    }
    
    return { success, duration, statusCode: response.statusCode };
  } catch (error) {
    console.log(`\x1b[31m❌\x1b[0m ${name} - Error: ${error.message}`);
    return { success: false, duration: 0, error: error.message };
  }
}

async function main() {
  console.log('🔥 Running Smoke Tests...\n');
  console.log(`API URL: ${API_URL}\n`);

  const results = [];

  // Test user stats endpoint
  results.push(await testEndpoint('User Stats', '/users/stats'));

  // Test loan stats endpoint
  results.push(await testEndpoint('Loan Stats', '/loans/stats'));

  // Test credit eligibility (need a valid user ID)
  // This will likely fail if no users exist, but that's okay for smoke test
  results.push(await testEndpoint('Credit Eligibility (USR-001)', '/users/USR-001/eligible-loan-amount'));

  // Summary
  console.log('\n' + '='.repeat(50));
  const passed = results.filter((r) => r.success).length;
  const total = results.length;
  const avgDuration = results
    .filter((r) => r.duration > 0)
    .reduce((sum, r) => sum + r.duration, 0) / results.filter((r) => r.duration > 0).length;

  console.log(`Results: ${passed}/${total} passed`);
  if (avgDuration > 0) {
    console.log(`Average Response Time: ${avgDuration.toFixed(2)}ms`);
  }

  if (passed === total) {
    console.log('\n✅ All smoke tests passed! Ready for performance testing.');
  } else {
    console.log('\n⚠️  Some tests failed. Check your setup:');
    console.log('1. Ensure application is running');
    console.log('2. Ensure JWT token is valid');
    console.log('3. Ensure test data is seeded (npm run seed:user)');
  }
  console.log('='.repeat(50));
}

main().catch(console.error);

