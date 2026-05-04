import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { msisdnTransformer } from '../../modules/csdp/csdp-core/msisdn/msisdn.transformer';

@Entity({ name: 'csdp_subscriber_discrepancy_log' })
export class CsdpSubscriberDiscrepancyLog {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 13, transformer: msisdnTransformer })
  msisdn: string;

  @Column({ name: 'field', type: 'varchar', length: 64 })
  field: string;

  @Column({ name: 'existing_value', type: 'text', nullable: true })
  existingValue: string | null;

  @Column({ name: 'incoming_value', type: 'text', nullable: true })
  incomingValue: string | null;

  @Index()
  @Column({ name: 'batch_id', type: 'uuid' })
  batchId: string;

  @Column({ name: 'row_line_no', type: 'int', nullable: true })
  rowLineNo: number | null;

  @Index()
  @CreateDateColumn({ name: 'detected_at', type: 'timestamptz' })
  detectedAt: Date;
}
