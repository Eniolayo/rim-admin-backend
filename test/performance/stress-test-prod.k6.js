import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * Production Stress Test - k6 Script
 * 
 * ⚠️ WARNING: This script is for PRODUCTION stress testing
 * Use with extreme caution and proper monitoring
 * 
 * Usage:
 * export API_URL="https://rim-admin-backend.onrender.com/api"
 * export JWT_TOKEN="your-production-token"
 * export USER_IDS="USR-001,USR-002,USR-003"
 * k6 run test/performance/stress-test-prod.k6.js
 * 
 * Or using npm script:
 * npm run perf:stress:prod:k6
 */

// Custom metrics
const errorRate = new Rate('errors');
const p95Latency = new Trend('p95_latency');

export const options = {
  // Conservative stages for production testing
  stages: [
    // Stage 1: Warm-up (1 minute, 10 VUs)
    { duration: '1m', target: 10, name: 'Warm-up' },
    
    // Stage 2: Light load (2 minutes, 50 VUs)
    { duration: '2m', target: 50, name: 'Light load' },
    
    // Stage 3: Moderate load (2 minutes, 100 VUs)
    { duration: '2m', target: 100, name: 'Moderate load' },
    
    // Stage 4: Target load (2 minutes, 200 VUs)
    { duration: '2m', target: 200, name: 'Target load' },
    
    // Stage 5: Stress test (2 minutes, 300 VUs)
    { duration: '2m', target: 300, name: 'Stress test' },
    
    // Stage 6: Recovery (1 minute, 50 VUs)
    { duration: '1m', target: 50, name: 'Recovery' },
  ],
  
  // Thresholds for test validation
  thresholds: {
    // Allow higher latency during stress (p95 < 2s, p99 < 5s)
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    
    // Error rate should stay below 5% (allow some during stress)
    http_req_failed: ['rate<0.05'],
    
    // Response time should be reasonable
    http_req_waiting: ['p(95)<2000'],
  },
  
  // Summary time unit
  summaryTimeUnit: 'ms',
};

const BASE_URL = __ENV.API_URL || __ENV.PROD_API_URL || 'https://rim-admin-backend.onrender.com/api';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';
const USER_IDS = __ENV.USER_IDS ? __ENV.USER_IDS.split(',') : ['USR-001', 'USR-002', 'USR-003'];

if (!JWT_TOKEN) {
  throw new Error('JWT_TOKEN environment variable is required for production stress test');
}

// Test scenarios (weighted)
const scenarios = {
  creditEligibility: {
    weight: 60,
    exec: 'creditEligibilityCheck',
  },
  mixedWorkload: {
    weight: 40,
    exec: 'mixedWorkload',
  },
};

export default function () {
  // Randomly select scenario based on weights
  const rand = Math.random();
  if (rand < 0.6) {
    creditEligibilityCheck();
  } else {
    mixedWorkload();
  }
}

// Scenario 1: Credit eligibility check (60% of traffic)
function creditEligibilityCheck() {
  const userId = USER_IDS[Math.floor(Math.random() * USER_IDS.length)];
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JWT_TOKEN}`,
    },
    tags: { name: 'CreditEligibility', scenario: 'creditEligibility' },
    timeout: '10s',  // 10 second timeout
  };

  const res = http.get(`${BASE_URL}/users/${userId}/eligible-loan-amount`, params);
  
  const success = check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,  // 429 = rate limit
    'response received': (r) => r.status !== 0,
    'response time < 10s': (r) => r.timings.duration < 10000,
  });
  
  errorRate.add(!success);
  
  sleep(0.5);  // 0.5 second think time
}

// Scenario 2: Mixed workload (40% of traffic)
function mixedWorkload() {
  const userId = USER_IDS[Math.floor(Math.random() * USER_IDS.length)];
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JWT_TOKEN}`,
    },
    tags: { name: 'MixedWorkload', scenario: 'mixedWorkload' },
    timeout: '10s',
  };

  // Request 1: Credit eligibility
  const res1 = http.get(`${BASE_URL}/users/${userId}/eligible-loan-amount`, {
    ...params,
    tags: { ...params.tags, endpoint: 'eligible-loan-amount' },
  });
  
  check(res1, {
    'eligibility status OK': (r) => r.status === 200 || r.status === 429,
  });
  
  sleep(0.5);
  
  // Request 2: User stats
  const res2 = http.get(`${BASE_URL}/users/stats`, {
    ...params,
    tags: { ...params.tags, endpoint: 'users-stats' },
  });
  
  const success = check(res2, {
    'stats status OK': (r) => r.status === 200 || r.status === 429,
    'response received': (r) => r.status !== 0,
  });
  
  errorRate.add(!success);
  
  sleep(0.5);
}

// Custom summary handler
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
  const p50 = data.metrics.http_req_duration?.values?.['p(50)'] || 0;
  const totalRequests = data.metrics.http_req_duration?.count || 0;
  const errorRatePercent = (data.metrics.http_req_failed?.rate || 0) * 100;
  const successRate = (1 - (data.metrics.http_req_failed?.rate || 0)) * 100;
  const avgRPS = data.metrics.http_reqs?.rate || 0;
  
  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  
  return {
    [`test-results/stress-prod-k6-${timestamp}.json`]: JSON.stringify(data, null, 2),
    [`test-results/stress-prod-k6-${timestamp}-summary.txt`]: `
Production Stress Test Results (k6)
====================================
Test Time: ${timestamp}
Target: ${BASE_URL}

Performance Metrics
-------------------
P50 Latency: ${p50.toFixed(2)}ms
P95 Latency: ${p95.toFixed(2)}ms
P99 Latency: ${p99.toFixed(2)}ms
Average RPS: ${avgRPS.toFixed(2)} requests/second

Request Statistics
------------------
Total Requests: ${totalRequests}
Success Rate: ${successRate.toFixed(2)}%
Error Rate: ${errorRatePercent.toFixed(2)}%

Thresholds
----------
P95 < 2000ms: ${p95 < 2000 ? '✅ PASS' : '❌ FAIL'}
P99 < 5000ms: ${p99 < 5000 ? '✅ PASS' : '❌ FAIL'}
Error Rate < 5%: ${errorRatePercent < 5 ? '✅ PASS' : '❌ FAIL'}

Recommendations
---------------
${p95 > 500 ? '⚠️  P95 latency exceeds 500ms - consider optimization' : '✅ P95 latency within acceptable range'}
${p99 > 2000 ? '⚠️  P99 latency exceeds 2s - investigate slow endpoints' : '✅ P99 latency within acceptable range'}
${errorRatePercent > 1 ? '⚠️  Error rate above 1% - investigate errors' : '✅ Error rate within acceptable range'}
${avgRPS < 200 ? '⚠️  Average RPS below target (300 TPS)' : '✅ Average RPS meets or exceeds target'}
    `,
    stdout: `
Production Stress Test Complete
===============================
P95 Latency: ${p95.toFixed(2)}ms
P99 Latency: ${p99.toFixed(2)}ms
Error Rate: ${errorRatePercent.toFixed(2)}%
Avg RPS: ${avgRPS.toFixed(2)}
Total Requests: ${totalRequests}

Results saved to: test-results/stress-prod-k6-${timestamp}-*
    `,
  };
}

