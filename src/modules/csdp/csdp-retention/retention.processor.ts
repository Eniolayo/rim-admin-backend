import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge } from 'prom-client';
import { CSDP_METRICS } from '../csdp-core/metrics/csdp-metrics.module';

export const RETENTION_JOB_RUN = 'retention-run';

/**
 * NDPR retention windows per
 * docs/csdp-phase1-ndpr-retention.md (legal sign-off pending). Update
 * here only after the policy doc is updated and re-signed.
 */
export const RETENTION_RULES: Array<{
  table: string;
  column: string;
  intervalMonths: number;
}> = [
  { table: 'csdp_eligibility_features_snapshot', column: 'captured_at', intervalMonths: 24 },
  { table: 'csdp_credit_score_history', column: 'recorded_at', intervalMonths: 24 },
  { table: 'csdp_webhook_inbound_log', column: 'received_at', intervalMonths: 6 },
  { table: 'csdp_ingest_batch', column: 'created_at', intervalMonths: 6 },
  { table: 'csdp_ingest_row', column: 'created_at', intervalMonths: 6 },
];

export interface RetentionResult {
  perTable: Record<string, number>;
  total: number;
}

/**
 * Daily NDPR retention job. Walks `RETENTION_RULES` and deletes rows
 * older than the per-table window. Each delete is its own statement
 * inside a single transaction; if any one fails, the whole run rolls
 * back so partial progress doesn't drift the audit trail.
 *
 * Range-partitioned tables (`csdp_eligibility_log`, `csdp_cdr_*`) are
 * **not** in this rule list because they are pruned by partition drop
 * in a separate migration / partition-management job — DELETE on a
 * 50M-row partitioned table would be operationally hostile. The
 * retention runbook flags partition-drop as a separate procedure.
 */
@Processor('csdp-retention', { concurrency: 1 })
export class RetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(RetentionProcessor.name);

  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
    @InjectMetric(CSDP_METRICS.retentionRowsDeletedTotal)
    private readonly deletedCounter: Counter<string>,
    @InjectMetric(CSDP_METRICS.retentionLastSuccess)
    private readonly lastSuccessGauge: Gauge<string>,
    @InjectMetric(CSDP_METRICS.retentionRunsTotal)
    private readonly runsCounter: Counter<string>,
  ) {
    super();
  }

  async process(job: Job): Promise<RetentionResult> {
    if (job.name !== RETENTION_JOB_RUN) {
      this.logger.warn(`Unknown job name: ${job.name}, skipping`);
      return { perTable: {}, total: 0 };
    }

    try {
      const result = await this.runRetention();
      this.runsCounter.inc({ result: 'ok' });
      this.lastSuccessGauge.set(Math.floor(Date.now() / 1000));
      this.logger.log({ message: 'csdp-retention run complete', ...result });
      return result;
    } catch (err) {
      this.runsCounter.inc({ result: 'error' });
      throw err;
    }
  }

  private async runRetention(): Promise<RetentionResult> {
    return this.dataSource.transaction(async (manager) => {
      const perTable: Record<string, number> = {};
      let total = 0;

      for (const rule of RETENTION_RULES) {
        // Plain DELETE — `intervalMonths` is interpolated as a number
        // literal so there's no SQL-injection surface; tables/columns
        // come from a hard-coded list.
        const sql = `DELETE FROM "${rule.table}" WHERE "${rule.column}" < NOW() - INTERVAL '${rule.intervalMonths} months'`;
        const result: Array<unknown> = await manager.query(sql);
        // postgres-driver returns [rows, count]; we only care about
        // affected count which lives at result[1] for DELETE/UPDATE.
        const affected = Array.isArray(result) && typeof result[1] === 'number' ? result[1] : 0;
        perTable[rule.table] = affected;
        total += affected;
        this.deletedCounter.inc({ table: rule.table }, affected);
      }

      return { perTable, total };
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Retention job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }
}
