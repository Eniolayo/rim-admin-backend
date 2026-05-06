import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { CSDP_METRICS } from '../csdp-core/metrics/csdp-metrics.module';
import { FeatureRowReadModel } from './feature-row-read-model.service';

/**
 * Writes `csdp_loan_features_snapshot` keyed by loan_id at fulfillment
 * time (CSDP_SCORING_ALGORITHM §10).
 *
 * Two-point snapshotting: if the loan's `trans_ref` matches a row in
 * `csdp_eligibility_features_snapshot` (Profile-time row), copy that
 * feature-row JSONB forward unchanged with `snapshot_mismatch=false`.
 * Otherwise re-materialize live via `FeatureRowReadModel`, mark
 * `snapshot_mismatch=true`, and increment `csdp_snapshot_mismatch_total`.
 *
 * Phase 2 exit gate: mismatch rate < 1 % on shadow traffic
 * (CSDP_MIGRATION_PHASES §"Phase 2" exit criteria, §12 R-6).
 *
 * Idempotent: `ON CONFLICT (loan_id) DO NOTHING` so a webhook replay
 * doesn't overwrite the original captured-at timestamp or flip the
 * mismatch flag.
 */
@Injectable()
export class LoanSnapshotService {
  private readonly logger = new Logger(LoanSnapshotService.name);

  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
    private readonly readModel: FeatureRowReadModel,
    @InjectMetric(CSDP_METRICS.snapshotMismatchTotal)
    private readonly mismatchCounter: Counter<string>,
  ) {}

  async snapshotLoan(
    loanId: string,
    msisdn: string,
    transRef: string | null,
  ): Promise<void> {
    let snapshot: unknown = null;

    if (transRef) {
      const rows: Array<{ feature_row_snapshot: unknown }> =
        await this.dataSource.query(
          `SELECT feature_row_snapshot
           FROM csdp_eligibility_features_snapshot
           WHERE trans_ref = $1`,
          [transRef],
        );
      if (rows.length > 0) {
        snapshot = rows[0].feature_row_snapshot;
      }
    }

    const mismatch = snapshot === null;
    if (mismatch) {
      snapshot = await this.readModel.read(msisdn);
      this.mismatchCounter.inc();
    }

    await this.dataSource.query(
      `INSERT INTO csdp_loan_features_snapshot
         (loan_id, msisdn, trans_ref, feature_row_snapshot, snapshot_mismatch, captured_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
       ON CONFLICT (loan_id) DO NOTHING`,
      [loanId, msisdn, transRef, JSON.stringify(snapshot), mismatch],
    );

    if (mismatch) {
      this.logger.warn({
        message: 'csdp_loan_features_snapshot fell back to live re-materialization',
        loanId,
        transRef,
      });
    }
  }
}
