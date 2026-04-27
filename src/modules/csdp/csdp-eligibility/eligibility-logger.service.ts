import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { DecisionContext, DecisionResult } from './decision-router.service';

export interface EligibilityLogJobPayload {
  id: string;
  msisdn: string;
  trans_ref: string;
  requested_at: string; // ISO string
  da_kobo: string;
  loan_type: string;
  teamwee_limit_kobo: string | null;
  rim_limit_kobo: string | null;
  winner: string;
  decision_mode: string;
  total_latency_ms: number;
  teamwee_latency_ms: number | null;
  rim_latency_ms: number | null;
  error_reason: string | null;
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
   */
  async enqueue(ctx: DecisionContext, result: DecisionResult): Promise<void> {
    const payload: EligibilityLogJobPayload = {
      id: randomUUID(),
      msisdn: ctx.msisdn,
      trans_ref: ctx.transRef,
      requested_at: new Date(ctx.receivedAt).toISOString(),
      da_kobo: ctx.daKobo.toString(),
      loan_type: ctx.loanType,
      teamwee_limit_kobo: result.teamweeLimitKobo?.toString() ?? null,
      rim_limit_kobo: result.rimLimitKobo?.toString() ?? null,
      winner: result.winner,
      decision_mode: result.decisionMode,
      total_latency_ms: result.totalLatencyMs,
      teamwee_latency_ms: result.teamweeLatencyMs,
      rim_latency_ms: result.rimLatencyMs,
      error_reason: result.errorReason,
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
