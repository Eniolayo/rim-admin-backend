import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { msisdnTransformer } from '../../modules/csdp/csdp-core/msisdn/msisdn.transformer';

export type CsdpLoanStatus = 'ISSUED' | 'PARTIAL' | 'RECOVERED' | 'DEFAULTED';

@Entity({ name: 'csdp_loan' })
export class CsdpLoan {
  @PrimaryColumn({ name: 'loan_id', type: 'varchar', length: 64 })
  loanId: string;

  @Index()
  @Column({ type: 'varchar', length: 13, transformer: msisdnTransformer })
  msisdn: string;

  /** AVYRA | ERL | FONYOU | OTHER */
  @Column({ type: 'varchar', length: 32 })
  vendor: string;

  /** AIRTIME | DATA | TALKTIME */
  @Column({ name: 'loan_type', type: 'varchar', length: 16 })
  loanType: string;

  @Column({ name: 'principal_naira', type: 'numeric', precision: 12, scale: 2 })
  principalNaira: string;

  @Column({ name: 'repayable_naira', type: 'numeric', precision: 12, scale: 2 })
  repayableNaira: string;

  /** ISSUED | PARTIAL | RECOVERED | DEFAULTED */
  @Column({ type: 'varchar', length: 16 })
  status: CsdpLoanStatus;

  @Index()
  @Column({ name: 'trans_ref', type: 'varchar', length: 64, nullable: true })
  transRef: string | null;

  @Column({ name: 'issued_at', type: 'timestamp' })
  issuedAt: Date;

  @Column({ name: 'recovered_at', type: 'timestamp', nullable: true })
  recoveredAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
