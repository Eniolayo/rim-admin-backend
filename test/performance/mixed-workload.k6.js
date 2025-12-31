import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Mixed Workload Test
 * Target: Test multiple endpoints simultaneously to simulate real-world usage
 * 
 * Usage:
 * k6 run -e API_URL=http://localhost:3000/api -e JWT_TOKEN=your_token -e USER_IDS=user-id-1,user-id-2 test/performance/mixed-workload.k6.js
 */

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 200 },
    { duration: '5m', target: 300 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:CreditEligibility}': ['p(95)<200'],
    'http_req_duration{name:UserStats}': ['p(95)<300'],
    'http_req_duration{name:LoanStats}': ['p(95)<300'],
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
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${JWT_TOKEN}`,
  };

  // 40% - Credit eligibility (critical path)
  if (Math.random() < 0.4) {
    const res = http.get(`${BASE_URL}/users/${userId}/eligible-loan-amount`, {
      headers: baseHeaders,
      tags: { name: 'CreditEligibility' },
    });
    
    check(res, {
      'eligibility status is 200': (r) => r.status === 200,
      'eligibility response time < 200ms': (r) => r.timings.duration < 200,
    });
  }
  // 20% - User stats
  else if (Math.random() < 0.6) {
    const res = http.get(`${BASE_URL}/users/stats`, {
      headers: baseHeaders,
      tags: { name: 'UserStats' },
    });
    
    check(res, {
      'user stats status is 200': (r) => r.status === 200,
    });
  }
  // 20% - Loan stats
  else if (Math.random() < 0.8) {
    const res = http.get(`${BASE_URL}/loans/stats`, {
      headers: baseHeaders,
      tags: { name: 'LoanStats' },
    });
    
    check(res, {
      'loan stats status is 200': (r) => r.status === 200,
    });
  }
  // 20% - Get user details
  else {
    const res = http.get(`${BASE_URL}/users/${userId}`, {
      headers: baseHeaders,
      tags: { name: 'GetUser' },
    });
    
    check(res, {
      'get user status is 200': (r) => r.status === 200,
    });
  }

  sleep(0.1);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const totalRequests = data.metrics.http_req_duration?.count || 0;
  const errorRate = data.metrics.http_req_failed?.rate || 0;
  const successRate = (1 - errorRate) * 100;
  
  return {
    'test-results/mixed-workload.json': JSON.stringify(data, null, 2),
    'test-results/mixed-workload-summary.txt': `
Mixed Workload Test Results
============================
Test: Multiple endpoints with realistic distribution

Overall P95 Latency: ${p95.toFixed(2)}ms
Total Requests: ${totalRequests}
Success Rate: ${successRate.toFixed(2)}%
    `,
  };
}

