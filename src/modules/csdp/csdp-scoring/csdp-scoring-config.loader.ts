import { Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter, Gauge } from 'prom-client';
import { SystemConfigService } from '../../system-config/services/system-config.service';
import { CSDP_METRICS } from '../csdp-core/metrics/csdp-metrics.module';
import {
  CsdpConfig,
  CsdpLoanType,
  DEFAULT_CSDP_CONFIG,
} from './heuristic-v3';

const CATEGORY = 'csdp_scoring';
const LOAN_TYPES: CsdpLoanType[] = ['AIRTIME', 'DATA', 'TALKTIME'];

/**
 * Process-local TTL cache window — fresh enough for ops to see config
 * edits within ~1 minute without hammering SYSTEM_CONFIG on every
 * Profile request.
 */
export const CONFIG_CACHE_TTL_MS = 60_000;

/**
 * Hard ceiling on stale-while-error. If SYSTEM_CONFIG has been
 * unreadable for longer than this, `load()` returns DEFAULT_CSDP_CONFIG
 * (the degraded-behavior fallback) so scoring still produces results
 * with sane defaults; the alert fires meanwhile.
 */
export const CONFIG_CACHE_HARD_TTL_MS = 5 * 60_000;

/**
 * Maps the seeded `csdp.*` rows from SYSTEM_CONFIG into the `CsdpConfig`
 * shape consumed by `heuristic_v3`.
 *
 * **TTL cache** (`CONFIG_CACHE_TTL_MS`) — within the window, repeated
 * calls return the cached snapshot without touching the DB. Outside the
 * window we refresh from SYSTEM_CONFIG.
 *
 * **Degraded behavior** — if a refresh fails (DB down, timeout):
 *   1. Within `CONFIG_CACHE_HARD_TTL_MS` of the last successful refresh
 *      we serve the last-known-good snapshot (stale-while-error). The
 *      `csdp_config_cache_ttl_exceeded_total{outcome="stale"}` counter
 *      and `csdp_config_cache_stale_seconds` gauge let the runbook
 *      alert fire.
 *   2. Past the hard TTL we serve `DEFAULT_CSDP_CONFIG` and emit
 *      `outcome="defaults"`. Scoring continues to produce results;
 *      operators must intervene before the runbook escalates.
 *
 * Missing individual keys still silently fall back to defaults so a
 * partial seed never crashes scoring.
 */
@Injectable()
export class CsdpScoringConfigLoader {
  private readonly logger = new Logger(CsdpScoringConfigLoader.name);

  private cached: CsdpConfig | null = null;
  private cachedAt = 0;
  private inFlight: Promise<CsdpConfig> | null = null;

  constructor(
    private readonly systemConfig: SystemConfigService,
    @InjectMetric(CSDP_METRICS.configCacheHitsTotal)
    private readonly cacheHits: Counter<string>,
    @InjectMetric(CSDP_METRICS.configCacheTtlExceededTotal)
    private readonly cacheTtlExceeded: Counter<string>,
    @InjectMetric(CSDP_METRICS.configCacheStaleSeconds)
    private readonly cacheStaleSeconds: Gauge<string>,
  ) {}

  async load(): Promise<CsdpConfig> {
    const now = Date.now();
    const ageMs = this.cached ? now - this.cachedAt : Infinity;

    if (this.cached && ageMs < CONFIG_CACHE_TTL_MS) {
      this.cacheHits.inc({ result: 'hit' });
      return this.cached;
    }

    // Coalesce concurrent refreshes — only one DB read in flight.
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.refresh(ageMs);
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  /**
   * Bypass the cache and force a fresh read. Used in tests; ops should
   * invalidate via the SYSTEM_CONFIG admin path which (Phase 4) will
   * publish an invalidation event.
   */
  async loadFresh(): Promise<CsdpConfig> {
    this.cached = null;
    this.cachedAt = 0;
    return this.load();
  }

  private async refresh(ageMs: number): Promise<CsdpConfig> {
    try {
      const fresh = await this.readAndMap();
      this.cached = fresh;
      this.cachedAt = Date.now();
      this.cacheStaleSeconds.set(0);
      this.cacheHits.inc({ result: this.cached ? 'refresh' : 'miss' });
      return fresh;
    } catch (err) {
      const stalenessSec = Number.isFinite(ageMs) ? Math.floor(ageMs / 1000) : 0;
      this.cacheStaleSeconds.set(stalenessSec);

      if (this.cached && ageMs < CONFIG_CACHE_HARD_TTL_MS) {
        this.cacheTtlExceeded.inc({ outcome: 'stale' });
        this.logger.warn(
          `csdp_scoring config refresh failed; serving stale snapshot ${stalenessSec}s old: ${String(err)}`,
        );
        return this.cached;
      }

      this.cacheTtlExceeded.inc({ outcome: 'defaults' });
      this.logger.error(
        `csdp_scoring config refresh failed past hard TTL (${stalenessSec}s); serving DEFAULT_CSDP_CONFIG: ${String(err)}`,
      );
      return DEFAULT_CSDP_CONFIG;
    }
  }

  private async readAndMap(): Promise<CsdpConfig> {
    const rows = await this.systemConfig.findAll({ category: CATEGORY });
    const map = new Map<string, unknown>();
    for (const row of rows) map.set(row.key, row.value);

    const num = (key: string, fallback: number): number => {
      const v = map.get(key);
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const bool = (key: string, fallback: boolean): boolean => {
      const v = map.get(key);
      if (v === true || v === 'true') return true;
      if (v === false || v === 'false') return false;
      return fallback;
    };

    const D = DEFAULT_CSDP_CONFIG;

    const anchors = LOAN_TYPES.reduce(
      (acc, t) => {
        acc[t] = {
          smallMin: num(`csdp.tier.anchors.${t}.small_min`, D.anchors[t].smallMin),
          maxLimit: num(`csdp.tier.anchors.${t}.max_limit`, D.anchors[t].maxLimit),
        };
        return acc;
      },
      {} as CsdpConfig['anchors'],
    );

    const dailyUserCapNaira = LOAN_TYPES.reduce(
      (acc, t) => {
        acc[t] = num(`csdp.daily_user_cap_naira.${t}`, D.dailyUserCapNaira[t]);
        return acc;
      },
      {} as CsdpConfig['dailyUserCapNaira'],
    );

    const loanTypeEnabled = LOAN_TYPES.reduce(
      (acc, t) => {
        acc[t] = bool(`csdp.loan_type_enabled.${t}`, D.loanTypeEnabled[t]);
        return acc;
      },
      {} as CsdpConfig['loanTypeEnabled'],
    );

    return {
      priorAlpha: num('csdp.score.prior_alpha', D.priorAlpha),
      priorBeta: num('csdp.score.prior_beta', D.priorBeta),
      confidencePseudoN: num('csdp.score.confidence_pseudo_n', D.confidencePseudoN),
      evidenceMax: num('csdp.score.evidence_max', D.evidenceMax),
      tenureMultMin: num('csdp.score.tenure_mult_min', D.tenureMultMin),
      tenureSatDays: num('csdp.score.tenure_sat_days', D.tenureSatDays),
      engagementMultMin: num('csdp.score.engagement_mult_min', D.engagementMultMin),
      engagementSat: num('csdp.score.engagement_sat', D.engagementSat),
      coldStartBase: num('csdp.score.cold_start_base', D.coldStartBase),
      coldStartMinTenureDays: num(
        'csdp.score.cold_start_min_tenure_days',
        D.coldStartMinTenureDays,
      ),
      coldStartMinEngagement: num(
        'csdp.score.cold_start_min_engagement',
        D.coldStartMinEngagement,
      ),
      continuityBonusMaxNaira: num(
        'csdp.coldstart.continuity_bonus_max_naira',
        D.continuityBonusMaxNaira,
      ),
      continuityBonusLoanWindow: num(
        'csdp.coldstart.continuity_bonus_loan_window',
        D.continuityBonusLoanWindow,
      ),
      penaltyCuredRecent: num('csdp.score.penalty_cured_recent', D.penaltyCuredRecent),
      penaltyCuredLifetime: num('csdp.score.penalty_cured_lifetime', D.penaltyCuredLifetime),
      penaltyCuredLifetimeCap: num(
        'csdp.score.penalty_cured_lifetime_cap',
        D.penaltyCuredLifetimeCap,
      ),
      penaltyVelocity: num('csdp.score.penalty_velocity', D.penaltyVelocity),
      velocityThreshold: num('csdp.score.velocity_threshold', D.velocityThreshold),
      baseThreshold: num('csdp.tier.base_threshold', D.baseThreshold),
      thinFileMaxBonus: num('csdp.tier.thin_file_max_bonus', D.thinFileMaxBonus),
      thinFileSaturation: num('csdp.tier.thin_file_saturation', D.thinFileSaturation),
      curveExponent: num('csdp.tier.curve_exponent', D.curveExponent),
      anchors,
      partnerCapNaira: num('csdp.partner_cap_naira', D.partnerCapNaira),
      dailyUserCapNaira,
      exposureTaperStartPct: num(
        'csdp.exposure.taper_start_pct',
        D.exposureTaperStartPct,
      ),
      exposureHaltPct: num('csdp.exposure.halt_pct', D.exposureHaltPct),
      velocityExtreme: num('csdp.gate.velocity_extreme', D.velocityExtreme),
      loanTypeEnabled,
    };
  }
}
