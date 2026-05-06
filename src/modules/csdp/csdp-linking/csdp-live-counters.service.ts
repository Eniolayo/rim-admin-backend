import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { CSDP_REDIS_CACHE } from '../csdp-core/redis-cache/csdp-redis.constants';

/**
 * Live Redis counters consumed by `heuristic_v3` Stage 2 (velocity penalty)
 * and Stage 4 (daily user cap, system exposure clamp).
 *
 * Two domains:
 *   - `disbursed24h:{msisdn}` — ZSET, member = `${naira}|${loanId}`,
 *     score = epoch ms. Sum-of-naira over members with score in the last
 *     24 h is `our_disbursed_24h_naira`. ZADD on the same loan_id is
 *     idempotent (member uniqueness).
 *   - `elig1h:{msisdn}` — INCR with 3600 s TTL set on first write.
 *     `eligibility_checks_1h` reads the raw integer.
 *
 * Redis is authoritative for these counters. The PG mirror columns on
 * `csdp_subscriber_feature_row` are diagnostic and refreshed nightly by
 * the materializer.
 */
@Injectable()
export class CsdpLiveCountersService {
  /** ZSET ttl: keep keys around just longer than the 24 h window. */
  private static readonly DISBURSED_KEY_TTL_SEC = 60 * 60 * 30;
  private static readonly ELIG_TTL_SEC = 3600;

  constructor(@Inject(CSDP_REDIS_CACHE) private readonly client: Redis) {}

  // ─── disbursed_24h_naira ─────────────────────────────────────────────────

  async recordDisbursement(
    msisdn: string,
    loanId: string,
    repayableNaira: string | number,
    atMs: number = Date.now(),
  ): Promise<void> {
    const key = this.disbursedKey(msisdn);
    const member = `${String(repayableNaira)}|${loanId}`;
    await this.client.zadd(key, atMs, member);
    await this.client.expire(key, CsdpLiveCountersService.DISBURSED_KEY_TTL_SEC);
  }

  async sumDisbursed24hNaira(
    msisdn: string,
    nowMs: number = Date.now(),
  ): Promise<number> {
    const key = this.disbursedKey(msisdn);
    const cutoff = nowMs - 24 * 60 * 60 * 1000;
    // Drop stale members before reading so the active set stays bounded.
    await this.client.zremrangebyscore(key, '-inf', `(${cutoff}`);
    const members = await this.client.zrangebyscore(key, cutoff, '+inf');
    let total = 0;
    for (const m of members) {
      const idx = m.indexOf('|');
      if (idx <= 0) continue;
      const naira = Number(m.slice(0, idx));
      if (Number.isFinite(naira)) total += naira;
    }
    return total;
  }

  // ─── eligibility_checks_1h ───────────────────────────────────────────────

  async incrEligibilityCheck(msisdn: string): Promise<number> {
    const key = this.eligKey(msisdn);
    const result = await this.client.incr(key);
    if (result === 1) {
      await this.client.expire(key, CsdpLiveCountersService.ELIG_TTL_SEC);
    }
    return result;
  }

  async getEligibilityChecks1h(msisdn: string): Promise<number> {
    const raw = await this.client.get(this.eligKey(msisdn));
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  // ─── system_exposure_pct ─────────────────────────────────────────────────

  async getSystemExposurePct(): Promise<number> {
    const raw = await this.client.get('system_exposure_pct');
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }

  /** Writes the published value with a short TTL — if the publisher dies,
   *  the key expires and `getSystemExposurePct` returns 0 (no taper),
   *  letting `csdp_config_cache_ttl_exceeded` / staleness alerts fire. */
  async setSystemExposurePct(pct: number, ttlSec = 120): Promise<void> {
    const value = Number.isFinite(pct) ? Math.max(0, pct) : 0;
    await this.client.set(
      'system_exposure_pct',
      value.toString(),
      'EX',
      ttlSec,
    );
  }

  private disbursedKey(msisdn: string): string {
    return `disbursed24h:${msisdn}`;
  }

  private eligKey(msisdn: string): string {
    return `elig1h:${msisdn}`;
  }
}
