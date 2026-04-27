import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { CsdpFeatureFlag } from '../../../entities/csdp/csdp-feature-flag.entity';
import { CSDP_REDIS_FLAGS } from '../csdp-core/redis-cache/csdp-redis.constants';

export const FLAG_DECISION_MODE = 'DECISION_MODE';
export const FLAG_INGEST_ENABLED = 'INGEST_ENABLED';
export const FLAG_TEAMWEE_TIMEOUT_MS = 'TEAMWEE_TIMEOUT_MS';
export const FLAG_TEAMWEE_CB_THRESHOLD = 'TEAMWEE_CB_THRESHOLD';

export type DecisionMode =
  | 'STUB_DENY'
  | 'PROXY'
  | 'SHADOW'
  | 'LIVE_5'
  | 'LIVE_10'
  | 'LIVE_20';

const FLAG_TTL_SECONDS = 30;

@Injectable()
export class CsdpFeatureFlagsService {
  constructor(
    @InjectRepository(CsdpFeatureFlag, 'csdpHot')
    private readonly repo: Repository<CsdpFeatureFlag>,
    @Inject(CSDP_REDIS_FLAGS)
    private readonly redis: Redis,
  ) {}

  /**
   * Reads flag value; hits Redis (key 'config:<key>') first, falls back to Postgres.
   * Populates Redis with TTL 30s on miss.
   * Returns parsed JSON value or undefined.
   */
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const redisKey = `config:${key}`;

    const cached = await this.redis.get(redisKey);
    if (cached !== null) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        // Corrupt cache entry — fall through to Postgres
      }
    }

    const row = await this.repo.findOne({ where: { key } });
    if (!row) {
      return undefined;
    }

    const serialized = JSON.stringify(row.value);
    await this.redis.set(redisKey, serialized, 'EX', FLAG_TTL_SECONDS);

    return row.value as T;
  }

  /**
   * Convenience helper — returns a string value or the given fallback.
   */
  async getString(key: string, fallback: string): Promise<string> {
    const value = await this.get<unknown>(key);
    if (value === undefined || value === null) {
      return fallback;
    }
    return String(value);
  }

  /**
   * Persists flag, invalidates Redis cache, returns saved row.
   */
  async set(
    key: string,
    value: unknown,
    actorId: string,
  ): Promise<CsdpFeatureFlag> {
    const existing = await this.repo.findOne({ where: { key } });

    const row = this.repo.create({
      ...(existing ?? {}),
      key,
      value,
      updatedBy: actorId,
    });

    const saved = await this.repo.save(row);

    // Invalidate cache
    const redisKey = `config:${key}`;
    await this.redis.del(redisKey);

    return saved;
  }

  /**
   * Lists all flags from Postgres (no cache).
   */
  async list(): Promise<CsdpFeatureFlag[]> {
    return this.repo.find();
  }
}
