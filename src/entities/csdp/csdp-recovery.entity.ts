import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { msisdnTransformer } from '../../modules/csdp/csdp-core/msisdn/msisdn.transformer';

@Entity({ name: 'csdp_recovery' })
export class CsdpRecovery {
  @PrimaryColumn({ name: 'recovery_id', type: 'varchar', length: 64 })
  recoveryId: string;

  @Index()
  @Column({ type: 'varchar', length: 13, transformer: msisdnTransformer })
  msisdn: string;

  @Column({ name: 'amount_naira', type: 'numeric', precision: 14, scale: 2 })
  amountNaira: string;

  @Column({ name: 'recovered_at', type: 'timestamptz' })
  recoveredAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
