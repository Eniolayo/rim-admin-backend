import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EligibilityLogJobPayload } from '../eligibility-logger.service';

const BATCH_SIZE = 100;
const BATCH_TIMEOUT_MS = 5000; // 5 seconds

@Processor('csdp-eligibility-log', { concurrency: 1 })
export class EligibilityLogProcessor
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(EligibilityLogProcessor.name);
  private batchBuffer: EligibilityLogJobPayload[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly lock = { locked: false };

  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  async process(job: Job<EligibilityLogJobPayload>): Promise<void> {
    this.batchBuffer.push(job.data);

    if (this.batchBuffer.length >= BATCH_SIZE) {
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }
      await this.flushBatch();
      return;
    }

    if (!this.lock.locked) {
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }
      this.batchTimeout = setTimeout(() => {
        this.flushBatch().catch((err) => {
          this.logger.error(
            `Error flushing eligibility log batch on timeout: ${err.message}`,
            err.stack,
          );
        });
      }, BATCH_TIMEOUT_MS);
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.lock.locked) return;
    this.lock.locked = true;

    try {
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }

      const batch = [...this.batchBuffer];
      const batchLength = batch.length;

      if (batchLength === 0) return;

      this.batchBuffer = [];

      await this.bulkInsert(batch);

      this.logger.debug(
        `Successfully persisted batch of ${batchLength} eligibility log rows`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to flush eligibility log batch: ${(err as Error).message}`,
        (err as Error).stack,
      );
      // Re-throw so BullMQ triggers retry on the triggering job
      throw err;
    } finally {
      this.lock.locked = false;
    }
  }

  /**
   * Multi-row parameterised INSERT.
   *
   * Each row maps to 14 columns; rows are assembled into a single VALUES
   * clause: ($1,$2,...,$14), ($15,...,$28), ...
   *
   * Uses INSERT ... ON CONFLICT (trans_ref) DO NOTHING as a safety net against
   * duplicate delivery from BullMQ at-least-once semantics.
   */
  private async bulkInsert(
    rows: EligibilityLogJobPayload[],
  ): Promise<void> {
    const COLS = 23;
    const params: unknown[] = [];
    const valueClauses: string[] = [];

    rows.forEach((row, i) => {
      const base = i * COLS;
      const placeholders = Array.from(
        { length: COLS },
        (_, k) => `$${base + k + 1}`,
      ).join(',');
      // The score_components placeholder needs an explicit jsonb cast.
      const placeholderList = placeholders
        .split(',')
        .map((p, k) => (k === 14 ? `${p}::jsonb` : p))
        .join(',');
      valueClauses.push(`(${placeholderList})`);
      params.push(
        row.id,
        row.msisdn,
        row.trans_ref,
        row.requested_at, // timestamptz string
        row.da_kobo,
        row.loan_type,
        row.teamwee_limit_naira,
        row.rim_limit_naira,
        row.winner,
        row.decision_mode,
        row.total_latency_ms ?? null,
        row.teamwee_latency_ms ?? null,
        row.rim_latency_ms ?? null,
        row.error_reason ?? null,
        row.score_components ? JSON.stringify(row.score_components) : null,
        row.score ?? null,
        row.base_limit_naira ?? null,
        row.partner_residual_naira ?? null,
        row.daily_user_remaining_naira ?? null,
        row.system_exposure_pct ?? null,
        row.final_limit_naira ?? null,
        row.model_version ?? null,
        row.gate_failed ?? null,
      );
    });

    const sql = `
      INSERT INTO csdp_eligibility_log (
        id, msisdn, trans_ref, requested_at,
        da_kobo, loan_type,
        teamwee_limit_naira, rim_limit_naira,
        winner, decision_mode,
        total_latency_ms, teamwee_latency_ms, rim_latency_ms,
        error_reason,
        score_components, score, base_limit_naira, partner_residual_naira,
        daily_user_remaining_naira, system_exposure_pct, final_limit_naira,
        model_version, gate_failed
      )
      VALUES ${valueClauses.join(', ')}
      ON CONFLICT (trans_ref) DO NOTHING
    `;

    await this.dataSource.query(sql, params);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Eligibility log job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Eligibility log job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.batchBuffer.length > 0) {
      await this.flushBatch();
    }
  }
}
