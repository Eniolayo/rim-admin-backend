import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'csdp_eligibility_outcome' })
export class CsdpEligibilityOutcome {
  /** References csdp_eligibility_log(id) — FK omitted due to partitioned parent table */
  @PrimaryColumn({ name: 'eligibility_log_id', type: 'uuid' })
  eligibilityLogId: string;

  @Column({ name: 'loan_id', type: 'varchar', length: 64, nullable: true })
  loanId: string | null;

  @Column({ name: 'loan_issued', type: 'boolean', default: false })
  loanIssued: boolean;

  @Column({ name: 'fully_recovered', type: 'boolean', default: false })
  fullyRecovered: boolean;

  @Column({ name: 'days_to_recover', type: 'int', nullable: true })
  daysToRecover: number | null;

  @Column({ name: 'linked_at', type: 'timestamp', default: () => 'now()' })
  linkedAt: Date;
}
