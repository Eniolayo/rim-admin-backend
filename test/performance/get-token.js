#!/usr/bin/env node

/**
 * Helper script to get JWT token for performance testing
 * Usage: 
 *   node test/performance/get-token.js [email] [password] [mfa-code]
 * 
 * Examples:
 *   node test/performance/get-token.js
 *   node test/performance/get-token.js user@example.com password123
 *   node test/performance/get-token.js user@example.com password123 123456  # TOTP code
 *   node test/performance/get-token.js user@example.com password123 BACKUP-CODE  # Backup code
 * 
 * Automatically loads .env.test if available
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

// Try to load otplib for MFA code generation (optional)
let authenticator;
try {
  const otplib = require('otplib');
  // otplib v12+ uses named exports
  authenticator = otplib.authenticator || (otplib.default && otplib.default.authenticator);
} catch (e) {
  // otplib not available, will handle MFA differently
  authenticator = null;
}

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
const email = process.argv[2] || process.env.TEST_EMAIL || 'superadmin33@test33.com';
const password = process.argv[3] || process.env.SEED_ADMIN_PASSWORD || 'Password123!';
const mfaCode = process.argv[4] || process.env.MFA_CODE || null;

function makeRequest(path, method, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}${path}`);
    const postData = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const body = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, body, data });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: {}, data });
        }
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function handleMfaSetup(sessionToken) {
  if (!authenticator) {
    throw new Error('MFA setup required but otplib is not available. Install it with: npm install otplib');
  }

  // Start 2FA setup
  const setupRes = await makeRequest('/auth/2fa/setup', 'POST', { sessionToken });
  if (setupRes.statusCode !== 200) {
    throw new Error(`2FA setup failed: ${setupRes.data}`);
  }

  const { manualKey } = setupRes.body;
  if (!manualKey) {
    throw new Error('No manual key received from 2FA setup');
  }

  // Generate TOTP code
  const code = authenticator.generate(manualKey);

  // Verify setup
  const verifyRes = await makeRequest('/auth/2fa/verify-setup', 'POST', {
    sessionToken,
    code,
  });

  if (verifyRes.statusCode !== 200 || !verifyRes.body.token) {
    throw new Error(`2FA verification failed: ${verifyRes.data}`);
  }

  return verifyRes.body.token;
}

async function login() {
  const loginRes = await makeRequest('/auth/login', 'POST', { email, password });

  if (loginRes.statusCode !== 200) {
    throw new Error(`Login failed: ${loginRes.data}`);
  }

  const body = loginRes.body;

  // Direct token (no MFA)
  if (body.token) {
    return body.token;
  }

  // MFA setup required
  if (body.status === 'MFA_SETUP_REQUIRED' && body.sessionToken) {
    console.log('📱 MFA setup required. Completing setup automatically...');
    return await handleMfaSetup(body.sessionToken);
  }

  // MFA verification required
  if (body.status === 'MFA_REQUIRED' && body.temporaryHash) {
    const temporaryHash = body.temporaryHash;
    
    if (!mfaCode) {
      console.error('❌ MFA verification required. This account has MFA enabled.');
      console.error('\nProvide an MFA code as the 4th argument:');
      console.error('  npm run perf:get-token <email> <password> <mfa-code>');
      console.error('\nThe MFA code can be:');
      console.error('  - A 6-digit TOTP code from your authenticator app (e.g., 123456)');
      console.error('  - A backup code (e.g., BACKUP-XXXX-XXXX)');
      console.error('\nOr set it via environment variable:');
      console.error('  export MFA_CODE="123456"');
      console.error('  npm run perf:get-token');
      console.error('\nAlternative: Manually get a token from the frontend:');
      console.error('  export JWT_TOKEN="your-token-here"');
      throw new Error('MFA verification required - provide MFA code as 4th argument');
    }

    console.log('🔐 Verifying MFA code...');
    
    // Try TOTP code first (6 digits), then backup code
    const isBackupCode = mfaCode.includes('-') || mfaCode.length > 6;
    
    let verifyRes;
    if (isBackupCode) {
      // Backup code - use /auth/2fa/backup-codes/consume
      verifyRes = await makeRequest('/auth/2fa/backup-codes/consume', 'POST', {
        temporaryHash,
        code: mfaCode,
      });
    } else {
      // TOTP code (6 digits) - use /admin/mfa/:temporaryHash
      verifyRes = await makeRequest(`/admin/mfa/${temporaryHash}`, 'POST', {
        code: mfaCode,
      });
    }

    if (verifyRes.statusCode !== 200 || !verifyRes.body.token) {
      const errorMsg = verifyRes.body.message || verifyRes.body.error || 'Invalid code';
      let fullError = `MFA verification failed: ${errorMsg}`;
      
      if (errorMsg.includes('Invalid code') && !isBackupCode) {
        fullError += '\n\n💡 TOTP codes expire every 30 seconds. Try:';
        fullError += '\n   1. Get a fresh code from your authenticator app';
        fullError += '\n   2. Run the command again immediately';
        fullError += '\n   3. Or try a backup code if you have one';
      }
      
      throw new Error(fullError);
    }

    return verifyRes.body.token;
  }

  throw new Error(`Unexpected login response: ${JSON.stringify(body)}`);
}

async function main() {
  try {
    console.log(`🔐 Logging in as ${email}...`);
    if (mfaCode) {
      console.log('📱 MFA code provided, will use it if needed...');
    }
    const token = await login();
    console.log('\n✅ Token obtained successfully!');
    console.log('\nSet this environment variable:');
    console.log(`export JWT_TOKEN="${token}"`);
    console.log('\nOr use it directly in your test command:');
    console.log(`k6 run -e JWT_TOKEN="${token}" test/performance/credit-eligibility-stress.k6.js`);
  } catch (error) {
    console.error('\n❌ Failed to get token:', error.message);
    if (error.message.includes('MFA verification required')) {
      console.error('\n💡 Tip: Get a TOTP code from your authenticator app or use a backup code.');
    } else if (error.message.includes('Invalid code')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   - TOTP codes change every 30 seconds - use a fresh code');
      console.error('   - Ensure your device clock is synchronized');
      console.error('   - Try a backup code if TOTP keeps failing');
      console.error('   - Or manually get token from frontend and set JWT_TOKEN');
    }
    process.exit(1);
  }
}

main();

