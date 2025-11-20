import { registerAs } from '@nestjs/config';

export interface ThrottleConfig {
  ttl: number; // Time window in milliseconds
  limit: number; // Max requests per time window
  authLoginLimit: number; // Stricter limit for login endpoint
  authLoginTtl: number; // Time window for login endpoint
  authOtherLimit: number; // Limit for other auth endpoints
  authOtherTtl: number; // Time window for other auth endpoints
  adminLimit: number; // Limit for admin endpoints
  adminTtl: number; // Time window for admin endpoints
}

export default registerAs('throttle', (): ThrottleConfig => ({
  // Default limits (100 requests per minute)
  ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10), // 60 seconds
  limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10), // 100 requests

  // Auth login limits (stricter - 5 requests per minute)
  authLoginLimit: parseInt(process.env.THROTTLE_AUTH_LOGIN_LIMIT || '5', 10),
  authLoginTtl: parseInt(process.env.THROTTLE_AUTH_LOGIN_TTL || '60000', 10), // 60 seconds

  // Auth other endpoints (10 requests per minute)
  authOtherLimit: parseInt(process.env.THROTTLE_AUTH_OTHER_LIMIT || '10', 10),
  authOtherTtl: parseInt(process.env.THROTTLE_AUTH_OTHER_TTL || '60000', 10), // 60 seconds

  // Admin endpoints (100 requests per minute)
  adminLimit: parseInt(process.env.THROTTLE_ADMIN_LIMIT || '100', 10),
  adminTtl: parseInt(process.env.THROTTLE_ADMIN_TTL || '60000', 10), // 60 seconds
}));

