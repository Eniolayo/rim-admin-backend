import { registerAs } from '@nestjs/config';

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  username?: string;
  ttl?: number;
}

export default registerAs('redis', (): RedisConfig => {
  // If REDIS_URL is provided (production), parse it
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      // Parse redis://[username]:[password]@host:port format
      const url = new URL(redisUrl);
      return {
        url: redisUrl,
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        username: url.username || undefined,
        password: url.password || undefined,
        ttl: parseInt(process.env.REDIS_TTL || '3600', 10), // Default 1 hour
      };
    } catch (error) {
      throw new Error(`Invalid REDIS_URL format: ${redisUrl}`);
    }
  }

  // Development: use individual environment variables
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    username: process.env.REDIS_USERNAME || undefined,
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10), // Default 1 hour
  };
});
