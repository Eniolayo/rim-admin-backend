import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { DecisionContext, DecisionResult } from './decision-router.service';
import { CsdpScoreResult } from '../csdp-scoring/heuristic-v3';

export interface EligibilityLogJobPayload {
  id: string;
  msisdn: string;
  trans_ref: string;
  requested_at: string; // ISO string
  /** Raw kobo from inbound `?da=...`; null when omitted (audit only). */
  da_kobo: string | null;
  loan_type: string;
  teamwee_limit_naira: string | null;
  rim_limit_naira: string | null;
  winner: string;
  decision_mode: string;
  total_latency_ms: number;
  teamwee_latency_ms: number | null;
  rim_latency_ms: number | null;
  error_reason: string | null;
  // §8 scoring columns (Phase 2 step 8). All nullable: populated when
  // heuristic_v3 ran, omitted when scoring failed or short-circuited.
  score: number | null;
  score_components: Record<string, unknown> | null;
  base_limit_naira: number | null;
  partner_residual_naira: number | null;
  daily_user_remaining_naira: number | null;
  system_exposure_pct: number | null;
  final_limit_naira: number | null;
  model_version: string | null;
  gate_failed: string | null;
}

const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: 1000,
  removeOnFail: false,
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
};

@Injectable()
export class EligibilityLoggerService {
  private readonly logger = new Logger(EligibilityLoggerService.name);

  constructor(
    @InjectQueue('csdp-eligibility-log')
    private readonly queue: Queue,
  ) {}

  /**
   * Fire-and-forget enqueue. Failure to enqueue is logged but does NOT
   * propagate to the caller — the eligibility response must not be delayed
   * by logging concerns.
   *
   * Phase 2 step 8: callers may pass `scoring` + `decisionModeOverride`
   * to record a SHADOW-mode comparison row alongside the legacy decision.
   * When `scoring` is null, the §8 columns are written as null.
   */
  async enqueue(
    ctx: DecisionContext,
    result: DecisionResult,
    scoring?: CsdpScoreResult | null,
    decisionModeOverride?: string,
  ): Promise<void> {
    const payload: EligibilityLogJobPayload = {
      id: randomUUID(),
      msisdn: ctx.msisdn,
      trans_ref: ctx.transRef,
      requested_at: new Date(ctx.receivedAt).toISOString(),
      da_kobo: ctx.daKoboRaw,
      loan_type: ctx.loanType,
      teamwee_limit_naira: result.teamweeLimitNaira,
      rim_limit_naira: scoring
        ? scoring.finalLimitNaira.toString()
        : result.rimLimitNaira,
      winner: result.winner,
      decision_mode: decisionModeOverride ?? result.decisionMode,
      total_latency_ms: result.totalLatencyMs,
      teamwee_latency_ms: result.teamweeLatencyMs,
      rim_latency_ms: result.rimLatencyMs,
      error_reason: result.errorReason,
      score: scoring?.score ?? null,
      score_components: scoring
        ? (scoring.components as unknown as Record<string, unknown>)
        : null,
      base_limit_naira: scoring?.baseLimitNaira ?? null,
      partner_residual_naira: scoring?.partnerResidualNaira ?? null,
      daily_user_remaining_naira: scoring?.dailyUserRemainingNaira ?? null,
      system_exposure_pct: scoring?.systemExposurePct ?? null,
      final_limit_naira: scoring?.finalLimitNaira ?? null,
      model_version: scoring?.modelVersion ?? null,
      gate_failed: scoring?.gateFailed ?? null,
    };

    try {
      await this.queue.add('log', payload, DEFAULT_JOB_OPTIONS);
    } catch (err) {
      this.logger.error(
        `Failed to enqueue eligibility log for trans_ref=${ctx.transRef}: ${String(err)}`,
      );
    }
  }
}
