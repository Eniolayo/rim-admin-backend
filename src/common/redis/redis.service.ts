import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

/**
 * Redis Service
 *
 * Example usage:
 *
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly redisService: RedisService) {}
 *
 *   async getData(key: string): Promise<string | null> {
 *     return await this.redisService.get(key);
 *   }
 *
 *   async setData(key: string, value: string, ttl?: number): Promise<void> {
 *     await this.redisService.set(key, value, ttl);
 *   }
 *
 *   async deleteData(key: string): Promise<void> {
 *     await this.redisService.del(key);
 *   }
 * }
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: Redis) {}

  /**
   * Get value from Redis
   */
  async get(key: string): Promise<string | null> {
    return await this.redisClient.get(key);
  }

  /**
   * Get value and parse as JSON
   */
  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.redisClient.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set value in Redis
   * @param key - Redis key
   * @param value - Value to store
   * @param ttl - Time to live in seconds (optional)
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redisClient.setex(key, ttl, value);
    } else {
      await this.redisClient.set(key, value);
    }
  }

  /**
   * Set JSON value in Redis
   */
  async setJson(key: string, value: unknown, ttl?: number): Promise<void> {
    const jsonValue = JSON.stringify(value);
    await this.set(key, jsonValue, ttl);
  }

  /**
   * Delete key from Redis
   */
  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  /**
   * Delete multiple keys
   */
  async delPattern(pattern: string): Promise<void> {
    const keys = await this.redisClient.keys(pattern);
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redisClient.exists(key);
    return result === 1;
  }

  /**
   * Set expiration time for a key
   */
  async expire(key: string, ttl: number): Promise<void> {
    await this.redisClient.expire(key, ttl);
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    return await this.redisClient.ttl(key);
  }

  /**
   * Increment a numeric value
   */
  async incr(key: string): Promise<number> {
    return await this.redisClient.incr(key);
  }

  /**
   * Decrement a numeric value
   */
  async decr(key: string): Promise<number> {
    return await this.redisClient.decr(key);
  }

  /**
   * Get Redis client (for advanced operations)
   */
  getClient(): Redis {
    return this.redisClient;
  }

  /**
   * Check Redis connection status
   */
  isConnected(): boolean {
    return this.redisClient.status === 'ready';
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient.status === 'ready') {
      await this.redisClient.quit();
    }
  }
}
