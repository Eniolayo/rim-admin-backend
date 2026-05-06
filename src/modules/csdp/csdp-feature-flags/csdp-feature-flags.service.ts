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

/**
 * CSDP `decision_mode` flag values, per CSDP_MIGRATION_PHASES.md §Phase 3.
 *
 * Promotion path (each step is a flag flip, not a deploy):
 *   STUB_DENY → SHADOW → LIVE_5 → LIVE_50 → LIVE
 *
 * `STUB_DENY` is the safe default for any unset / missing / malformed
 * flag value (see DecisionRouterService.decide).
 *
 * `PROXY` is retained for emergency rollback to the legacy Teamwee path.
 *
 * `SHADOW` keeps the legacy decision visible to customers while
 * `heuristic_v3` runs alongside and writes its result + features to the
 * snapshot/log tables for offline comparison.
 *
 * `LIVE_5` / `LIVE_50` route the chosen MSISDN cohort (deterministic
 * percentile by hash) to `heuristic_v3`; everyone else stays on the
 * shadow path. `LIVE` routes 100% to `heuristic_v3`.
 */
export type DecisionMode =
  | 'STUB_DENY'
  | 'PROXY'
  | 'SHADOW'
  | 'LIVE_5'
  | 'LIVE_50'
  | 'LIVE';

export const DECISION_MODE_VALUES: readonly DecisionMode[] = [
  'STUB_DENY',
  'PROXY',
  'SHADOW',
  'LIVE_5',
  'LIVE_50',
  'LIVE',
] as const;

export function isDecisionMode(value: unknown): value is DecisionMode {
  return (
    typeof value === 'string' &&
    (DECISION_MODE_VALUES as readonly string[]).includes(value)
  );
}

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
