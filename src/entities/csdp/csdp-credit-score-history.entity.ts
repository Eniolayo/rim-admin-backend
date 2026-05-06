import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { msisdnTransformer } from '../../modules/csdp/csdp-core/msisdn/msisdn.transformer';

/**
 * Append-only audit of every score recomputation. Keyed by MSISDN; written
 * by EligibilityLinkingProcessor, webhook handlers, and admin overrides.
 */
@Entity({ name: 'csdp_credit_score_history' })
@Index(['msisdn', 'recordedAt'])
export class CsdpCreditScoreHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 13, transformer: msisdnTransformer })
  msisdn: string;

  @Column({ type: 'int' })
  score: number;

  @Column({ name: 'score_components', type: 'jsonb' })
  scoreComponents: Record<string, unknown>;

  /** 'EligibilityLinkingProcessor' | 'webhook' | 'admin_override' | ... */
  @Column({ name: 'change_reason', type: 'varchar', length: 64 })
  changeReason: string;

  /** e.g. 'heuristic_v3' */
  @Column({ name: 'model_version', type: 'varchar', length: 32 })
  modelVersion: string;

  @CreateDateColumn({ name: 'recorded_at' })
  recordedAt: Date;
}
