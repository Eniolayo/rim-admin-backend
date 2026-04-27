import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { msisdnTransformer } from '../../modules/csdp/csdp-core/msisdn/msisdn.transformer';

@Entity({ name: 'csdp_cdr_sdp' })
export class CsdpCdrSdp {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: string;

  @Index()
  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @Index()
  @Column({ type: 'varchar', length: 13, transformer: msisdnTransformer })
  msisdn: string;

  @Index()
  @Column({ name: 'event_at', type: 'timestamptz' })
  eventAt: Date;

  @Column({ name: 'amount_kobo', type: 'bigint' })
  amountKobo: string;

  @Column({ type: 'jsonb' })
  raw: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
