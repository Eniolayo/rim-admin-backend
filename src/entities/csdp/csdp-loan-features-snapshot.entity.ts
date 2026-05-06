import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { msisdnTransformer } from '../../modules/csdp/csdp-core/msisdn/msisdn.transformer';

/**
 * Snapshot of the feature row at fulfillment time, keyed by loan_id.
 *
 * Phase 2 copies from `csdp_eligibility_features_snapshot` via trans_ref when
 * present; otherwise re-materialises and sets `snapshot_mismatch = true`. Rate
 * of mismatches > 1 % is an incident (scoring §10).
 */
@Entity({ name: 'csdp_loan_features_snapshot' })
export class CsdpLoanFeaturesSnapshot {
  @PrimaryColumn({ name: 'loan_id', type: 'varchar', length: 64 })
  loanId: string;

  @Index()
  @Column({ type: 'varchar', length: 13, transformer: msisdnTransformer })
  msisdn: string;

  @Column({ name: 'trans_ref', type: 'varchar', length: 64, nullable: true })
  transRef: string | null;

  @Column({ name: 'feature_row_snapshot', type: 'jsonb' })
  featureRowSnapshot: Record<string, unknown>;

  @Index()
  @Column({ name: 'snapshot_mismatch', type: 'boolean', default: false })
  snapshotMismatch: boolean;

  @CreateDateColumn({ name: 'captured_at' })
  capturedAt: Date;
}
