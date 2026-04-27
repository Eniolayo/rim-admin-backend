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

  @Column({ name: 'da_kobo', type: 'bigint' })
  daKobo: string;

  @Column({ name: 'loan_type', type: 'varchar', length: 16 })
  loanType: string;

  @Column({ name: 'teamwee_limit_kobo', type: 'bigint', nullable: true })
  teamweeLimitKobo: string | null;

  @Column({ name: 'rim_limit_kobo', type: 'bigint', nullable: true })
  rimLimitKobo: string | null;

  /** STUB | TEAMWEE | RIM | FALLBACK */
  @Column({ type: 'varchar', length: 16 })
  winner: string;

  /** STUB_DENY | PROXY | SHADOW | LIVE_5 | LIVE_10 | LIVE_20 */
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
}
