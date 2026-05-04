import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { msisdnTransformer } from '../../modules/csdp/csdp-core/msisdn/msisdn.transformer';

@Entity({ name: 'csdp_subscriber' })
export class CsdpSubscriber {
  @PrimaryColumn({ type: 'varchar', length: 13 })
  msisdn: string;

  @Column({ name: 'outstanding_kobo', type: 'bigint', default: 0 })
  outstandingKobo: string;

  @Column({ name: 'loans_taken', type: 'int', default: 0 })
  loansTaken: number;

  @Column({ name: 'loans_recovered', type: 'int', default: 0 })
  loansRecovered: number;

  @Column({ name: 'blacklisted', type: 'boolean', default: false })
  blacklisted: boolean;

  @Index()
  @Column({ name: 'last_eligibility_at', type: 'timestamp', nullable: true })
  lastEligibilityAt: Date | null;

  @Index()
  @Column({ name: 'last_loan_at', type: 'timestamp', nullable: true })
  lastLoanAt: Date | null;

  @Index()
  @Column({ name: 'activated_at', type: 'date', nullable: true })
  activatedAt: string | null;

  @Column({ name: 'service_class_id', type: 'int', nullable: true })
  serviceClassId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
