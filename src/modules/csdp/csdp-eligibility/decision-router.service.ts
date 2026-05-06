import { Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter, Histogram } from 'prom-client';
import { createHash } from 'crypto';
import {
  CsdpFeatureFlagsService,
  FLAG_DECISION_MODE,
  DecisionMode,
  isDecisionMode,
} from '../csdp-feature-flags/csdp-feature-flags.service';
import { TeamweeAdapter } from './teamwee/teamwee.adapter';
import { TeamweeUnavailableError } from './teamwee/teamwee.errors';
import { CSDP_METRICS } from '../csdp-core/metrics/csdp-metrics.module';
import type { ScoreOutput } from '../csdp-scoring/csdp-scoring.service';

export interface DecisionContext {
  msisdn: string; // E.164 234XXXXXXXXXX
  transRef: string;
  /** Raw kobo string from `?da=...` — kept verbatim for the audit log. */
  daKoboRaw: string | null;
  /** Naira string used by everything internal (services, Teamwee adapter). */
  daNaira: string | null;
  loanType: 'AIRTIME' | 'DATA' | 'TALKTIME';
  receivedAt: number; // Date.now()
}

export interface DecisionResult {
  /** Naira string returned to Airtel/TIMWETECH in `{ message }`. "0" means deny. */
  responseLimitNaira: string;
  teamweeLimitNaira: string | null;
  rimLimitNaira: string | null;
  winner: 'STUB' | 'TEAMWEE' | 'RIM' | 'FALLBACK';
  decisionMode: DecisionMode;
  teamweeLatencyMs: number | null;
  rimLatencyMs: number | null;
  totalLatencyMs: number;
  errorReason: string | null;
}

@Injectable()
export class DecisionRouterService {
  private readonly logger = new Logger(DecisionRouterService.name);

  constructor(
    private readonly flags: CsdpFeatureFlagsService,
    private readonly teamweeAdapter: TeamweeAdapter,
    @InjectMetric(CSDP_METRICS.profileRequestsTotal)
    private readonly requestsCounter: Counter<string>,
    @InjectMetric(CSDP_METRICS.profileLatencyMs)
    private readonly profileLatency: Histogram<string>,
  ) {}

  /**
   * Resolves the current `DECISION_MODE` flag, falling back to `STUB_DENY`
   * for any unset / missing / malformed value. This is the single place
   * where the safe default is enforced.
   */
  async resolveMode(): Promise<DecisionMode> {
    const raw = await this.flags.get<unknown>(FLAG_DECISION_MODE);
    return isDecisionMode(raw) ? raw : 'STUB_DENY';
  }

  /**
   * Returns the **legacy / proxy** decision the customer is currently
   * served. In `STUB_DENY` this is `"0"`; in `PROXY`/`SHADOW`/`LIVE_*`
   * this is the Teamwee proxy result. The final served decision (which
   * may swap in the heuristic_v3 result for an in-cohort MSISDN) is
   * computed by `selectFinal()` once both legs have run.
   */
  async decide(ctx: DecisionContext): Promise<DecisionResult> {
    const decisionMode = await this.resolveMode();

    let result: DecisionResult;

    switch (decisionMode) {
      case 'STUB_DENY':
        result = this.stubDeny(ctx, decisionMode);
        break;

      case 'PROXY':
      case 'SHADOW':
      case 'LIVE_5':
      case 'LIVE_50':
      case 'LIVE':
        result = await this.proxy(ctx, decisionMode);
        break;
    }

    this.requestsCounter.inc({
      winner: result.winner,
      loan_type: ctx.loanType,
      decision_mode: result.decisionMode,
    });
    this.profileLatency.observe(
      { decision_mode: result.decisionMode },
      result.totalLatencyMs,
    );

    this.logger.log({
      message: 'csdp_eligibility_decision',
      trans_ref: ctx.transRef,
      decision_mode: result.decisionMode,
      winner: result.winner,
      teamwee_limit: result.teamweeLimitNaira,
      rim_limit: result.rimLimitNaira,
      total_latency_ms: result.totalLatencyMs,
      msisdn: ctx.msisdn,
    });

    return result;
  }

  /**
   * Picks the decision actually served to the customer once both the
   * legacy/proxy leg (`legacy`) and `heuristic_v3` (`scoring`) have run.
   *
   * Mode behavior:
   * - `STUB_DENY` / `PROXY` / `SHADOW` → return `legacy` unchanged.
   * - `LIVE_5` / `LIVE_50` → if the MSISDN falls inside the cohort
   *   percentile (deterministic SHA-256 hash → bucket [0,100)), return
   *   the heuristic_v3 result; otherwise return `legacy`. The
   *   `decisionMode` field on the returned result reflects what
   *   actually served the response (`LIVE_5`/`LIVE_50` for in-cohort,
   *   `SHADOW` for out-of-cohort) so audit log + dashboards can
   *   distinguish flag-state from served-path.
   * - `LIVE` → 100% heuristic_v3.
   *
   * If `scoring` is `null` (timeout, error) for an in-cohort or LIVE
   * request, we fall back to `legacy` and stamp `errorReason` so the
   * incident is observable. We do **not** deny on scoring failure —
   * the customer keeps the legacy answer.
   */
  selectFinal(
    ctx: DecisionContext,
    decisionMode: DecisionMode,
    legacy: DecisionResult,
    scoring: ScoreOutput | null,
  ): DecisionResult {
    if (decisionMode === 'STUB_DENY' || decisionMode === 'PROXY' || decisionMode === 'SHADOW') {
      return legacy;
    }

    const useHeuristic =
      decisionMode === 'LIVE'
        ? true
        : this.inCohort(ctx.msisdn, this.cohortThreshold(decisionMode));

    if (!useHeuristic) {
      // Out-of-cohort during a partial rollout — record served mode as
      // SHADOW so the served-path label matches what the customer got.
      return { ...legacy, decisionMode: 'SHADOW' };
    }

    if (!scoring) {
      // In-cohort but heuristic_v3 didn't return — keep customer on
      // legacy answer and stamp the error so the incident shows up in
      // dashboards. decisionMode reflects the configured flag value
      // because that is what was *intended* to serve.
      return {
        ...legacy,
        decisionMode,
        errorReason: legacy.errorReason ?? 'scoring_unavailable',
      };
    }

    const rimLimitNaira = String(scoring.result.finalLimitNaira);

    return {
      responseLimitNaira: rimLimitNaira,
      teamweeLimitNaira: legacy.teamweeLimitNaira,
      rimLimitNaira,
      winner: 'RIM',
      decisionMode,
      teamweeLatencyMs: legacy.teamweeLatencyMs,
      rimLatencyMs: null,
      totalLatencyMs: Date.now() - ctx.receivedAt,
      errorReason: null,
    };
  }

  /** LIVE_5 → 5%, LIVE_50 → 50%. */
  private cohortThreshold(mode: DecisionMode): number {
    switch (mode) {
      case 'LIVE_5':
        return 5;
      case 'LIVE_50':
        return 50;
      default:
        return 0;
    }
  }

  /**
   * Deterministic per-MSISDN cohort selection. SHA-256 the canonical
   * MSISDN, take the first 4 bytes as a uint32, mod 100 → bucket
   * [0,100). MSISDN is in-cohort iff `bucket < thresholdPct`.
   *
   * Same MSISDN always lands in the same bucket → smooth ramp from
   * `LIVE_5` to `LIVE_50` to `LIVE` without re-shuffling who has
   * already crossed over.
   */
  private inCohort(msisdn: string, thresholdPct: number): boolean {
    if (thresholdPct <= 0) return false;
    if (thresholdPct >= 100) return true;
    const digest = createHash('sha256').update(msisdn).digest();
    const bucket = digest.readUInt32BE(0) % 100;
    return bucket < thresholdPct;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private stubDeny(
    ctx: DecisionContext,
    decisionMode: DecisionMode,
  ): DecisionResult {
    return {
      responseLimitNaira: '0',
      teamweeLimitNaira: null,
      rimLimitNaira: null,
      winner: 'STUB',
      decisionMode,
      teamweeLatencyMs: null,
      rimLatencyMs: null,
      totalLatencyMs: Date.now() - ctx.receivedAt,
      errorReason: null,
    };
  }

  private async proxy(
    ctx: DecisionContext,
    decisionMode: DecisionMode,
  ): Promise<DecisionResult> {
    let teamweeLimitNaira: string | null = null;
    let teamweeLatencyMs: number | null = null;
    let winner: DecisionResult['winner'] = 'FALLBACK';
    let responseLimitNaira = '0';
    let errorReason: string | null = null;

    try {
      const resp = await this.teamweeAdapter.checkEligibility({
        msisdn: ctx.msisdn,
        transRef: ctx.transRef,
        // Forward the raw kobo string — Teamwee accepts kobo, no conversion needed.
        daKobo: ctx.daKoboRaw,
        loanType: ctx.loanType,
      });

      teamweeLimitNaira = resp.limitNaira;
      teamweeLatencyMs = resp.latencyMs;
      winner = 'TEAMWEE';
      responseLimitNaira = resp.limitNaira;
    } catch (err) {
      if (err instanceof TeamweeUnavailableError) {
        errorReason = err.cause;
      } else {
        errorReason = String(err);
      }
      winner = 'FALLBACK';
      responseLimitNaira = '0';
    }

    return {
      responseLimitNaira,
      teamweeLimitNaira,
      rimLimitNaira: null, // Phase 1: RIM engine not built
      winner,
      decisionMode,
      teamweeLatencyMs,
      rimLatencyMs: null,
      totalLatencyMs: Date.now() - ctx.receivedAt,
      errorReason,
    };
  }
}
