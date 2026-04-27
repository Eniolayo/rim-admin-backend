import { Injectable, Logger } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import type { Counter, Histogram } from 'prom-client';
import {
  CsdpFeatureFlagsService,
  FLAG_DECISION_MODE,
  DecisionMode,
} from '../csdp-feature-flags/csdp-feature-flags.service';
import { TeamweeAdapter } from './teamwee/teamwee.adapter';
import { TeamweeUnavailableError } from './teamwee/teamwee.errors';
import { CSDP_METRICS } from '../csdp-core/metrics/csdp-metrics.module';

export interface DecisionContext {
  msisdn: string; // E.164 234XXXXXXXXXX
  transRef: string;
  daKobo: bigint;
  loanType: 'AIRTIME' | 'DATA' | 'TALKTIME';
  receivedAt: number; // Date.now()
}

export interface DecisionResult {
  /** The literal string Airtel sees ("0" or "12345 in kobo") */
  responseLimit: string;
  teamweeLimitKobo: bigint | null;
  rimLimitKobo: bigint | null;
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

  async decide(ctx: DecisionContext): Promise<DecisionResult> {
    const decisionMode: DecisionMode =
      (await this.flags.get<DecisionMode>(FLAG_DECISION_MODE)) ?? 'STUB_DENY';

    let result: DecisionResult;

    switch (decisionMode) {
      case 'STUB_DENY':
        result = this.stubDeny(ctx, decisionMode);
        break;

      case 'PROXY':
        result = await this.proxy(ctx, decisionMode);
        break;

      case 'SHADOW':
      case 'LIVE_5':
      case 'LIVE_10':
      case 'LIVE_20':
        // TODO: Phase 2/3 — implement shadow scoring and live RIM modes.
        // For now treat all as PROXY (forward to Teamwee only).
        result = await this.proxy(ctx, decisionMode);
        break;

      default:
        // Unknown mode — safe default
        result = this.stubDeny(ctx, 'STUB_DENY');
        break;
    }

    // Metrics
    this.requestsCounter.inc({
      winner: result.winner,
      loan_type: ctx.loanType,
      decision_mode: result.decisionMode,
    });
    this.profileLatency.observe(
      { decision_mode: result.decisionMode },
      result.totalLatencyMs,
    );

    // Structured log (msisdn will be auto-masked by Pino redact config)
    this.logger.log({
      message: 'csdp_eligibility_decision',
      trans_ref: ctx.transRef,
      decision_mode: result.decisionMode,
      winner: result.winner,
      teamwee_limit: result.teamweeLimitKobo?.toString() ?? null,
      rim_limit: result.rimLimitKobo?.toString() ?? null,
      total_latency_ms: result.totalLatencyMs,
      msisdn: ctx.msisdn,
    });

    return result;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private stubDeny(
    ctx: DecisionContext,
    decisionMode: DecisionMode,
  ): DecisionResult {
    return {
      responseLimit: '0',
      teamweeLimitKobo: null,
      rimLimitKobo: null,
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
    let teamweeLimitKobo: bigint | null = null;
    let teamweeLatencyMs: number | null = null;
    let winner: DecisionResult['winner'] = 'FALLBACK';
    let responseLimit = '0';
    let errorReason: string | null = null;

    try {
      const resp = await this.teamweeAdapter.checkEligibility({
        msisdn: ctx.msisdn,
        transRef: ctx.transRef,
        daKobo: ctx.daKobo,
        loanType: ctx.loanType,
      });

      teamweeLimitKobo = resp.limitKobo;
      teamweeLatencyMs = resp.latencyMs;
      winner = 'TEAMWEE';
      // TODO: Confirm Airtel expects limit in kobo or naira once Teamwee contract
      // is finalised. Currently returning raw kobo value as a string.
      responseLimit = resp.limitKobo.toString();
    } catch (err) {
      if (err instanceof TeamweeUnavailableError) {
        errorReason = err.cause;
      } else {
        errorReason = String(err);
      }
      winner = 'FALLBACK';
      responseLimit = '0';
    }

    // rimLimitKobo is always null in Phase 1 — RIM engine not built yet.
    return {
      responseLimit,
      teamweeLimitKobo,
      rimLimitKobo: null, // Phase 1: RIM engine returns null per plan §1.1
      winner,
      decisionMode,
      teamweeLatencyMs,
      rimLatencyMs: null, // Phase 1: no RIM engine
      totalLatencyMs: Date.now() - ctx.receivedAt,
      errorReason,
    };
  }
}
