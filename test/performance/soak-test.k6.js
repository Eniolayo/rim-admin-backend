import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Soak Test - Long Duration Stability Test
 * Target: 70% of max capacity (210 TPS) for 4 hours
 * Purpose: Detect memory leaks, connection pool exhaustion, degradation
 * 
 * Usage:
 * k6 run -e API_URL=http://localhost:3000/api -e JWT_TOKEN=your_token -e USER_IDS=user-id-1,user-id-2 test/performance/soak-test.k6.js
 */

export const options = {
  scenarios: {
    constant_load: {
      executor: 'constant-arrival-rate',
      rate: 210, // 70% of 300 TPS target
      timeUnit: '1s',
      duration: '4h', // 4 hour soak test
      preAllocatedVUs: 50,
      maxVUs: 300,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:CreditEligibility}': ['p(95)<200'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';
const USER_IDS = __ENV.USER_IDS ? __ENV.USER_IDS.split(',') : ['USR-001', 'USR-002', 'USR-003'];

if (!JWT_TOKEN) {
  throw new Error('JWT_TOKEN environment variable is required');
}

export default function () {
  const userId = USER_IDS[Math.floor(Math.random() * USER_IDS.length)];
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JWT_TOKEN}`,
    },
    tags: { name: 'CreditEligibility' },
  };

  // Test credit eligibility endpoint
  const res = http.get(`${BASE_URL}/users/${userId}/eligible-loan-amount`, params);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'has eligibleAmount': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.eligibleAmount !== undefined;
      } catch {
        return false;
      }
    },
  });

  sleep(0.1);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics.http_req_duration?.values?.['p(99)'] || 0;
  const totalRequests = data.metrics.http_req_duration?.count || 0;
  const errorRate = data.metrics.http_req_failed?.rate || 0;
  const successRate = (1 - errorRate) * 100;
  
  return {
    'test-results/soak-test.json': JSON.stringify(data, null, 2),
    'test-results/soak-test-summary.txt': `
Soak Test Results
=================
Duration: 4 hours
Load: 210 TPS (70% of target)

P95 Latency: ${p95.toFixed(2)}ms
P99 Latency: ${p99.toFixed(2)}ms
Total Requests: ${totalRequests}
Success Rate: ${successRate.toFixed(2)}%
Error Rate: ${(errorRate * 100).toFixed(2)}%

Check for:
- Memory leaks (monitor memory usage over time)
- Connection pool exhaustion
- Performance degradation
    `,
  };
}

