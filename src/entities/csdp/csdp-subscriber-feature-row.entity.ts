import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { msisdnTransformer } from '../../modules/csdp/csdp-core/msisdn/msisdn.transformer';

/**
 * Precomputed feature row for `heuristic_v3` scoring (one row per MSISDN).
 *
 * Refresh cadence (set in Phase 2):
 *   - daily 03:00 WAT EligibilityLinkingProcessor (correctness)
 *   - 15-min hot-cohort refresh
 *   - live writers on webhooks for the columns flagged in scoring §5.4
 */
@Entity({ name: 'csdp_subscriber_feature_row' })
export class CsdpSubscriberFeatureRow {
  @PrimaryColumn({ type: 'varchar', length: 13, transformer: msisdnTransformer })
  msisdn: string;

  @Column({ name: 'days_on_network', type: 'int', default: 0 })
  daysOnNetwork: number;

  @Column({ name: 'recharge_count_30d', type: 'int', default: 0 })
  rechargeCount30d: number;

  @Column({ name: 'loans_taken_180d', type: 'int', default: 0 })
  loansTaken180d: number;

  @Column({ name: 'loans_recovered_180d', type: 'int', default: 0 })
  loansRecovered180d: number;

  @Column({ name: 'historical_cured_defaults_180d', type: 'int', default: 0 })
  historicalCuredDefaults180d: number;

  @Column({ name: 'historical_cured_defaults_lifetime', type: 'int', default: 0 })
  historicalCuredDefaultsLifetime: number;

  @Column({ name: 'uncured_default_exists', type: 'boolean', default: false })
  uncuredDefaultExists: boolean;

  @Column({ name: 'our_outstanding_kobo', type: 'bigint', default: 0 })
  ourOutstandingKobo: string;

  /** Naira; Redis is the authoritative source. PG copy is for diagnostics. */
  @Column({ name: 'our_disbursed_24h_naira', type: 'int', default: 0 })
  ourDisbursed24hNaira: number;

  /** Mirror of Redis 1h velocity counter; soft penalty input. */
  @Column({ name: 'eligibility_checks_1h', type: 'int', default: 0 })
  eligibilityChecks1h: number;

  @Index()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
