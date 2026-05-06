import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { msisdnTransformer } from '../../modules/csdp/csdp-core/msisdn/msisdn.transformer';

/**
 * Persisted lending state per MSISDN (Option B in CSDP_HUB_MIGRATION_PLAN).
 * Holds blacklist flags, admin overrides, and the last-computed limit.
 */
@Entity({ name: 'csdp_credit_profile' })
export class CsdpCreditProfile {
  @PrimaryColumn({ type: 'varchar', length: 13, transformer: msisdnTransformer })
  msisdn: string;

  @Column({ type: 'boolean', default: false })
  blacklisted: boolean;

  @Column({ name: 'blacklist_reason', type: 'varchar', length: 128, nullable: true })
  blacklistReason: string | null;

  @Column({ name: 'admin_override_limit_naira', type: 'int', nullable: true })
  adminOverrideLimitNaira: number | null;

  @Column({ name: 'admin_override_set_by', type: 'varchar', length: 64, nullable: true })
  adminOverrideSetBy: string | null;

  @Column({ name: 'admin_override_set_at', type: 'timestamp', nullable: true })
  adminOverrideSetAt: Date | null;

  @Column({ name: 'persisted_limit_naira', type: 'int', nullable: true })
  persistedLimitNaira: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
