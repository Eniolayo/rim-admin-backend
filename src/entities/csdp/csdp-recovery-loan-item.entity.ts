import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { CsdpLoan } from './csdp-loan.entity';
import { CsdpRecovery } from './csdp-recovery.entity';

@Entity({ name: 'csdp_recovery_loan_item' })
export class CsdpRecoveryLoanItem {
  @PrimaryColumn({ name: 'recovery_id', type: 'varchar', length: 64 })
  recoveryId: string;

  @PrimaryColumn({ name: 'loan_id', type: 'varchar', length: 64 })
  loanId: string;

  @Column({ name: 'amount_applied_kobo', type: 'bigint' })
  amountAppliedKobo: string;

  @ManyToOne(() => CsdpRecovery, { createForeignKeyConstraints: true })
  recovery: CsdpRecovery;

  @ManyToOne(() => CsdpLoan, { createForeignKeyConstraints: true })
  loan: CsdpLoan;
}
