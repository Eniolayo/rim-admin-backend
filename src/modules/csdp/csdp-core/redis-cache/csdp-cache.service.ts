import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { CSDP_REDIS_CACHE } from './csdp-redis.constants';

/**
 * Typed cache helper backed by the CSDP Redis db=1 client.
 * The ioredis client already has keyPrefix:'csdp:' applied — do NOT double-prefix keys.
 */
@Injectable()
export class CsdpCacheService implements OnModuleDestroy {
  constructor(@Inject(CSDP_REDIS_CACHE) private readonly client: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSec?: number): Promise<void> {
    const serialised = JSON.stringify(value);
    if (ttlSec) {
      await this.client.setex(key, ttlSec, serialised);
    } else {
      await this.client.set(key, serialised);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string, ttlSec?: number): Promise<number> {
    const result = await this.client.incr(key);
    if (ttlSec && result === 1) {
      // Only set TTL when key is first created (incr returned 1)
      await this.client.expire(key, ttlSec);
    }
    return result;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.status === 'ready') {
      await this.client.quit();
    }
  }
}
