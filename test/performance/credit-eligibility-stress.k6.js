import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

/**
 * Credit Eligibility Stress Test
 * Target: Validate 200ms p95 latency and 300 TPS throughput
 * 
 * Usage:
 * k6 run -e API_URL=http://localhost:3000/api -e JWT_TOKEN=your_token -e USER_IDS=user-id-1,user-id-2 test/performance/credit-eligibility-stress.k6.js
 */

const errorRate = new Rate('errors');
const p95Latency = new Trend('p95_latency');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 TPS
    { duration: '2m', target: 100 },  // Ramp to 100 TPS
    { duration: '2m', target: 200 },  // Ramp to 200 TPS
    { duration: '2m', target: 300 },  // Target: 300 TPS
    { duration: '5m', target: 300 }, // Sustain 300 TPS
    { duration: '2m', target: 400 }, // Stress test beyond target
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% must be < 200ms
    http_req_failed: ['rate<0.01'],     // < 1% errors
    errors: ['rate<0.01'],
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

  const res = http.get(`${BASE_URL}/users/${userId}/eligible-loan-amount`, params);
  
  const success = check(res, {
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

  errorRate.add(!success);
  p95Latency.add(res.timings.duration);

  sleep(0.1);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const passed = p95 < 200;
  const totalRequests = data.metrics.http_req_duration?.count || 0;
  const errorRate = data.metrics.http_req_failed?.rate || 0;
  const successRate = (1 - errorRate) * 100;
  
  return {
    'test-results/credit-eligibility-stress.json': JSON.stringify(data, null, 2),
    'test-results/credit-eligibility-stress-summary.txt': `
Credit Eligibility Stress Test Results
=====================================
Target: 95% of requests < 200ms
Actual P95: ${p95.toFixed(2)}ms
Status: ${passed ? '✅ PASS' : '❌ FAIL'}

Total Requests: ${totalRequests}
Success Rate: ${successRate.toFixed(2)}%
Error Rate: ${(errorRate * 100).toFixed(2)}%
    `,
  };
}

