import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * RIM Performance Test Script
 * Target: Verify 300 TPS and < 200ms latency for MNO APIs
 * 
 * Usage:
 * k6 run -e API_URL=http://localhost:3000/api -e API_KEY=your_test_key test/performance/performance-test.k6.js
 */

export const options = {
  scenarios: {
    constant_request_rate: {
      executor: 'constant-arrival-rate',
      rate: 300, // Target 300 TPS
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% of requests must be below 200ms
    http_req_failed: ['rate<0.01'],    // Less than 1% failure rate
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';
const API_KEY = __ENV.API_KEY || 'test-api-token-96-chars-long-placeholder-placeholder-placeholder-placeholder-placeholder-placeholder';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-TOKEN': API_KEY,
    },
  };

  // 1. Eligibility Check
  const eligibilityPayload = JSON.stringify({
    phoneNumber: '+2348012345678',
    network: 'Airtel',
    requestId: `perf-test-${Date.now()}-${Math.random()}`,
  });

  const res = http.post(`${BASE_URL}/mno/eligibility`, eligibilityPayload, params);

  check(res, {
    'eligibility status is 200': (r) => r.status === 200,
    'eligibility response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(0.1);
}
