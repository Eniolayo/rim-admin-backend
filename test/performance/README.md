# Performance Testing Suite

This directory contains comprehensive performance testing scripts to validate the 200ms/300 TPS targets for the RIM Admin Backend.

## 🚨 Production Stress Testing

**⚠️ IMPORTANT**: For production stress testing, see the dedicated guide:

- **[PRODUCTION_STRESS_TEST_GUIDE.md](./PRODUCTION_STRESS_TEST_GUIDE.md)** - Complete step-by-step guide for production stress testing
- **[PRODUCTION_STRESS_TEST_QUICK_START.md](./PRODUCTION_STRESS_TEST_QUICK_START.md)** - Quick reference

**Quick Start:**
```bash
export JWT_TOKEN="your-production-token"
npm run perf:stress:prod
```

**Production test scripts:**
- `npm run perf:stress:prod` - Run production stress test (Artillery)
- `npm run perf:stress:prod:k6` - Run production stress test (k6)

## Prerequisites

### Install Testing Tools

```bash
# Install k6
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D9B
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Install Artillery
npm install -g artillery
```

### Setup Test Data

1. **Ensure your application is running:**
   ```bash
   npm run start:dev
   # or
   docker-compose up
   ```

2. **Seed test data (if not already done):**
   ```bash
   npm run seed:user
   ```

3. **Optional: Create `.env.test` file for default configuration:**
   ```env
   # Performance Testing Configuration
   API_URL=http://localhost:3000/api
   TEST_EMAIL=superadmin33@test33.com
   SEED_ADMIN_PASSWORD=Password123!
   USER_IDS=USR-001,USR-002,USR-003
   ```
   **Note:** All performance test scripts automatically load `.env.test` if it exists. 
   `JWT_TOKEN` should NOT be in `.env.test` as it expires and should be obtained dynamically.

3. **Get JWT Token:**
   ```bash
   # Option 1: Use the helper script
   npm run perf:get-token
   
   # Option 2: Set environment variables
   export JWT_TOKEN="your-token-here"
   export API_URL="http://localhost:3000/api"
   export USER_IDS="USR-001,USR-002,USR-003"
   ```

   **Note:** You can also add these to `.env.test` file (except `JWT_TOKEN` which should be obtained dynamically):
   ```env
   API_URL=http://localhost:3000/api
   TEST_EMAIL=superadmin33@test33.com
   SEED_ADMIN_PASSWORD=Password123!
   USER_IDS=USR-001,USR-002,USR-003
   ```
   The performance test scripts will automatically load `.env.test` if it exists.

## Quick Start

1. **Validate setup:**
   ```bash
   npm run perf:validate
   ```

2. **Get JWT token:**
   ```bash
   npm run perf:get-token
   export JWT_TOKEN="<token-from-above>"
   ```

3. **Run smoke test (no k6/Artillery needed):**
   ```bash
   npm run perf:smoke
   ```

4. **Run a quick load test:**
   ```bash
   npm run perf:load:k6
   ```

## Test Types

### 1. Load Test
Tests normal expected load, gradually ramping up to target capacity.

**k6:**
```bash
k6 run -e API_URL=http://localhost:3000/api -e JWT_TOKEN=$JWT_TOKEN -e USER_IDS="USR-001,USR-002,USR-003" test/performance/credit-eligibility-stress.k6.js
# or
npm run perf:load:k6
```

**Artillery:**
```bash
JWT_TOKEN=$JWT_TOKEN artillery run test/performance/artillery-load.yml --output test-results/artillery-load.json
# or
npm run perf:load:artillery
```

### 2. Stress Test
Finds the breaking point by gradually increasing load beyond target.

**k6:**
```bash
k6 run -e API_URL=http://localhost:3000/api -e JWT_TOKEN=$JWT_TOKEN -e USER_IDS="USR-001,USR-002,USR-003" test/performance/credit-eligibility-stress.k6.js
# or
npm run perf:stress:k6
```

**Artillery:**
```bash
JWT_TOKEN=$JWT_TOKEN artillery run test/performance/artillery-stress.yml --output test-results/artillery-stress.json
# or
npm run perf:stress:artillery
```

### 3. Soak Test
Long-duration test to detect memory leaks and stability issues.

**k6:**
```bash
k6 run -e API_URL=http://localhost:3000/api -e JWT_TOKEN=$JWT_TOKEN -e USER_IDS="USR-001,USR-002,USR-003" test/performance/soak-test.k6.js
# or
npm run perf:soak:k6
```

**Artillery:**
```bash
JWT_TOKEN=$JWT_TOKEN artillery run test/performance/artillery-soak.yml --output test-results/artillery-soak.json
# or
npm run perf:soak:artillery
```

**Note:** Soak tests run for 4 hours. Use `Ctrl+C` to stop early if needed.

### 4. Spike Test
Tests system recovery from sudden traffic spikes.

**k6:**
```bash
k6 run -e API_URL=http://localhost:3000/api -e JWT_TOKEN=$JWT_TOKEN -e USER_IDS="USR-001,USR-002,USR-003" test/performance/spike-test.k6.js
# or
npm run perf:spike:k6
```

### 5. Mixed Workload Test
Tests multiple endpoints simultaneously to simulate real-world usage.

**k6:**
```bash
k6 run -e API_URL=http://localhost:3000/api -e JWT_TOKEN=$JWT_TOKEN -e USER_IDS="USR-001,USR-002,USR-003" test/performance/mixed-workload.k6.js
# or
npm run perf:mixed:k6
```

## Performance Targets

- **Latency:** 95% of requests must complete in < 200ms
- **Throughput:** System must handle 300 TPS (Transactions Per Second)
- **Error Rate:** < 1% failure rate

## Test Results

Results are saved in the `test-results/` directory:

- `*.json` - Full test results in JSON format
- `*-summary.txt` - Human-readable summary

### View Artillery Reports

```bash
artillery report test-results/artillery-load.json
# or
npm run perf:report:artillery
```

## Monitoring During Tests

### Application Metrics
- Prometheus metrics: `http://localhost:3000/metrics`
- Application logs: Check console output

### System Resources
```bash
# Monitor CPU and memory
htop

# Monitor Docker containers
docker stats

# Monitor database connections
# Check PostgreSQL connection pool in application logs
```

### Key Metrics to Watch
- **Response Time:** p50, p95, p99 percentiles
- **Error Rate:** Should stay < 1%
- **Throughput:** Actual TPS achieved
- **Memory Usage:** Watch for leaks during soak tests
- **Database Connections:** Ensure pool isn't exhausted
- **Redis Connections:** Monitor cache performance

## Troubleshooting

### MFA Required Error
If you see "MFA verification required" when running `npm run perf:get-token`:

**Option 1: Provide MFA Code (Recommended)**
The script accepts MFA codes as the 4th argument:
```bash
# With TOTP code from authenticator app (6 digits)
# ⚠️ IMPORTANT: TOTP codes expire every 30 seconds - get a fresh code!
npm run perf:get-token <email> <password> 123456

# With backup code
npm run perf:get-token <email> <password> BACKUP-XXXX-XXXX

# Or set via environment variable
export MFA_CODE="123456"
npm run perf:get-token
```

**⚠️ Common Issue: "Invalid code" error**
If you get "Invalid code" errors:
1. **TOTP codes expire every 30 seconds** - get a fresh code from your authenticator app
2. **Use the code immediately** - don't wait after getting it
3. **Check device clock** - ensure your device time is synchronized
4. **Try a backup code** - if TOTP keeps failing, use a backup code instead
5. **Example workflow:**
   ```bash
   # 1. Open your authenticator app
   # 2. Get the current 6-digit code
   # 3. Immediately run:
   npm run perf:get-token superadmin33@test33.com Password123! <fresh-code>
   ```

**Option 2: Complete MFA Setup Automatically**
If the account doesn't have MFA set up yet, the script will automatically complete setup:
```bash
npm run perf:get-token
```

**Option 3: Use Account Without MFA**
Create or use an admin account that doesn't have MFA enabled:
```bash
# Update .env.test with a different admin email
TEST_EMAIL=admin-without-mfa@example.com
```

**Option 4: Manually Get Token**
1. Login via the frontend
2. Get the JWT token from browser dev tools (Application > Local Storage)
3. Set it as environment variable:
   ```bash
   export JWT_TOKEN="your-token-here"
   ```

### Authentication Issues
If you get 401 errors:
1. Ensure JWT token is valid and not expired
2. Run `npm run perf:get-token` to get a fresh token
3. Check that the user exists in the database
4. If MFA is enabled, see "MFA Required Error" section above

### No Users Found
If you get 404 errors:
1. Run `npm run seed:user` to create test users
2. Update `USER_IDS` environment variable with actual user IDs
3. Check `test/performance/user-ids.json` for valid user IDs

### Rate Limiting
If you hit rate limits:
- Admin endpoints: 100 requests/minute per user
- Adjust test load or use multiple API keys/tokens

### Connection Issues
- Ensure the application is running on the correct port
- Check `API_URL` environment variable
- Verify database and Redis are accessible

## Test Scenarios

### Credit Eligibility Endpoint
Primary focus: `/api/users/:id/eligible-loan-amount`
- Critical path for 200ms target
- Most frequently called endpoint
- Involves database queries and credit score calculations

### Other Endpoints Tested
- `/api/users/stats` - User statistics
- `/api/loans/stats` - Loan statistics
- `/api/users/:id` - Get user details

## Continuous Integration

To run performance tests in CI:

```bash
# Quick smoke test (1 minute)
k6 run --duration 1m --vus 50 test/performance/credit-eligibility-stress.k6.js

# Full load test (15 minutes)
npm run perf:load:k6
```

## Best Practices

1. **Run tests in isolated environment** - Don't test against production
2. **Warm up the system** - Start with low load before ramping up
3. **Monitor resources** - Watch CPU, memory, and database during tests
4. **Compare results** - Track performance over time to detect regressions
5. **Test realistic scenarios** - Use actual user IDs and data patterns
6. **Document findings** - Keep records of test results and any issues found

## Next Steps

After running tests:
1. Review results in `test-results/` directory
2. Check if targets are met (200ms p95, 300 TPS)
3. Identify bottlenecks if targets aren't met
4. Optimize based on findings
5. Re-run tests to validate improvements

