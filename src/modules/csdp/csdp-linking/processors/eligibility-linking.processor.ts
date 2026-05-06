import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';
import { Job } from 'bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CSDP_METRICS } from '../../csdp-core/metrics/csdp-metrics.module';
import { FeatureRowMaterializerService } from '../feature-row-materializer.service';

export interface LinkingSweepResult {
  linked: number;
  refreshed: number;
}

export interface MaterializeResult {
  linked: number;
  refreshed: number;
  upserted: number;
}

/** Legacy sweep job name retained so existing Bull repeatables clean up
 *  cleanly on first boot of the new code. The scheduler no longer
 *  registers it; from Phase 2 step 11 onwards the daily materialize job
 *  absorbs the log-linking sweep. */
export const LINKING_JOB_SWEEP = 'sweep';
export const LINKING_JOB_MATERIALIZE = 'materialize-feature-rows';

@Processor('csdp-eligibility-linking', { concurrency: 1 })
export class EligibilityLinkingProcessor extends WorkerHost {
  private readonly logger = new Logger(EligibilityLinkingProcessor.name);

  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
    private readonly materializer: FeatureRowMaterializerService,
    @InjectMetric(CSDP_METRICS.linkingProcessorLastSuccess)
    private readonly lastSuccessGauge: Gauge<string>,
  ) {
    super();
  }

  async process(
    job: Job,
  ): Promise<LinkingSweepResult | MaterializeResult> {
    if (job.name === LINKING_JOB_SWEEP) {
      // Pre-step-11 repeatable left over in Bull. Run the cheap sweep so
      // it does the right thing in transition; the scheduler no longer
      // registers this job name, so once existing repeatables drain it
      // disappears on its own.
      return this.runSweep();
    }
    if (job.name === LINKING_JOB_MATERIALIZE) {
      const sweep = await this.runSweep();
      const upserted = await this.materializer.refreshActiveSubscribers();
      this.lastSuccessGauge.set(Math.floor(Date.now() / 1000));
      return { ...sweep, upserted };
    }
    this.logger.warn(`Unknown job name: ${job.name}, skipping`);
    return { linked: 0, refreshed: 0 };
  }

  private async runSweep(): Promise<LinkingSweepResult> {
    let linked = 0;
    let refreshed = 0;

    await this.dataSource.transaction(async (manager) => {
      // Step 1 + 2 + 3: Find unlinked logs, match loans, insert outcomes
      const insertSql = `
        WITH unlinked AS (
          SELECT el.id, el.msisdn, el.trans_ref, el.requested_at
          FROM csdp_eligibility_log el
          LEFT JOIN csdp_eligibility_outcome o ON o.eligibility_log_id = el.id
          WHERE el.requested_at < NOW() - INTERVAL '30 minutes'
            AND o.eligibility_log_id IS NULL
          ORDER BY el.requested_at ASC
          LIMIT 5000
        ),
        matched AS (
          SELECT u.id AS log_id,
                 (SELECT l.loan_id FROM csdp_loan l
                    WHERE l.msisdn = u.msisdn
                      AND l.issued_at BETWEEN u.requested_at - INTERVAL '5 minutes' AND u.requested_at + INTERVAL '5 minutes'
                    ORDER BY (l.trans_ref IS DISTINCT FROM u.trans_ref) ASC,
                             ABS(EXTRACT(EPOCH FROM (l.issued_at - u.requested_at))) ASC
                    LIMIT 1) AS loan_id
          FROM unlinked u
        )
        INSERT INTO csdp_eligibility_outcome (eligibility_log_id, loan_id, loan_issued, fully_recovered, days_to_recover, linked_at)
        SELECT m.log_id, m.loan_id, m.loan_id IS NOT NULL,
               COALESCE((SELECT l.status = 'RECOVERED' FROM csdp_loan l WHERE l.loan_id = m.loan_id), false),
               (SELECT EXTRACT(DAY FROM l.recovered_at - l.issued_at)::int FROM csdp_loan l WHERE l.loan_id = m.loan_id AND l.recovered_at IS NOT NULL),
               NOW()
        FROM matched m
        ON CONFLICT (eligibility_log_id) DO NOTHING
      `;

      const insertResult = await manager.query(insertSql);
      // TypeORM raw query returns result with rowCount for INSERT statements
      linked = insertResult?.[1] ?? 0;

      // Step 4: Refresh recovery state on previously-unrecovered links
      const updateSql = `
        UPDATE csdp_eligibility_outcome o
        SET fully_recovered = true,
            days_to_recover = EXTRACT(DAY FROM l.recovered_at - l.issued_at)::int
        FROM csdp_loan l
        WHERE o.loan_id = l.loan_id
          AND o.fully_recovered = false
          AND l.status = 'RECOVERED'
          AND l.recovered_at IS NOT NULL
      `;

      const updateResult = await manager.query(updateSql);
      refreshed = updateResult?.[1] ?? 0;
    });

    this.logger.log({
      message: 'csdp-eligibility-linking sweep complete',
      linked,
      refreshed,
    });

    return { linked, refreshed };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job, result: LinkingSweepResult): void {
    this.logger.log(
      `Sweep job ${job.id} completed — linked: ${result?.linked ?? 0}, refreshed: ${result?.refreshed ?? 0}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Sweep job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }
}
