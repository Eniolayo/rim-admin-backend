#!/usr/bin/env node

/**
 * Validation script to check if performance testing setup is correct
 * 
 * Automatically loads .env.test if available
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

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
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

async function check(description, testFn) {
  try {
    const result = await Promise.resolve(testFn());
    const status = result ? '✅' : '❌';
    const color = result ? colors.green : colors.red;
    console.log(`${color}${status}${colors.reset} ${description}`);
    return result;
  } catch (error) {
    console.log(`${colors.red}❌${colors.reset} ${description} - Error: ${error.message}`);
    return false;
  }
}

async function checkServer() {
  return new Promise((resolve) => {
    const url = new URL(API_URL);
    // Try the API base path - any HTTP response (even 401/404) means server is running
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname || '/api',
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        // Any HTTP response (including 401, 404, etc.) means server is running
        resolve(true);
      },
    );

    req.on('error', () => {
      // Connection error means server is not running
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

function checkFiles() {
  const requiredFiles = [
    'credit-eligibility-stress.k6.js',
    'soak-test.k6.js',
    'spike-test.k6.js',
    'mixed-workload.k6.js',
    'artillery-load.yml',
    'artillery-stress.yml',
    'artillery-soak.yml',
    'artillery-processor.js',
    'user-ids.json',
    'get-token.js',
  ];

  const missing = [];
  const dir = path.join(__dirname);

  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(dir, file))) {
      missing.push(file);
    }
  }

  return missing.length === 0;
}

async function checkTools() {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec('which k6', (error) => {
      if (error) {
        resolve(false);
        return;
      }
      exec('which artillery', (error2) => {
        resolve(!error2);
      });
    });
  });
}

async function main() {
  console.log(`${colors.blue}Validating Performance Testing Setup...${colors.reset}\n`);

  const results = [];

  results.push(await check('Server is running', checkServer));
  results.push(await check('All test files exist', checkFiles));
  results.push(await check('k6 and Artillery are installed', checkTools));

  const allPassed = results.every((r) => r);

  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log(`${colors.green}✅ All checks passed!${colors.reset}`);
    console.log('\nNext steps:');
    console.log('1. Get JWT token: npm run perf:get-token');
    console.log('2. Run a quick test: npm run perf:load:k6');
  } else {
    console.log(`${colors.red}❌ Some checks failed${colors.reset}`);
    console.log('\nPlease fix the issues above before running performance tests.');
    
    if (!results[0]) {
      console.log(`\n${colors.yellow}⚠️  Server check failed:${colors.reset}`);
      console.log('  - Ensure the application is running: npm run start:dev');
      console.log('  - Check that API_URL is correct in .env.test or environment');
    }
    
    if (!results[2]) {
      console.log(`\n${colors.yellow}⚠️  k6 and Artillery not installed:${colors.reset}`);
      console.log('  Install k6:');
      console.log('    macOS: brew install k6');
      console.log('    Linux: See https://k6.io/docs/getting-started/installation/');
      console.log('  Install Artillery:');
      console.log('    npm install -g artillery');
      console.log('\n  Note: You can still run smoke tests without these tools:');
      console.log('    npm run perf:smoke');
    }
  }
  console.log('='.repeat(50));
}

main().catch(console.error);

