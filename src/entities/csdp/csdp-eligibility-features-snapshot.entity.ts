import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { msisdnTransformer } from '../../modules/csdp/csdp-core/msisdn/msisdn.transformer';

/**
 * Snapshot of the feature row used at Profile decision time, keyed by trans_ref.
 * Phase 2 copies this to `csdp_loan_features_snapshot` at fulfillment time.
 */
@Entity({ name: 'csdp_eligibility_features_snapshot' })
@Index(['msisdn', 'capturedAt'])
export class CsdpEligibilityFeaturesSnapshot {
  @PrimaryColumn({ name: 'trans_ref', type: 'varchar', length: 64 })
  transRef: string;

  @Column({ type: 'varchar', length: 13, transformer: msisdnTransformer })
  msisdn: string;

  @Column({ name: 'feature_row_snapshot', type: 'jsonb' })
  featureRowSnapshot: Record<string, unknown>;

  @CreateDateColumn({ name: 'captured_at' })
  capturedAt: Date;
}
