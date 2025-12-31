import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Spike Test - Sudden Load Increase
 * Target: Test system recovery from sudden traffic spikes
 * 
 * Usage:
 * k6 run -e API_URL=http://localhost:3000/api -e JWT_TOKEN=your_token -e USER_IDS=user-id-1,user-id-2 test/performance/spike-test.k6.js
 */

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Normal load
    { duration: '30s', target: 500 },  // Sudden spike to 500 TPS
    { duration: '1m', target: 500 },   // Sustain spike
    { duration: '30s', target: 50 },   // Return to normal
    { duration: '1m', target: 50 },    // Recovery period
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // Allow higher latency during spike
    http_req_failed: ['rate<0.05'],     // Allow up to 5% errors during spike
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
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response received': (r) => r.status !== 0,
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
    'test-results/spike-test.json': JSON.stringify(data, null, 2),
    'test-results/spike-test-summary.txt': `
Spike Test Results
==================
Test: Sudden load increase from 50 to 500 TPS

P95 Latency: ${p95.toFixed(2)}ms
P99 Latency: ${p99.toFixed(2)}ms
Total Requests: ${totalRequests}
Success Rate: ${successRate.toFixed(2)}%
Error Rate: ${(errorRate * 100).toFixed(2)}%

Check for:
- System recovery after spike
- Error handling during spike
- Performance degradation
    `,
  };
}

