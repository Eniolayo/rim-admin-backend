import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Gauge } from 'prom-client';
import { CSDP_METRICS } from '../csdp-core/metrics/csdp-metrics.module';

export const AGING_JOB_RUN = 'aging-run';

export interface AgingResult {
  defaulted: number;
  recovered: number;
  affectedMsisdns: number;
}

/**
 * Hourly job that maintains the csdp_loan state machine:
 *   ISSUED/PARTIAL past 30 d → DEFAULTED
 *   sum(recovery line items) >= repayable_naira → RECOVERED (defensive
 *     convergence; the recovery webhook processor is the primary writer)
 * After transitions, recompute uncured_default_exists for every affected
 * MSISDN on csdp_subscriber_feature_row.
 */
@Processor('csdp-aging', { concurrency: 1 })
export class AgingProcessor extends WorkerHost {
  private readonly logger = new Logger(AgingProcessor.name);

  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
    @InjectMetric(CSDP_METRICS.agingJobLagSeconds)
    private readonly lagGauge: Gauge<string>,
    @InjectMetric(CSDP_METRICS.agingJobRunsTotal)
    private readonly runsCounter: Counter<string>,
  ) {
    super();
  }

  async process(job: Job): Promise<AgingResult> {
    if (job.name !== AGING_JOB_RUN) {
      this.logger.warn(`Unknown job name: ${job.name}, skipping`);
      return { defaulted: 0, recovered: 0, affectedMsisdns: 0 };
    }

    try {
      const result = await this.runAging();
      this.runsCounter.inc({ result: 'ok' });
      this.lagGauge.set(0);
      this.logger.log({ message: 'csdp-aging run complete', ...result });
      return result;
    } catch (err) {
      this.runsCounter.inc({ result: 'error' });
      throw err;
    }
  }

  private async runAging(): Promise<AgingResult> {
    return this.dataSource.transaction(async (manager) => {
      const defaultedRows: Array<{ msisdn: string }> = await manager.query(
        `UPDATE csdp_loan
         SET status = 'DEFAULTED', updated_at = NOW()
         WHERE status IN ('ISSUED', 'PARTIAL')
           AND issued_at < NOW() - INTERVAL '30 days'
         RETURNING msisdn`,
      );

      const recoveredRows: Array<{ msisdn: string }> = await manager.query(
        `WITH applied AS (
           SELECT loan_id, SUM(amount_applied_naira) AS total
           FROM csdp_recovery_loan_item
           GROUP BY loan_id
         )
         UPDATE csdp_loan l
         SET status = 'RECOVERED',
             recovered_at = COALESCE(l.recovered_at, NOW()),
             updated_at = NOW()
         FROM applied a
         WHERE l.loan_id = a.loan_id
           AND l.status <> 'RECOVERED'
           AND a.total >= l.repayable_naira
         RETURNING l.msisdn`,
      );

      const affected = new Set<string>();
      for (const r of defaultedRows) affected.add(r.msisdn);
      for (const r of recoveredRows) affected.add(r.msisdn);

      if (affected.size > 0) {
        const list = Array.from(affected);
        await manager.query(
          `UPDATE csdp_subscriber_feature_row sfr
           SET uncured_default_exists = EXISTS (
                 SELECT 1 FROM csdp_loan
                 WHERE msisdn = sfr.msisdn
                   AND status = 'DEFAULTED'
               ),
               updated_at = NOW()
           WHERE sfr.msisdn = ANY($1::text[])`,
          [list],
        );
      }

      return {
        defaulted: defaultedRows.length,
        recovered: recoveredRows.length,
        affectedMsisdns: affected.size,
      };
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Aging job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }
}
