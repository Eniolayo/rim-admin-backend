import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CsdpFeatureRow } from '../csdp-scoring/heuristic-v3';

/**
 * Writes `csdp_eligibility_features_snapshot` keyed by trans_ref. The
 * fulfillment-time loan snapshot (step 9) reads this row and copies it
 * forward; if the trans_ref → loan_id link is broken at fulfillment, the
 * loan snapshot falls back to live re-materialization with
 * snapshot_mismatch=true.
 *
 * ON CONFLICT DO NOTHING — Profile idempotency (step 3) already
 * short-circuits before scoring runs, but the unique constraint adds
 * defense-in-depth against any race.
 */
@Injectable()
export class EligibilitySnapshotService {
  private readonly logger = new Logger(EligibilitySnapshotService.name);

  constructor(
    @InjectDataSource('csdpBatch')
    private readonly dataSource: DataSource,
  ) {}

  async write(
    transRef: string,
    msisdn: string,
    features: CsdpFeatureRow,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO csdp_eligibility_features_snapshot
         (trans_ref, msisdn, feature_row_snapshot, captured_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (trans_ref) DO NOTHING`,
      [transRef, msisdn, JSON.stringify(features)],
    );
  }
}
