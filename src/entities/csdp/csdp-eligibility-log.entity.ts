import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { msisdnTransformer } from '../../modules/csdp/csdp-core/msisdn/msisdn.transformer';

/**
 * This table is partitioned by RANGE on requested_at in Postgres.
 * TypeORM synchronize is disabled; the actual DDL lives in the migration.
 * Composite PK (id, requested_at) is required because Postgres demands the
 * partition key be part of the primary key on partitioned tables.
 */
@Entity({ name: 'csdp_eligibility_log', synchronize: false })
export class CsdpEligibilityLog {
  /** Part of composite PK — required for partitioned table */
  @PrimaryColumn({ type: 'uuid', name: 'id' })
  id: string;

  /** Part of composite PK — partition key */
  @PrimaryColumn({ type: 'timestamptz', name: 'requested_at' })
  requestedAt: Date;

  @Index()
  @Column({ type: 'varchar', length: 13, transformer: msisdnTransformer })
  msisdn: string;

  @Index({ unique: true })
  @Column({ name: 'trans_ref', type: 'varchar', length: 64 })
  transRef: string;

  @Column({ name: 'da_kobo', type: 'bigint', nullable: true })
  daKobo: string | null;

  @Column({ name: 'loan_type', type: 'varchar', length: 16 })
  loanType: string;

  @Column({ name: 'teamwee_limit_naira', type: 'numeric', precision: 14, scale: 2, nullable: true })
  teamweeLimitNaira: string | null;

  @Column({ name: 'rim_limit_naira', type: 'numeric', precision: 14, scale: 2, nullable: true })
  rimLimitNaira: string | null;

  /** STUB | TEAMWEE | RIM | FALLBACK */
  @Column({ type: 'varchar', length: 16 })
  winner: string;

  /** STUB_DENY | PROXY | SHADOW | LIVE_5 | LIVE_50 | LIVE */
  @Column({ name: 'decision_mode', type: 'varchar', length: 16 })
  decisionMode: string;

  @Column({ name: 'total_latency_ms', type: 'int', nullable: true })
  totalLatencyMs: number | null;

  @Column({ name: 'teamwee_latency_ms', type: 'int', nullable: true })
  teamweeLatencyMs: number | null;

  @Column({ name: 'rim_latency_ms', type: 'int', nullable: true })
  rimLatencyMs: number | null;

  @Column({ name: 'error_reason', type: 'varchar', length: 255, nullable: true })
  errorReason: string | null;

  // ───────────────────────────────────────────────────────────────────────
  // heuristic_v3 scoring columns (CSDP_SCORING_ALGORITHM §8). All nullable
  // so existing shadow writers keep working until Phase 2 wires them.
  // ───────────────────────────────────────────────────────────────────────

  @Column({ type: 'int', nullable: true })
  score: number | null;

  @Column({ name: 'score_components', type: 'jsonb', nullable: true })
  scoreComponents: Record<string, unknown> | null;

  @Column({ name: 'base_limit_naira', type: 'int', nullable: true })
  baseLimitNaira: number | null;

  @Column({ name: 'partner_residual_naira', type: 'int', nullable: true })
  partnerResidualNaira: number | null;

  @Column({ name: 'daily_user_remaining_naira', type: 'int', nullable: true })
  dailyUserRemainingNaira: number | null;

  @Column({ name: 'system_exposure_pct', type: 'real', nullable: true })
  systemExposurePct: number | null;

  @Column({ name: 'final_limit_naira', type: 'int', nullable: true })
  finalLimitNaira: number | null;

  /** e.g. 'heuristic_v3' */
  @Column({ name: 'model_version', type: 'varchar', length: 32, nullable: true })
  modelVersion: string | null;

  /** BLACKLIST | OUTSTANDING | DA_CAP | UNCURED_DEFAULT | VELOCITY | TYPE_DISABLED */
  @Column({ name: 'gate_failed', type: 'varchar', length: 32, nullable: true })
  gateFailed: string | null;

  @Column({ name: 'snapshot_mismatch', type: 'boolean', default: false })
  snapshotMismatch: boolean;
}
